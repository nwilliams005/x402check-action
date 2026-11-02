import * as core from "@actions/core";
import fs from "node:fs";
import path from "node:path";
import { detectDrift, parseEndpoints } from "./compare.js";
import { accountFromKey, claimFreeCheck, paidCheck } from "./check.js";

async function runOne(ep, { baseUrl, useFree, payerKey, deep, baseline }) {
  const result = {
    url: ep.url,
    via: null,
    check: null,
    drifted: false,
    changes: [],
    error: null,
  };

  try {
    let check = null;
    let via = null;

    if (useFree && payerKey) {
      try {
        const account = accountFromKey(payerKey);
        check = await claimFreeCheck(baseUrl, account, ep.url);
        via = "free";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        core.info(`Free check unavailable for ${ep.url}: ${msg} — trying paid`);
      }
    } else if (useFree && !payerKey) {
      core.warning(
        "use-free-check is true but no payer-private-key; free check needs a signing key. Skipping free.",
      );
    }

    if (!check) {
      if (!payerKey) {
        throw new Error(
          "No check result and no payer-private-key — set secrets.X402CHECK_PAYER_KEY (or input payer-private-key)",
        );
      }
      check = await paidCheck(baseUrl, payerKey, ep.url, { deep });
      via = "paid";
    }

    result.check = check;
    result.via = via;

    const prior = baseline?.[ep.url] || null;
    const { drifted, changes } = detectDrift(check, ep, prior);
    result.drifted = drifted;
    result.changes = changes;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

async function main() {
  const endpointsRaw = core.getInput("endpoints", { required: true });
  const mode = (core.getInput("mode") || "fail").toLowerCase();
  const baseUrl = core.getInput("x402check-url") || "https://x402check.dev";
  const useFree = (core.getInput("use-free-check") || "true").toLowerCase() !== "false";
  const payerKey =
    core.getInput("payer-private-key") || process.env.X402CHECK_PAYER_KEY || "";
  const baselinePath = core.getInput("baseline-path") || ".x402check-baseline.json";
  const writeBaseline = (core.getInput("write-baseline") || "true").toLowerCase() !== "false";
  const deep = (core.getInput("deep") || "false").toLowerCase() === "true";

  const endpoints = parseEndpoints(endpointsRaw);
  core.info(`Checking ${endpoints.length} endpoint(s) via ${baseUrl}`);

  let baseline = {};
  if (fs.existsSync(baselinePath)) {
    try {
      baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    } catch {
      core.warning(`Could not parse baseline at ${baselinePath}; ignoring`);
    }
  }

  const results = [];
  for (const ep of endpoints) {
    const r = await runOne(ep, {
      baseUrl,
      useFree,
      payerKey: payerKey || null,
      deep,
      baseline,
    });
    results.push(r);
    if (r.error) {
      core.error(`${ep.url}: ${r.error}`);
    } else if (r.drifted) {
      const msg = `${ep.url} drifted: ${JSON.stringify(r.changes)}`;
      if (mode === "warn") core.warning(msg);
      else core.error(msg);
    } else {
      core.info(
        `${ep.url}: ok via=${r.via} verdict=${r.check?.verdict} priceUsd=${r.check?.priceUsd}`,
      );
    }
  }

  if (writeBaseline) {
    const next = { ...baseline };
    for (const r of results) {
      if (r.check && !r.error) {
        next[r.url] = {
          priceUsd: r.check.priceUsd ?? null,
          payTo: r.check.payTo ?? null,
          network: r.check.network ?? null,
          verdict: r.check.verdict ?? null,
          checkedAt: new Date().toISOString(),
        };
      }
    }
    const abs = path.resolve(baselinePath);
    const dir = path.dirname(abs);
    if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(next, null, 2) + "\n");
    core.info(`Wrote baseline ${baselinePath}`);
  }

  const drifted = results.some((r) => r.drifted);
  const errored = results.some((r) => r.error);
  core.setOutput("results", JSON.stringify(results));
  core.setOutput("drifted", drifted ? "true" : "false");

  if (errored) {
    core.setFailed("One or more x402check calls failed");
    return;
  }
  if (drifted && mode === "fail") {
    core.setFailed("One or more endpoints drifted from expected/baseline");
  }
}

main().catch((e) => {
  core.setFailed(e instanceof Error ? e.message : String(e));
});
