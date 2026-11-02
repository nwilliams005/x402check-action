/**
 * Compare a live ToolCheck against expected config and/or a previous baseline entry.
 */
export function normalizeAddress(a) {
  if (!a || typeof a !== "string") return null;
  return a.toLowerCase();
}

export function normalizeNetwork(n) {
  if (!n || typeof n !== "string") return null;
  return n.trim().toLowerCase();
}

/**
 * @param {object} check - live ToolCheck-like
 * @param {object} expected - { expectedPriceUsd?, expectedPayTo?, expectedNetwork? }
 * @param {object|null} baseline - previous { priceUsd, payTo, network }
 * @returns {{ drifted: boolean, changes: Array<{field:string,from:unknown,to:unknown}> }}
 */
export function detectDrift(check, expected = {}, baseline = null) {
  const changes = [];
  const livePrice = check.priceUsd ?? null;
  const livePayTo = normalizeAddress(check.payTo);
  const liveNetwork = normalizeNetwork(check.network);

  const expPrice =
    expected.expectedPriceUsd !== undefined && expected.expectedPriceUsd !== ""
      ? Number(expected.expectedPriceUsd)
      : baseline?.priceUsd !== undefined
        ? Number(baseline.priceUsd)
        : undefined;
  const expPayTo = normalizeAddress(
    expected.expectedPayTo || baseline?.payTo || null,
  );
  const expNetwork = normalizeNetwork(
    expected.expectedNetwork || baseline?.network || null,
  );

  if (expPrice !== undefined && !Number.isNaN(expPrice)) {
    if (livePrice === null || Math.abs(Number(livePrice) - expPrice) > 1e-9) {
      changes.push({ field: "priceUsd", from: expPrice, to: livePrice });
    }
  }
  if (expPayTo) {
    if (livePayTo !== expPayTo) {
      changes.push({ field: "payTo", from: expPayTo, to: livePayTo });
    }
  }
  if (expNetwork) {
    if (liveNetwork !== expNetwork) {
      changes.push({ field: "network", from: expNetwork, to: liveNetwork });
    }
  }

  return { drifted: changes.length > 0, changes };
}

/**
 * Parse endpoints input: JSON array or newline URLs.
 * @param {string} raw
 * @returns {Array<{url:string, expectedPriceUsd?:number, expectedPayTo?:string, expectedNetwork?:string}>}
 */
export function parseEndpoints(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) throw new Error("endpoints input is empty");
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed);
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error("endpoints JSON must be a non-empty array");
    }
    return arr.map((item, i) => {
      if (typeof item === "string") return { url: item };
      if (!item || typeof item.url !== "string") {
        throw new Error(`endpoints[${i}] missing url`);
      }
      return item;
    });
  }
  return trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((url) => ({ url }));
}
