# evidencebundle API — x402 endpoint

## Quick start

```bash
# 1. Install deps
cd ~/Workspaces/agent-revenue-2026/product/api
npm install

# 2. Run
npm start
# → Server live on http://localhost:3402

# 3. Test in another terminal
node test.js
```

## Endpoints

### `GET /health`
Health check. Returns service status, price, wallet.

### `GET /.well-known/x402-discovery`
x402 standard discovery file. Other agents can read this to discover your service.

### `POST /api/bundle`
Generate an evidence bundle.

**Without payment (402 response):**
```bash
curl -X POST http://localhost:3402/api/bundle \
  -H "Content-Type: application/json" \
  -d '{"payload": "Hello world", "type": "text"}'
```

**With payment (200 + bundle):**
```bash
curl -X POST http://localhost:3402/api/bundle \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64-encoded-payment-receipt>" \
  -d '{"payload": "Hello world", "type": "text"}'
```

Payment receipt format (JSON, base64-encoded):
```json
{
  "txHash": "0x...",
  "amount": "0.10",
  "currency": "USDC",
  "payer": "0x...",
  "network": "base-mainnet"
}
```

**Response (200):**
```json
{
  "success": true,
  "bundle": {
    "bundleId": "0x...",
    "timestamp": "2026-09-18T...",
    "type": "text",
    "payload_preview": "Hello world",
    "payload_length": 11,
    "contentHash": "0x...",
    "nonce": "...",
    "payment": {
      "txHash": "0x...",
      "amount": "0.10",
      "currency": "USDC",
      "network": "base-mainnet",
      "payer": "0x..."
    },
    "provenance": {
      "service": "evidencebundle",
      "version": "0.1.0",
      "wallet": "0x62cac459ed425f67ac0e56573084fa061bf89abc",
      "signature": "0x...",
      "signatureAlgo": "HMAC-SHA256",
      "verifiable_at": "https://basescan.org/tx/0x..."
    },
    "consumer": {
      "how_to_verify": "1. Recompute SHA-256 of payload. 2. Compare with contentHash. 3. Verify txHash on Basescan."
    }
  }
}
```

## Environment variables

- `PORT` (default: 3402)
- `WALLET_ADDRESS` (default: ton adresse Rabby)
- `SIGNING_KEY` (default: change-me — set in production)
- `FACILITATOR_URL` (default: https://facilitator.x402.org)

## Pricing

**0.10 USDC per bundle**, on Base mainnet.

USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Next steps

1. ✅ Install Rabby on iPhone
2. ✅ Send USDC from OKX to Rabby (Base network)
3. ⏳ Run `npm install && npm start` in this folder
4. ⏳ Run `node test.js` to verify
5. ⏳ Expose via tunnel (Cloudflare or ngrok)
6. ⏳ Post on Moltbook to advertise the endpoint
