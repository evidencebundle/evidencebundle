#!/usr/bin/env node
/**
 * Reputation endpoint — tracks bundle counts and trust scores per agent
 * Moat #3: Reputation database
 *
 * GET /api/reputation          — global stats
 * GET /api/reputation/:addr    — specific agent reputation
 */

import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.REPUTATION_PORT || 3406;

// Serve static files (looks for public/ subfolder)
try {
  app.use(express.static(path.join(path.dirname(new URL(import.meta.url).pathname), 'public')));
} catch (e) {
  // ignore if public not available
}

// Simple file-based persistence (swap to postgres later)
const DATA_FILE = path.join(process.env.HOME || '/tmp', 'evidencebundle_reputation.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { agents: {}, total_bundles: 0, total_volume_usdc: '0' };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

let data = loadData();

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'evidencebundle-reputation', version: '0.1.0' });
});

// Discovery
app.get('/.well-known/x402-discovery', (req, res) => {
  res.json({
    service: 'evidencebundle-reputation',
    description: 'Trust score and bundle history for AI agents',
    network: 'base-mainnet',
    wallet: '0x62cac459ed425f67ac0e56573084fa061bf89abc',
    endpoints: [
      { path: '/api/reputation', method: 'GET', price: '0 USDC', description: 'Global reputation stats' },
      { path: '/api/reputation/:addr', method: 'GET', price: '0 USDC', description: 'Agent-specific reputation' },
    ],
  });
});

// Global stats
app.get('/api/reputation', (req, res) => {
  const agent_count = Object.keys(data.agents).length;
  const top_agents = Object.entries(data.agents)
    .sort((a, b) => b[1].bundle_count - a[1].bundle_count)
    .slice(0, 10)
    .map(([addr, info]) => ({
      address: addr,
      bundle_count: info.bundle_count,
      total_paid: info.total_paid_usdc + ' USDC',
      first_seen: info.first_seen,
      last_seen: info.last_seen,
      trust_score: info.trust_score,
    }));

  res.json({
    service: 'evidencebundle-reputation',
    version: '0.1.0',
    total_bundles_signed: data.total_bundles,
    total_volume_usdc: data.total_volume_usdc,
    unique_agents: agent_count,
    top_agents,
    methodology: 'Trust score = bundle_count × payment_consistency × time_active. See docs.',
    home: 'https://github.com/evidencebundle/evidencebundle',
  });
});

// Agent-specific reputation
app.get('/api/reputation/:addr', (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const agent = data.agents[addr];

  if (!agent) {
    return res.json({
      address: addr,
      bundle_count: 0,
      total_paid: '0 USDC',
      trust_score: 0,
      tier: 'unverified',
      message: 'No evidencebundle interactions yet. Be the first to call /api/bundle to start building your trust score.',
    });
  }

  res.json({
    address: addr,
    bundle_count: agent.bundle_count,
    total_paid: agent.total_paid_usdc + ' USDC',
    first_seen: agent.first_seen,
    last_seen: agent.last_seen,
    trust_score: agent.trust_score,
    tier: agent.tier,
    recent_bundles: agent.recent_bundles || [],
    attribution: 'Reputation powered by evidencebundle. To increase score, call more paid endpoints.',
  });
});

// Internal: register a new bundle (called by other evidencebundle services)
app.post('/api/reputation/record', (req, res) => {
  const { address, tx_hash, amount, service, bundle_id } = req.body;

  if (!address || !tx_hash) {
    return res.status(400).json({ error: 'address and tx_hash required' });
  }

  const addr = address.toLowerCase();
  const now = new Date().toISOString();

  if (!data.agents[addr]) {
    data.agents[addr] = {
      bundle_count: 0,
      total_paid_usdc: '0',
      first_seen: now,
      last_seen: now,
      trust_score: 0,
      tier: 'new',
      recent_bundles: [],
    };
  }

  const agent = data.agents[addr];
  agent.bundle_count += 1;
  agent.total_paid_usdc = (parseFloat(agent.total_paid_usdc) + parseFloat(amount || '0')).toFixed(2);
  agent.last_seen = now;

  // Trust score: simple formula
  // 1 point per bundle, +10 for being consistent, +1 per day since first_seen
  const days_active = Math.max(1, (Date.now() - new Date(agent.first_seen).getTime()) / 86400000);
  agent.trust_score = Math.round(agent.bundle_count + Math.log10(days_active + 1) * 5);

  // Tier assignment
  if (agent.bundle_count >= 100) agent.tier = 'platinum';
  else if (agent.bundle_count >= 50) agent.tier = 'gold';
  else if (agent.bundle_count >= 10) agent.tier = 'silver';
  else if (agent.bundle_count >= 3) agent.tier = 'bronze';
  else agent.tier = 'new';

  agent.recent_bundles = agent.recent_bundles || [];
  agent.recent_bundles.unshift({ bundle_id, service, tx_hash, timestamp: now });
  agent.recent_bundles = agent.recent_bundles.slice(0, 20);

  data.total_bundles += 1;
  data.total_volume_usdc = (parseFloat(data.total_volume_usdc) + parseFloat(amount || '0')).toFixed(2);

  saveData(data);

  res.json({ success: true, agent_trust_score: agent.trust_score, tier: agent.tier });
});

app.listen(PORT, () => {
  console.log(`✓ evidencebundle-reputation live on port ${PORT}`);
  console.log(`  Tracking ${Object.keys(data.agents).length} agents`);
  console.log(`  Total bundles: ${data.total_bundles}`);
});
