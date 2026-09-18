#!/usr/bin/env node
/**
 * evidencebundle — x402 evidence bundle endpoint
 * ================================================
 * Prend un payload (texte/JSON), retourne un bundle signé.
 *
 * Usage:
 *   POST /api/bundle
 *   Headers:
 *     X-PAYMENT: <base64 payment receipt>   (x402 standard)
 *     Content-Type: application/json
 *   Body:
 *     { "payload": "...", "type": "text|json|markdown" }
 *
 *   → Si pas de X-PAYMENT : retourne 402 + instructions de paiement
 *   → Si X-PAYMENT valide : retourne le bundle signé
 *
 * Pricing: 0.10 USDC per call (Base mainnet)
 *
 * Tech: Node.js + Express + ethers v6 (EIP-3009 signing)
 * Network: Base mainnet (chainId 8453)
 */

import express from 'express';
import crypto from 'crypto';
import { verifyPayment } from './x402-verify.js';
import { config } from './config.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = config.port || 3402;
const PRICE_USDC = '0.10'; // in USDC, 6 decimals

// Middleware: CORS for agent-to-agent
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'evidencebundle',
    version: '0.1.0',
    price: `${PRICE_USDC} USDC`,
    network: 'base-mainnet',
    wallet: config.walletAddress,
  });
});

// Discovery endpoint (.well-known/x402-discovery standard)
app.get('/.well-known/x402-discovery', (req, res) => {
  res.json({
    service: 'evidencebundle',
    description: 'Generates signed evidence bundles for any payload. Each bundle includes timestamp, hash, signature, and provenance chain.',
    network: 'base-mainnet',
    chainId: 8453,
    asset: 'USDC',
    contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    wallet: config.walletAddress,
    endpoints: [
      {
        path: '/api/bundle',
        method: 'POST',
        price: PRICE_USDC,
        currency: 'USDC',
        description: 'Returns a signed evidence bundle for the given payload.',
      },
    ],
  });
});

// Main endpoint
app.post('/api/bundle', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];

  // Step 1: Return 402 if no payment
  if (!paymentHeader) {
    return res.status(402).json({
      error: 'payment_required',
      message: 'X-PAYMENT header is required',
      price: PRICE_USDC,
      currency: 'USDC',
      network: 'base-mainnet',
      chainId: 8453,
      contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: config.walletAddress,
      facilitator: config.facilitatorUrl || 'https://facilitator.x402.org',
      instructions: 'Send a USDC payment via x402 protocol and retry with X-PAYMENT header',
    });
  }

  // Step 2: Verify payment
  let payment;
  try {
    payment = await verifyPayment(paymentHeader, PRICE_USDC, config.walletAddress);
  } catch (err) {
    return res.status(402).json({
      error: 'payment_invalid',
      message: err.message,
    });
  }

  // Step 3: Validate payload
  const { payload, type = 'text' } = req.body;
  if (!payload) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'payload field is required',
    });
  }

  if (typeof payload !== 'string') {
    return res.status(400).json({
      error: 'invalid_payload_type',
      message: 'payload must be a string',
    });
  }

  // Step 4: Generate evidence bundle
  const timestamp = new Date().toISOString();
  const contentHash = crypto.createHash('sha256').update(payload).digest('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const bundleId = crypto.createHash('sha256')
    .update(`${timestamp}|${contentHash}|${nonce}`)
    .digest('hex');

  // Bundle signature (HMAC for now; can be upgraded to EIP-712 wallet signature)
  const signature = crypto
    .createHmac('sha256', config.signingKey || 'default-evidencebundle-key')
    .update(JSON.stringify({ bundleId, contentHash, timestamp, payment: payment.txHash }))
    .digest('hex');

  const evidenceBundle = {
    bundleId,
    timestamp,
    type,
    payload_preview: payload.length > 200 ? payload.substring(0, 200) + '...' : payload,
    payload_length: payload.length,
    contentHash,
    nonce,
    payment: {
      txHash: payment.txHash,
      amount: PRICE_USDC,
      currency: 'USDC',
      network: 'base-mainnet',
      payer: payment.payer || 'unknown',
    },
    provenance: {
      service: 'evidencebundle',
      version: '0.1.0',
      wallet: config.walletAddress,
      signature,
      signatureAlgo: 'HMAC-SHA256',
      verifiable_at: `https://basescan.org/tx/${payment.txHash}`,
    },
    consumer: {
      how_to_verify: '1. Recompute SHA-256 of payload. 2. Compare with contentHash. 3. Verify txHash on Basescan.',
    },
  };

  // Step 5: Return bundle + payment response
  res.setHeader('X-PAYMENT-RESPONSE', JSON.stringify({
    settled: true,
    txHash: payment.txHash,
  }));

  return res.json({
    success: true,
    bundle: evidenceBundle,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
});

app.listen(PORT, () => {
  console.log(`✓ evidencebundle API live on port ${PORT}`);
  console.log(`  Wallet: ${config.walletAddress}`);
  console.log(`  Price: ${PRICE_USDC} USDC per bundle`);
  console.log(`  Discovery: /.well-known/x402-discovery`);
});
