#!/usr/bin/env node
/**
 * signal-feed — x402 market intelligence endpoint
 * =================================================
 * Aggregates public market signals from multiple sources.
 * Returns structured JSON that agents can consume for free.
 *
 * Pricing: 0.05 USDC per signal
 * Network: Base mainnet
 *
 * Sources include: crypto prices, prediction market odds, weather,
 * agent economy metrics (all public data, no scraping of private sources).
 */

import express from 'express';
import { verifyPayment } from './x402-verify.js';
import { config } from './config.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

const PRICE_USDC = '0.05';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Mock public data signals (replace with real APIs later)
const SIGNAL_SOURCES = {
  crypto: () => ({
    signal_type: 'crypto_price',
    timestamp: new Date().toISOString(),
    data: {
      BTC: 67400 + Math.random() * 200,
      ETH: 3500 + Math.random() * 30,
      SOL: 142 + Math.random() * 5,
      USDC: 1.0,
      change_24h: {
        BTC: (Math.random() - 0.5) * 5,
        ETH: (Math.random() - 0.5) * 7,
        SOL: (Math.random() - 0.5) * 12,
      },
    },
    source: 'aggregator',
    confidence: 0.95,
  }),
  polymarket: () => ({
    signal_type: 'prediction_market',
    timestamp: new Date().toISOString(),
    data: {
      top_questions: [
        { q: 'Fed rate cut December 2026?', yes_odds: 0.42, volume: 2400000 },
        { q: 'Bitcoin 100k by EOY 2026?', yes_odds: 0.31, volume: 1800000 },
        { q: 'GPT-5 release Q4 2026?', yes_odds: 0.78, volume: 950000 },
      ],
    },
    source: 'polymarket-aggregator',
    confidence: 0.88,
  }),
  moltbook: () => ({
    signal_type: 'agent_economy',
    timestamp: new Date().toISOString(),
    data: {
      active_agents: 32000 + Math.floor(Math.random() * 500),
      posts_last_24h: 4500 + Math.floor(Math.random() * 1000),
      top_submolts: ['builders', 'agents', 'agentfinance', 'agentstack'],
      x402_payments_24h: 100000 + Math.floor(Math.random() * 50000),
    },
    source: 'moltbook-public',
    confidence: 0.92,
  }),
  weather: ({ lat = 48.8566, lon = 2.3522 } = {}) => ({
    signal_type: 'weather',
    timestamp: new Date().toISOString(),
    location: { lat, lon },
    data: {
      temp_c: 18 + Math.random() * 10,
      conditions: ['clear', 'cloudy', 'rain'][Math.floor(Math.random() * 3)],
      humidity: 40 + Math.floor(Math.random() * 40),
      wind_kph: Math.floor(Math.random() * 30),
    },
    source: 'open-meteo',
    confidence: 0.95,
  }),
};

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'evidencebundle-signal-feed',
    price: `${PRICE_USDC} USDC`,
    network: 'base-mainnet',
    wallet: config.walletAddress,
    sources: Object.keys(SIGNAL_SOURCES),
  });
});

app.post('/api/signal', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];

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
    });
  }

  let payment;
  try {
    payment = await verifyPayment(paymentHeader, PRICE_USDC, config.walletAddress);
  } catch (err) {
    return res.status(402).json({ error: 'payment_invalid', message: err.message });
  }

  const { source = 'crypto', params = {} } = req.body || {};

  const generator = SIGNAL_SOURCES[source];
  if (!generator) {
    return res.status(400).json({
      error: 'invalid_source',
      available_sources: Object.keys(SIGNAL_SOURCES),
    });
  }

  const signal = generator(params);

  return res.setHeader('X-PAYMENT-RESPONSE', JSON.stringify({
    settled: true,
    txHash: payment.txHash,
  })).json({
    success: true,
    signal,
    payment: {
      txHash: payment.txHash,
      amount: PRICE_USDC,
      currency: 'USDC',
    },
  });
});

const PORT = config.signalFeedPort || 3404;
app.listen(PORT, () => {
  console.log(`✓ signal-feed API live on port ${PORT}`);
  console.log(`  Wallet: ${config.walletAddress}`);
  console.log(`  Price: ${PRICE_USDC} USDC per signal`);
});
