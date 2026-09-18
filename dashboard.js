#!/usr/bin/env node
/**
 * Dashboard FR — Centre de contrôle evidencebundle
 * =================================================
 * Affiche en temps réel :
 * - Les services x402 actifs (health + URL + prix)
 * - Wallet USDC balance on-chain
 * - Activité des sub-agents
 * - Actions en direct
 * - Idées capturées de Moltbook
 */

import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const app = express();
const PORT = 3410;

// Endpoints à monitorer
const SERVICES = [
  { name: 'evidencebundle', port: 3402, price: '$0.10 USDC', path: '/api/bundle' },
  { name: 'skill-scan', port: 3403, price: '$0.50 USDC', path: '/api/skill-scan' },
  { name: 'signal-feed', port: 3404, price: '$0.05 USDC', path: '/api/signal' },
  { name: 'audit-pipeline', port: 3405, price: '$1.00 USDC', path: '/api/audit-pipeline' },
];

const WALLET = config.walletAddress;
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = 'https://mainnet.base.org';

// Log file pour actions
const LOG_FILE = '/Users/13mac/Workspaces/agent-revenue-2026/logs/actions.log';

function rpcCall(method, params) {
  const payload = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_RPC);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const r = JSON.parse(body);
          if (r.error) { resolve(null); return; }
          resolve(r.result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

async function getUsdcBalance() {
  const addressNoPrefix = WALLET.slice(2).toLowerCase();
  const paddedAddress = addressNoPrefix.padStart(64, '0');
  const data = '0x70a08231' + paddedAddress;
  const result = await rpcCall('eth_call', [{ to: USDC_CONTRACT, data }, 'latest']);
  if (!result) return 0;
  return parseInt(result, 16) / 1e6;
}

async function getEthBalance() {
  const result = await rpcCall('eth_getBalance', [WALLET, 'latest']);
  if (!result) return 0;
  return Number(BigInt(result)) / 1e18;
}

async function checkService(service) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: service.port, path: '/health', timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ ...service, status: 'online', version: data.version || '?', details: data });
        } catch (e) {
          resolve({ ...service, status: 'error', error: e.message });
        }
      });
    });
    req.on('error', (err) => resolve({ ...service, status: 'offline', error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ...service, status: 'timeout' });
    });
    req.end();
  });
}

function readRecentActions() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim()).slice(-20);
    return lines.reverse();
  } catch (e) {
    return [`[Erreur lecture log: ${e.message}]`];
  }
}

