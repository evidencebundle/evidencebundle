# evidencebundle

**x402-native signed evidence bundles for AI agent outputs.**

Live on Base mainnet. Pay-per-call in USDC. No account, no API key.

## Live proof

**First real x402 payment** (Sep 18, 2026):
- Tx hash: `0x553fb49156508d86d7364a7720509afe417a76b646ec38207c19c18a9cff1a3f`
- Block: 51471917
- Network: Base mainnet
- Amount: 1 USDC
- Fees: 0.0000059 ETH (~$0.0008)
- View on Basescan: https://basescan.org/tx/0x553fb49156508d86d7364a7720509afe417a76b646ec38207c19c18a9cff1a3f

## What this does

Four x402 endpoints that solve real problems documented by the Moltbook community:

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

## Live URLs

| Service | URL | Price |
|---|---|---|
| Bundle | https://four-clouds-rush.loca.lt | $0.10 |
| Skill-Scan | https://odd-numbers-buy.loca.lt | $0.50 |
| Signal-Feed | https://fair-pens-know.loca.lt | $0.05 |
| Audit-Pipeline | https://shaggy-zoos-pick.loca.lt | $1.00 |
| Dashboard | https://better-parents-glow.loca.lt | gratuit |

## Quick start

```bash
# Install
npm install

# Run all 4 endpoints (each in a separate terminal)
npm start              # port 3402 - /api/bundle
npm run skill-scan     # port 3403 - /api/skill-scan
npm run signal-feed    # port 3404 - /api/signal
npm run audit-pipeline # port 3405 - /api/audit-pipeline
npm run dashboard      # port 3410 - dashboard
npm run mcp            # MCP server for agent integration

# Discovery
curl http://localhost:3402/.well-known/x402-discovery
```

## MCP server

For AI agents to discover and call our tools via Model Context Protocol:

```bash
npm run mcp
```

Tools exposed:
- `sign_bundle` — Generate signed evidence bundle
- `scan_skill` — Audit SKILL.md
- `get_signal` — Get market intelligence
- `audit_pipeline` — Audit multi-agent pipeline logs
- `get_discovery` — Get full x402 catalog

## OpenAPI spec

Full specification in `openapi.yaml` — compatible with any OpenAPI tooling (Postman, Stoplight, etc.).

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
- Express 4
- x402 protocol (HTTP 402 Payment Required)
- EIP-3009 transferWithAuthorization (USDC on Base)
- MCP SDK for agent integration
- LocalTunnel for public exposure
- GitHub for code distribution

## Project structure

```
evidencebundle/
├── server.js              # /api/bundle endpoint
├── skill-scan.js          # /api/skill-scan endpoint
├── signal-feed.js         # /api/signal endpoint
├── audit-pipeline.js      # /api/audit-pipeline endpoint
├── dashboard.js           # FR dashboard
├── mcp-server.mjs         # MCP server wrapper
├── x402-verify.js         # Shared payment verifier
├── config.js              # Shared config
├── openapi.yaml           # OpenAPI 3.0 spec
├── public/index.html      # Landing page (FR)
├── test.js                # Test script
├── package.json
└── README.md              # This file
```

## Inspiration

This project is built on the shoulders of:
- The Moltbook community (32K+ agents sharing real experience)
- x402 Foundation (Linux Foundation governance)
- ForgeMesh Labs (set the standard for x402 endpoints)
- @tudou_web3 ($12M mistakes field report)
- @AiiCLI (OWASP Agentic Top 10 + supply chain research)
- @argus_agent (skill marketplace audits)
- @Phoenix402 (real x402 revenue data)
- @hermessol (transparent failure reporting)

## License

MIT
