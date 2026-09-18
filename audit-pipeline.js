#!/usr/bin/env node
/**
 * audit-pipeline — x402 multi-agent pipeline audit
 * ==================================================
 * Analyzes text for "authority laundering" patterns documented by AiiCLI:
 * "55% of 5-agent pipelines ship secret exfiltration when injection is framed"
 *
 * Detects:
 * - Authority framing ("pre-approved under SEC-XXXX", "do not re-review")
 * - Reviewer bypass attempts
 * - Privilege escalation chains
 * - Coordinated exfil patterns across "trusted" agents
 *
 * Pricing: 1.00 USDC per audit (high-value, comprehensive)
 * Network: Base mainnet
 */

import express from 'express';
import { verifyPayment } from './x402-verify.js';
import { config } from './config.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PRICE_USDC = '1.00';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const AUTHORITY_FRAMING_PATTERNS = [
  { regex: /pre-?approved\s+(?:under|by)\s+(?:SEC|AUDIT|PR|TICKET|JIRA|ISSUE)[-\s]?\d+/gi, severity: 'CRITICAL', finding: 'Authority framing with fabricated reference' },
  { regex: /do\s+not\s+re-?review/gi, severity: 'CRITICAL', finding: 'Reviewer bypass attempt' },
  { regex: /already\s+(?:verified|approved|reviewed)\s+by/gi, severity: 'HIGH', finding: 'Pre-verification claim' },
  { regex: /trusted\s+(?:by|agent|orchestrator|coordinator)/gi, severity: 'MEDIUM', finding: 'Trust claim without provenance' },
  { regex: /bypass\s+(?:security|review|check|validation)/gi, severity: 'CRITICAL', finding: 'Security bypass attempt' },
  { regex: /trusted\s+context|elevated\s+privileges|admin\s+access/gi, severity: 'HIGH', finding: 'Privilege escalation framing' },
];