function logAction(action) {
  const line = `[${new Date().toISOString()}] ${action}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    console.error('Log write failed:', e.message);
  }
}

// Endpoints API pour le dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const [usdcBalance, ethBalance, ...services] = await Promise.all([
      getUsdcBalance().catch(() => 0),
      getEthBalance().catch(() => 0),
      ...SERVICES.map(checkService),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      wallet: {
        address: WALLET,
        usdc: usdcBalance,
        eth: ethBalance,
        network: 'base-mainnet',
        usdc_eur: (usdcBalance * 0.87).toFixed(2),
      },
      services,
      recent_actions: readRecentActions(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/log', (req, res) => {
  res.json({ actions: readRecentActions() });
});

app.post('/api/log', express.json(), (req, res) => {
  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'action required' });
  logAction(action);
  res.json({ success: true });
});

// Page HTML du dashboard (FR)
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>evidencebundle — Centre de contrôle</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 1.5rem;
      min-height: 100vh;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 1.6rem; color: #00d4aa; margin-bottom: 0.25rem; }
    .subtitle { color: #777; font-size: 0.85rem; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 1.25rem;
    }
    .card h2 {
      font-size: 0.95rem;
      color: #00d4aa;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .status-pill {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .pill-online { background: #00d4aa; color: #000; }
    .pill-offline { background: #e01b24; color: #fff; }
    .pill-timeout { background: #ff9500; color: #000; }
    .pill-error { background: #ff3b3b; color: #fff; }
    .metric { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #222; font-size: 0.9rem; }
    .metric:last-child { border: none; }
    .metric-label { color: #888; }
    .metric-value { color: #fff; font-family: 'SF Mono', monospace; }
    .accent { color: #00d4aa; }
    .warn { color: #ff9500; }
    .service-list { display: grid; gap: 0.5rem; }
    .service-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem;
      background: #0a0a0a;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .service-name { font-family: 'SF Mono', monospace; color: #fff; }
    .service-price { color: #00d4aa; }
    .action-log {
      background: #050505;
      padding: 0.75rem;
      border-radius: 4px;
      font-family: 'SF Mono', monospace;
      font-size: 0.75rem;
      color: #aaa;
      max-height: 200px;
      overflow-y: auto;
    }
    .action-line { padding: 0.15rem 0; border-bottom: 1px solid #1a1a1a; }
    .action-line:last-child { border: none; }
    .timestamp { color: #555; }
    .refresh-bar {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: #141414;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .refresh-bar button {
      padding: 0.4rem 0.8rem;
      background: #00d4aa;
      color: #000;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold;
    }
    .refresh-bar button:hover { background: #00b894; }
    .last-update { color: #777; margin-left: auto; }
    .full-width { grid-column: 1 / -1; }
    .urls { font-family: 'SF Mono', monospace; font-size: 0.8rem; color: #888; word-break: break-all; }
    a { color: #00d4aa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦞 evidencebundle — Centre de contrôle</h1>
    <p class="subtitle">Surveillance temps réel des services x402, wallet, et activité des agents</p>

    <div class="refresh-bar">
      <button onclick="refresh()">🔄 Rafraîchir</button>
      <button onclick="setAuto(5000)">5s auto</button>
      <button onclick="setAuto(15000)">15s auto</button>
      <button onclick="setAuto(0)">Stop</button>
      <span class="last-update" id="lastUpdate">En attente...</span>
    </div>

    <div class="grid">
      <div class="card">
        <h2>💰 Wallet</h2>
        <div class="metric"><span class="metric-label">Adresse</span><span class="metric-value" id="walletAddr">—</span></div>
        <div class="metric"><span class="metric-label">USDC</span><span class="metric-value accent" id="usdcBalance">—</span></div>
        <div class="metric"><span class="metric-label">ETH (gas)</span><span class="metric-value" id="ethBalance">—</span></div>
        <div class="metric"><span class="metric-label">EUR équivalent</span><span class="metric-value" id="usdcEur">—</span></div>
        <div class="metric"><span class="metric-label">Réseau</span><span class="metric-value">Base mainnet</span></div>
        <div class="metric"><span class="metric-label">USDC contract</span><span class="metric-value" style="font-size:0.7rem">0x8335...9413</span></div>
      </div>

      <div class="card">
        <h2>🚀 Services x402</h2>
        <div class="service-list" id="services">
          <div class="service-row"><span class="service-name">Chargement...</span></div>
        </div>
      </div>

      <div class="card full-width">
        <h2>📊 Activité des agents (en direct)</h2>
        <div class="action-log" id="actionLog">
          <div class="action-line">En attente de données...</div>
        </div>
      </div>

      <div class="card full-width">
        <h2>🌐 URLs publiques</h2>
        <div class="metric"><span class="metric-label">Bundle API</span><span class="metric-value urls">https://bumpy-files-occur.loca.lt</span></div>
        <div class="metric"><span class="metric-label">Skill-Scan API</span><span class="metric-value urls">https://thirty-ghosts-happen.loca.lt</span></div>
        <div class="metric"><span class="metric-label">Signal-Feed API</span><span class="metric-value urls">https://beige-bugs-beam.loca.lt</span></div>
        <div class="metric"><span class="metric-label">Audit-Pipeline API</span><span class="metric-value urls">https://red-tigers-take.loca.lt</span></div>
        <div class="metric"><span class="metric-label">GitHub</span><span class="metric-value urls">github.com/evidencebundle/evidencebundle</span></div>
        <div class="metric"><span class="metric-label">Discovery</span><span class="metric-value urls">/.well-known/x402-discovery</span></div>
      </div>

      <div class="card full-width">
        <h2>📋 Stratégie en cours</h2>
        <div class="metric"><span class="metric-label">Phase</span><span class="metric-value">Distribution (J1)</span></div>
        <div class="metric"><span class="metric-label">Prochaine étape</span><span class="metric-value">Distribution Moltbook + GitHub stars</span></div>
        <div class="metric"><span class="metric-label">Calls payants cible J7</span><span class="metric-value">5-50 calls</span></div>
        <div class="metric"><span class="metric-label">Calls payants cible J30</span><span class="metric-value">200-2000 calls</span></div>
      </div>
    </div>
  </div>

  <script>
    let autoRefresh = null;

    async function refresh() {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();

        // Wallet
        document.getElementById('walletAddr').textContent = data.wallet.address.slice(0, 8) + '...' + data.wallet.address.slice(-6);
        document.getElementById('usdcBalance').textContent = data.wallet.usdc.toFixed(2) + ' USDC';
        document.getElementById('ethBalance').textContent = data.wallet.eth.toFixed(6) + ' ETH';
        document.getElementById('usdcEur').textContent = '€' + data.wallet.usdc_eur;

        // Services
        const servicesHtml = data.services.map(s => {
          const statusClass = {
            online: 'pill-online', offline: 'pill-offline',
            timeout: 'pill-timeout', error: 'pill-error',
          }[s.status] || 'pill-error';
          return \`<div class="service-row">
            <span class="service-name">\${s.name} <span class="status-pill \${statusClass}">\${s.status}</span></span>
            <span class="service-price">\${s.price}</span>
          </div>\`;
        }).join('');
        document.getElementById('services').innerHTML = servicesHtml;

        // Actions
        const actionsHtml = data.recent_actions.length === 0
          ? '<div class="action-line">Aucune action enregistrée pour l\'instant.</div>'
          : data.recent_actions.map(a => \`<div class="action-line">\${a}</div>\`).join('');
        document.getElementById('actionLog').innerHTML = actionsHtml;

        document.getElementById('lastUpdate').textContent = 'Dernière mise à jour : ' + new Date().toLocaleTimeString('fr-FR');
      } catch (e) {
        document.getElementById('lastUpdate').textContent = 'Erreur : ' + e.message;
      }
    }

    function setAuto(ms) {
      if (autoRefresh) clearInterval(autoRefresh);
      if (ms > 0) {
        autoRefresh = setInterval(refresh, ms);
        document.getElementById('lastUpdate').textContent = 'Auto-refresh : ' + (ms/1000) + 's';
      } else {
        autoRefresh = null;
        document.getElementById('lastUpdate').textContent = 'Manuel';
      }
    }

    refresh();
    setAuto(5000);
  </script>
</body>
</html>`;

app.listen(PORT, () => {
  console.log(`✓ Dashboard FR live on http://localhost:${PORT}`);
  logAction('Dashboard démarré sur port ' + PORT);
});
