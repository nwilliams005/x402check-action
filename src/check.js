/**
 * Call x402check: free challenge first, then paid Exact via @x402/fetch-style settle
 * implemented here with viem private key (no heavy x402 deps required in the action).
 *
 * Free: GET /preflight/free/challenge → signMessage → POST /preflight/free
 * Paid: POST /preflight with x402 payment headers is handled by requesting the
 * preflight URL through a simple fetch; when 402, we settle Exact using viem
 * if PAYER_PRIVATE_KEY is set. For reliability we also support the public
 * JSON preflight that returns 402 Payment Required and use x402check's
 * documented client path via raw fetch + Payment payload from @x402 if available.
 *
 * Minimal approach matching x402check-client behavior:
 *   fetch(`${base}/preflight?url=...&fresh=1`) may return 402; with a payer key
 *   we use dynamic import of @x402/fetch when installed, else instruct the user.
 *
 * This action vendors a thin paid path: POST body to /preflight is not enough —
 * payment is via HTTP 402. We depend on optional peer packages installed in
 * the composite prep step... Actually we install @x402/fetch + @x402/evm in main.
 */
import { privateKeyToAccount } from "viem/accounts";

export async function claimFreeCheck(baseUrl, account, sellerUrl, fetchImpl = fetch) {
  const base = baseUrl.replace(/\/$/, "");
  const challengeRes = await fetchImpl(
    `${base}/preflight/free/challenge?address=${encodeURIComponent(account.address)}`,
    { headers: { accept: "application/json" } },
  );
  const challengeBody = await challengeRes.json();
  if (!challengeRes.ok) {
    const err = new Error(
      `free_check_challenge_failed: ${challengeBody.error || challengeRes.status}`,
    );
    err.body = challengeBody;
    throw err;
  }
  const message = String(challengeBody.message || "");
  const nonce = String(challengeBody.nonce || "");
  if (!message || !nonce) throw new Error("free_check_challenge_malformed");

  const signature = await account.signMessage({ message });
  const redeemRes = await fetchImpl(`${base}/preflight/free`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url: sellerUrl,
      address: account.address,
      nonce,
      signature,
    }),
  });
  const redeemBody = await redeemRes.json();
  if (!redeemRes.ok) {
    const err = new Error(
      `free_check_redeem_failed: ${redeemBody.error || redeemBody.message || redeemRes.status}`,
    );
    err.body = redeemBody;
    throw err;
  }
  return redeemBody;
}

export async function paidCheck(baseUrl, privateKey, sellerUrl, { deep = false } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  // Dynamic import so unit tests of compare/parse don't need native x402
  const { x402Client, wrapFetchWithPayment } = await import("@x402/fetch");
  const { registerExactEvmScheme } = await import("@x402/evm/exact/client");

  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(/** @type {`0x${string}`} */ (key));
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: account,
    schemeOptions: {
      8453: { rpcUrl: process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com" },
    },
  });
  const paidFetch = wrapFetchWithPayment(fetch, client);
  const q = new URLSearchParams({ url: sellerUrl, fresh: "1" });
  if (deep) q.set("deep", "1");
  const res = await paidFetch(`${base}/preflight?${q}`, {
    headers: { accept: "application/json" },
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(`paid_check_failed: ${body.error || res.status}`);
    err.body = body;
    throw err;
  }
  return body;
}

export function accountFromKey(privateKey) {
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return privateKeyToAccount(/** @type {`0x${string}`} */ (key));
}
