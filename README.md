# x402check-action

GitHub Action that runs [x402check](https://x402check.dev) against **your** x402 endpoint URLs on push or a schedule. It fails (or warns) when `priceUsd`, `payTo`, or `network` drift from an expected config or the previous run’s baseline.

## Why

If you operate x402 sellers, silent price or `payTo` changes are exactly what agents (and you) want to catch. Pair with the [$5 / 30-day watch plan](https://x402check.dev) for email alerts, or use this Action in CI.

## Usage

```yaml
- uses: nwilliams005/x402check-action@v1
  with:
    mode: fail   # or warn
    payer-private-key: ${{ secrets.X402CHECK_PAYER_KEY }}
    endpoints: |
      [
        {
          "url": "https://your-endpoint.example/api",
          "expectedPriceUsd": 0.01,
          "expectedPayTo": "0xYourPayToAddress",
          "expectedNetwork": "eip155:8453"
        }
      ]
```

See [`.github/workflows/example.yml`](.github/workflows/example.yml).

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `endpoints` | required | JSON array of `{ url, expectedPriceUsd?, expectedPayTo?, expectedNetwork? }` or newline URLs |
| `mode` | `fail` | `fail` exits non-zero on drift; `warn` only annotates |
| `x402check-url` | `https://x402check.dev` | API base |
| `use-free-check` | `true` | One free regular check ever per payer wallet (signed challenge), then paid |
| `payer-private-key` | | `0x…` key that signs free-check + pays **$0.01** (or **$0.05** if `deep: true`) |
| `baseline-path` | `.x402check-baseline.json` | Previous-run snapshot for comparison when `expected*` omitted |
| `write-baseline` | `true` | Update baseline after success |
| `deep` | `false` | Use deep check pricing |

### Secrets

Store the payer key as `X402CHECK_PAYER_KEY` (never commit it). Fund it with a little USDC on Base for paid checks after the free check is used.

### Outputs

- `results` — JSON array of per-URL results
- `drifted` — `true` / `false`

## Pricing reminder

- **$0.01** regular check · **$0.05** deep · **1 free** regular check per wallet via `/preflight/free/challenge`
- Watch plan: **$5 / 30 days** on x402check.dev

## Local / tests

```bash
npm install
npm test
```

Unit tests cover parsing and drift detection (no network).

## Tag

Published as git tag **`v1`** (moving major). Pin `@v1` or a commit SHA.

> Not listed on the GitHub Marketplace yet — use the repo reference above.

## Related

- Examples: [nwilliams005/x402check-examples](https://github.com/nwilliams005/x402check-examples)
- Docs: https://x402check.dev/llms.txt