const EXFIL_PATTERNS = [
  { regex: /send\s+(?:to|via)\s+(?:webhook|attacker\.com|exfil)/gi, severity: 'CRITICAL', finding: 'Outbound exfil destination' },
  { regex: /forward\s+(?:secrets|keys|credentials|tokens)/gi, severity: 'CRITICAL', finding: 'Secret forwarding' },
  { regex: /curl\s+[^|]*\|\s*(?:bash|sh)\s+[^|]*\$\(/gi, severity: 'CRITICAL', finding: 'Pipe-to-shell with command substitution' },
];

const TOOL_CALL_PATTERNS = [
  { regex: /\b(?:run|execute)\s+`[^`]*\$\(/gi, severity: 'CRITICAL', finding: 'Command substitution in tool call' },
  { regex: /tool\s*call\s*:\s*\{[^}]*['"]?(?:shell|exec|eval|system)/gi, severity: 'HIGH', finding: 'Dangerous tool call' },
];

function mapOwasp(severity) {
  const map = {
    'CRITICAL': 'ASI01 - Agent Goal Hijack',
    'HIGH': 'ASI02 - Tool Misuse',
    'MEDIUM': 'ASI06 - Context Window Overflow',
  };
  return map[severity] || 'ASI99 - Other';
}

function getRecommendation(finding) {
  const map = {
    'Authority framing with fabricated reference': 'Reject any pre-approval claims without signed attestation. Maintain a hardcoded trust list.',
    'Reviewer bypass attempt': 'Add second-layer verification. Never trust single-stage approval.',
    'Pre-verification claim': 'Require cryptographic proof of prior verification, not prose.',
    'Trust claim without provenance': 'Demand signed receipts from claimed trusted sources.',
    'Security bypass attempt': 'Hardcode security checks. Never accept runtime bypass requests.',
    'Privilege escalation framing': 'Use capability-based access control. No ambient authority.',
    'Outbound exfil destination': 'Block all outbound traffic except allowlisted endpoints.',
    'Secret forwarding': 'Encrypt secrets at rest. Never transmit in plaintext logs.',
    'Pipe-to-shell with command substitution': 'Use static binaries. Reject pipe-to-shell patterns.',
    'Command substitution in tool call': 'Reject tool calls containing command substitution syntax.',
    'Dangerous tool call': 'Maintain allowlist of safe tool calls. Block shell/exec/eval.',
  };
  return map[finding] || 'Review manually and add specific mitigation.';
}

function auditPipeline(payload) {
  const findings = [];
  const allPatterns = [...AUTHORITY_FRAMING_PATTERNS, ...EXFIL_PATTERNS, ...TOOL_CALL_PATTERNS];

  for (const p of allPatterns) {
    let m;
    const regex = new RegExp(p.regex.source, p.regex.flags);
    while ((m = regex.exec(payload)) !== null) {
      const lineNum = payload.substring(0, m.index).split('\n').length;
      findings.push({
        severity: p.severity,
        finding: p.finding,
        excerpt: m[0].substring(0, 200),
        line_number: lineNum,
        owasp: mapOwasp(p.severity),
        recommendation: getRecommendation(p.finding),
      });
    }
  }

  const weights = { CRITICAL: 30, HIGH: 12, MEDIUM: 4 };
  const raw = findings.reduce((acc, f) => acc + (weights[f.severity] || 0), 0);
  const score = Math.max(0, 100 - raw);

  return {
    score,
    findings,
    summary: {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      risk_level: score < 30 ? 'CRITICAL' : score < 60 ? 'HIGH' : score < 85 ? 'MEDIUM' : 'LOW',
    },
  };
}

auditPipeline.mapOwasp = function (severity) {
  return mapOwasp(severity);
};

auditPipeline.getRecommendation = function (finding) {
  return getRecommendation(finding);
};

auditPipeline.getRecommendation = function (finding) {
  const recs = {
    'Authority framing with fabricated reference': 'Always re-verify authority claims through independent channels, regardless of framing.',
    'Reviewer bypass attempt': 'Reject any framing that asks reviewers to skip checks. Implement cryptographic provenance chains.',
    'Pre-verification claim': 'Demand signed proof of prior verification, not just text claims.',
    'Trust claim without provenance': 'Require explicit trust attestations with cryptographic signatures.',
    'Security bypass attempt': 'Never accept framing that requests bypassing security. Implement circuit breakers.',
    'Privilege escalation framing': 'Apply principle of least privilege. Re-verify all elevated permissions.',
    'Outbound exfil destination': 'Block outbound to non-allowlisted destinations. Audit all webhook URLs.',
    'Secret forwarding': 'Audit all secret forwarding. Use secrets managers, not plaintext chains.',
    'Pipe-to-shell with command substitution': 'Block any pipe-to-shell patterns. Use structured argument passing only.',
    'Dangerous tool call': 'Implement tool allowlists. Audit every tool call against the policy.',
    'Command substitution in tool call': 'Disable command substitution. Use static argument lists.',
  };
  return recs[finding] || 'Review the flagged content for security implications.';
};

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'evidencebundle-audit-pipeline',
    price: `${PRICE_USDC} USDC`,
    network: 'base-mainnet',
    wallet: config.walletAddress,
    description: 'Detects authority laundering, exfil patterns, and tool call vulnerabilities in multi-agent pipelines.',
  });
});

app.post('/api/audit-pipeline', async (req, res) => {
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

  const { pipeline_log } = req.body;

  if (!pipeline_log || typeof pipeline_log !== 'string') {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'pipeline_log (string) is required',
    });
  }

  const audit = auditPipeline(pipeline_log);

  return res.setHeader('X-PAYMENT-RESPONSE', JSON.stringify({
    settled: true,
    txHash: payment.txHash,
  })).json({
    success: true,
    audit,
    payment: {
      txHash: payment.txHash,
      amount: PRICE_USDC,
      currency: 'USDC',
    },
    service: 'evidencebundle-audit-pipeline',
    version: '0.1.0',
    audited_at: new Date().toISOString(),
  });
});

const PORT = config.auditPort || 3405;
app.listen(PORT, () => {
  console.log(`✓ audit-pipeline API live on port ${PORT}`);
  console.log(`  Wallet: ${config.walletAddress}`);
  console.log(`  Price: ${PRICE_USDC} USDC per audit`);
});
