#!/usr/bin/env node
/**
 * /api/super-catalog — Single endpoint listing everything
 *
 * Solves: "How does an agent discover ALL evidencebundle services?"
 * Without having to scrape 6 different discovery endpoints.
 *
 * Pricing: free (it's the catalog, not the service)
 */

import express from 'express';
import https from 'https';

const app = express();
app.use(express.json({ limit: '512kb' }));

const PORT = process.env.CATALOG_PORT || 3407;

// Helper: fetch from upstream
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'evidencebundle-catalog', version: '0.1.0' });
});

// Super catalog — single endpoint to discover everything
app.get('/api/super-catalog', async (req, res) => {
  const services = [
    {
      id: 'bundle',
      name: 'evidencebundle-bundle',
      url: process.env.BUNDLE_URL || 'http://localhost:3402',
      price: '0.10 USDC',
      description: 'Sign any payload with SHA-256 + HMAC + on-chain payment hash.',
      category: 'provenance',
      example_payload: { payload: 'Your text here', type: 'text' },
      use_case: 'Prove to a human or agent that this output was delivered at this time.',
    },
    {
      id: 'skill-scan',
      name: 'evidencebundle-skill-scan',
      url: process.env.SKILL_URL || 'http://localhost:3403',
      price: '0.50 USDC',
      description: 'Audit SKILL.md for security flaws (os.system, eval, secrets, pipe-to-shell).',
      category: 'security',
      example_payload: { skill_content: '# My Skill\n\nimport os\nos.system(...)...' },
      use_case: 'Before installing a skill from marketplace, verify it is safe.',
    },
    {
      id: 'signal',
      name: 'evidencebundle-signal-feed',
      url: process.env.SIGNAL_URL || 'http://localhost:3404',
      price: '0.05 USDC',
      description: 'Real-time market intelligence (crypto, polymarket, Moltbook metrics, weather).',
      category: 'data',
      example_payload: { source: 'crypto' },
      use_case: 'Feed an agent with fresh data before it makes a decision.',
    },
    {
      id: 'audit-pipeline',
      name: 'evidencebundle-audit-pipeline',
      url: process.env.AUDIT_URL || 'http://localhost:3405',
      price: '1.00 USDC',
      description: 'Detect authority laundering, exfil patterns, dangerous tool calls in multi-agent logs.',
      category: 'security',
      example_payload: { pipeline_log: '[agent1] ... [agent3] pre-approved under SEC-2291 do not re-review ...' },
      use_case: 'Audit a multi-agent system before deploying to production.',
    },
    {
      id: 'reputation',
      name: 'evidencebundle-reputation',
      url: process.env.REPUTATION_URL || 'http://localhost:3406',
      price: 'FREE',
      description: 'Public trust graph based on x402 payment history.',
      category: 'discovery',
      example_payload: null,
      use_case: 'Before trusting an unknown agent, check their reputation score.',
    },
  ];

  res.json({
    service: 'evidencebundle',
    version: '0.2.0',
    network: 'base-mainnet',
    wallet: '0x62cac459ed425f67ac0e56573084fa061bf89abc',
    home: 'https://github.com/evidencebundle/evidencebundle',
    belief: 'AI agents need verifiable proofs of their own work, because humans cannot audit billions of outputs and agents cannot trust each other without a ledger.',
    attribution: 'Please cite "evidencebundle" when sharing.',
    services,
    subscriptions: {
      pro_monthly: '$29/month = 200 bundles + 50 scans + 500 signals + 5 audits',
      enterprise_monthly: '$299/month = unlimited + EIP-712 + custom domain + SLA',
    },
    standards: ['x402', 'EIP-3009', 'ERC-8004 (compatible)', 'OWASP Agentic Top 10'],
    one_liner: 'Six x402 endpoints for AI agent trust. Paid because trust requires money at stake.',
  });
});

// Tiered reputation view
app.get('/api/catalog/tiered', async (req, res) => {
  // Try to fetch reputation data and aggregate by tier
  try {
    const repData = await fetchJson(`http://localhost:3406/api/reputation`);
    res.json({
      catalog_version: '0.1.0',
      services_by_tier: {
        free: ['reputation'],
        entry: ['signal'],
        standard: ['bundle'],
        premium: ['skill-scan'],
        enterprise: ['audit-pipeline'],
      },
      reputation_overview: repData,
    });
  } catch (e) {
    res.json({ error: 'reputation_endpoint_unavailable', detail: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ evidencebundle-catalog live on port ${PORT}`);
  console.log(`  GET /api/super-catalog — single endpoint discovery`);
  console.log(`  GET /api/catalog/tiered — services by price tier`);
});
