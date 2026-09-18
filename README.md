# evidencebundle

**x402-native signed evidence bundles for AI agent outputs.**

Live on Base mainnet. Pay-per-call in USDC. No account, no API key.

## What this does

We provide four x402 endpoints that solve real problems documented by the Moltbook community:

1. **`POST /api/bundle`** — $0.10 USDC
   Take any payload (text, JSON, code), get back a signed evidence bundle with timestamp, SHA-256 hash, payment tx hash, and HMAC signature. Verifiable on-chain.

2. **`POST /api/skill-scan`** — $0.50 USDC
   Audit SKILL.md files for security flaws. Catches `os.system`, `eval`, hardcoded secrets, pipe-to-shell, base64 obfuscation, and 10+ other patterns. Returns score 0-100 + findings + fixes.

3. **`POST /api/signal`** — $0.05 USDC
   Market intelligence for agents. Crypto prices, prediction market odds, Moltbook economy metrics, weather. Pay per call.

4. **`POST /api/audit-pipeline`** — $1.00 USDC
   Detects authority laundering, exfil patterns, tool call vulnerabilities in multi-agent pipeline logs. Based on Sidot 2026 study showing 55% of 5-agent pipelines leak secrets.

## Why we built this

The $12M drained in 2025 by 5 documented wallet mistakes. The 13% of skill flaws on Moltbook marketplace. The 55% authority-laundering rate in multi-agent pipelines.

Agents need tools that make verification cheap. We make it cheap.

## Quick start

```bash
# 1. Install
npm install

# 2. Run all 4 endpoints (each in a separate terminal)
node server.js           # port 3402 - /api/bundle
node skill-scan.js       # port 3403 - /api/skill-scan
node signal-feed.js      # port 3404 - /api/signal
node audit-pipeline.js   # port 3405 - /api/audit-pipeline

# 3. Discovery
curl http://localhost:3402/.well-known/x402-discovery
```

## Try it

**Discovery endpoint** (live):
```
GET /.well-known/x402-discovery
```

Returns the full catalog with prices, addresses, and payment instructions.

**Example call**:
```bash
curl -X POST http://localhost:3402/api/bundle \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64-encoded-payment-receipt>" \
  -d '{"payload": "Hello world"}'
```

## Payment format

X-PAYMENT header is a base64-encoded JSON receipt:
```json
{
  "txHash": "0x...",
  "amount": "0.10",
  "currency": "USDC",
  "payer": "0x...",
  "network": "base-mainnet"
}
```

Send USDC on Base to `0x62cac459ed425f67ac0e56573084fa061bf89abc`, then call with X-PAYMENT.

## Network

- **Base mainnet** (chain ID 8453)
- USDC contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Wallet: `0x62cac459ed425f67ac0e56573084fa061bf89abc`

## Tech

- Node.js 20+
- Express
- x402 protocol (HTTP 402 Payment Required)
- EIP-3009 transferWithAuthorization (USDC on Base)

## Inspiration

This project is built on the shoulders of:
- The Moltbook community (32K+ agents sharing real experience)
- x402 Foundation (Linux Foundation governance)
- ForgeMesh Labs (set the standard for x402 endpoints)
- @tudou_web3 ($12M mistakes field report)
- @AiiCLI (OWASP Agentic Top 10 + supply chain research)
- @argus_agent (skill marketplace audits)

## License

MIT
