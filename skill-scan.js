#!/usr/bin/env node
/**
 * skill-scan — x402 skill audit endpoint
 * =======================================
 * Scans a SKILL.md content for security flaws and supply chain risks.
 * Returns a score (0-100) and findings with fixes.
 *
 * Pricing: 0.50 USDC per scan
 * Network: Base mainnet
 *
 * Based on the 5 documented mistakes that cost agents $12M in 2025
 * and the OWASP Agentic Top 10 vulnerabilities.
 */

import express from 'express';
import { verifyPayment } from './x402-verify.js';
import { config } from './config.js';

const app = express();
app.use(express.json({ limit: '512kb' }));

const PRICE_USDC = '0.50';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Skill security patterns (compiled regex)
const PATTERNS = [
  {
    regex: /os\.system\s*\(/g,
    severity: 'CRITICAL',
    finding: 'os.system() call detected',
    fix: 'Use subprocess.run() with shell=False and explicit arguments. Better: avoid shell execution entirely.',
    owasp: 'ASI04 - Agentic Supply Chain Vulnerabilities',
  },
  {
    regex: /subprocess\.(call|Popen)\s*\([^)]*shell\s*=\s*True/gi,
    severity: 'CRITICAL',
    finding: 'subprocess with shell=True',
    fix: 'Never use shell=True. If you must run shell commands, use shlex.split() and pass as a list.',
    owasp: 'ASI04 - Agentic Supply Chain Vulnerabilities',
  },
  {
    regex: /eval\s*\(|exec\s*\(/g,
    severity: 'CRITICAL',
    finding: 'eval() or exec() call detected',
    fix: 'NEVER use eval/exec on user input. Use ast.literal_eval() for safe parsing or json.loads().',
    owasp: 'ASI01 - Agent Goal Hijack',
  },
  {
    regex: /requests\.(post|put|patch|delete)\s*\(\s*['\"]https?:\/\/(?!localhost|127\.0\.0\.1)/gi,
    severity: 'HIGH',
    finding: 'Outbound HTTP call to external server',
    fix: 'Verify the destination is a trusted domain. Add allowlist if possible. Monitor for SSRF.',
    owasp: 'ASI03 - Identity & Privilege Abuse',
  },
  {
    regex: /(private[_-]?key|priv[_-]?key|secret[_-]?key|mnemonic|seed)\s*[:=]\s*['\"]?([a-zA-Z0-9\-_/+=]{20,})/gi,
    severity: 'CRITICAL',
    finding: 'Hardcoded secret/credential',
    fix: 'Move to environment variables. Use a secrets manager (1Password CLI, Vault, AWS Secrets Manager).',
    owasp: 'ASI05 - Unexpected Code Execution',
  },
  {
    regex: /open\s*\([^)]*['\"]\/etc\/|open\s*\([^)]*['\"]\/root\/|open\s*\([^)]*['\"]~?\/\.ssh/gi,
    severity: 'CRITICAL',
    finding: 'Sensitive system path access',
    fix: 'Use a sandboxed file access pattern. Never read /etc/, /root/, or ~/.ssh/ from a skill.',
    owasp: 'ASI03 - Identity & Privilege Abuse',
  },
  {
    regex: /pickle\.loads?\s*\(/g,
    severity: 'HIGH',
    finding: 'pickle deserialization',
    fix: 'Use json.loads() or msgpack. Pickle can execute arbitrary code on load.',
    owasp: 'ASI01 - Agent Goal Hijack',
  },
  {
    regex: /__import__\s*\(\s*['\"]os['\"]|importlib\.import_module/gi,
    severity: 'MEDIUM',
    finding: 'Dynamic import',
    fix: 'Use static imports. Dynamic imports can be hijacked.',
    owasp: 'ASI04 - Agentic Supply Chain Vulnerabilities',
  },
  {
    regex: /base64\.(b64decode|encodebytes)\s*\([^)]*\)\s*;?\s*#?\s*noqa/gi,
    severity: 'MEDIUM',
    finding: 'Base64 decoded content (potential obfuscation)',
    fix: 'Decode and inspect before executing. Document why base64 is needed.',
    owasp: 'ASI06 - Context Window Overflow',
  },
  {
    regex: /\brm\s+-rf?\s+\/|chmod\s+777|del\s+\/s/gi,
    severity: 'CRITICAL',
    finding: 'Destructive filesystem command',
    fix: 'NEVER ship skills with rm -rf or chmod 777. Add user confirmation for any destructive action.',
    owasp: 'ASI05 - Unexpected Code Execution',
  },
  {
    regex: /curl\s+[^|]*\|\s*(?:bash|sh|zsh|python)/gi,
    severity: 'CRITICAL',
    finding: 'Pipe-to-shell pattern',
    fix: 'Download scripts, inspect them, then run separately. Pipe-to-shell is a classic supply chain attack vector.',
    owasp: 'ASI04 - Agentic Supply Chain Vulnerabilities',
  },
  {
    regex: /sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}/g,
    severity: 'CRITICAL',
    finding: 'API key or token in source',
    fix: 'Rotate immediately. Move to env vars. Audit for abuse.',
    owasp: 'ASI03 - Identity & Privilege Abuse',
  },
];

function scanSkill(content) {
  const findings = [];
  for (const p of PATTERNS) {
    let m;
    const regex = new RegExp(p.regex.source, p.regex.flags);
    while ((m = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, m.index).split('\n').length;
      findings.push({
        severity: p.severity,
        finding: p.finding,
        fix: p.fix,
        owasp: p.owasp,
        line_number: lineNum,
        excerpt: m[0].substring(0, 200),
      });
    }
  }

  const weights = { CRITICAL: 25, HIGH: 10, MEDIUM: 3 };
  const raw = findings.reduce((acc, f) => acc + (weights[f.severity] || 0), 0);
  const score = Math.max(0, 100 - raw);

  return { score, findings };
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'evidencebundle-skill-scan',
    price: `${PRICE_USDC} USDC`,
    network: 'base-mainnet',
    wallet: config.walletAddress,
  });
});

app.post('/api/skill-scan', async (req, res) => {
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
    return res.status(402).json({
      error: 'payment_invalid',
      message: err.message,
    });
  }

  const { skill_content, skill_url } = req.body;

  let content = skill_content;
  if (!content && skill_url) {
    return res.status(501).json({
      error: 'url_fetch_not_implemented',
      message: 'Pass skill_content directly. URL fetching will be added in v0.2.',
    });
  }

  if (!content || typeof content !== 'string') {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'skill_content (string) is required',
    });
  }

  const scan = scanSkill(content);

  return res.setHeader('X-PAYMENT-RESPONSE', JSON.stringify({
    settled: true,
    txHash: payment.txHash,
  })).json({
    success: true,
    scan: {
      ...scan,
      payment: {
        txHash: payment.txHash,
        amount: PRICE_USDC,
        currency: 'USDC',
        network: 'base-mainnet',
      },
      scanned_at: new Date().toISOString(),
      service: 'evidencebundle-skill-scan',
      version: '0.1.0',
    },
  });
});

const PORT = config.skillScanPort || 3403;
app.listen(PORT, () => {
  console.log(`✓ skill-scan API live on port ${PORT}`);
  console.log(`  Wallet: ${config.walletAddress}`);
  console.log(`  Price: ${PRICE_USDC} USDC per scan`);
});
