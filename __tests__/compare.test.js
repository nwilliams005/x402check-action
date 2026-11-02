import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectDrift, parseEndpoints, normalizeAddress } from "../src/compare.js";

describe("parseEndpoints", () => {
  it("parses JSON objects", () => {
    const eps = parseEndpoints(
      JSON.stringify([
        { url: "https://a.example", expectedPriceUsd: 0.01, expectedPayTo: "0xABC" },
      ]),
    );
    assert.equal(eps.length, 1);
    assert.equal(eps[0].expectedPriceUsd, 0.01);
  });
  it("parses newline URLs", () => {
    const eps = parseEndpoints("https://a.example\nhttps://b.example\n");
    assert.deepEqual(eps.map((e) => e.url), ["https://a.example", "https://b.example"]);
  });
});

describe("detectDrift", () => {
  it("flags price change vs expected", () => {
    const { drifted, changes } = detectDrift(
      { priceUsd: 0.02, payTo: "0xabc", network: "eip155:8453" },
      { expectedPriceUsd: 0.01, expectedPayTo: "0xAbC", expectedNetwork: "eip155:8453" },
    );
    assert.equal(drifted, true);
    assert.equal(changes[0].field, "priceUsd");
  });
  it("passes when matches baseline", () => {
    const { drifted } = detectDrift(
      { priceUsd: 0.01, payTo: "0xABC", network: "eip155:8453" },
      {},
      { priceUsd: 0.01, payTo: "0xabc", network: "eip155:8453" },
    );
    assert.equal(drifted, false);
  });
  it("flags payTo change", () => {
    const { drifted, changes } = detectDrift(
      { priceUsd: 0.01, payTo: "0xdead", network: "eip155:8453" },
      { expectedPayTo: "0xabc" },
    );
    assert.equal(drifted, true);
    assert.ok(changes.some((c) => c.field === "payTo"));
  });
});

describe("normalizeAddress", () => {
  it("lowercases", () => {
    assert.equal(normalizeAddress("0xAbC"), "0xabc");
  });
});
