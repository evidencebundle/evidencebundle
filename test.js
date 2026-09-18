#!/usr/bin/env node
/**
 * test.js — basic test of the bundle endpoint
 *
 * Run after starting the server with `npm start`:
 *   node test.js
 */

const http = require('http');

const TEST_PAYLOAD = `My AI delivered this content. I want it signed as evidence for my client.
Generated at ${new Date().toISOString()}.`;

// Fake payment header for testing
const fakePayment = Buffer.from(JSON.stringify({
  txHash: '0x' + 'a'.repeat(64),
  amount: '0.10',
  currency: 'USDC',
  payer: '0xtest0000000000000000000000000000000000001',
  network: 'base-mainnet',
})).toString('base64');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3402,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Test 1: POST without payment → expect 402');
  const r1 = await post('/api/bundle', { payload: TEST_PAYLOAD });
  console.log('  Status:', r1.status);
  console.log('  Body:', JSON.stringify(r1.body, null, 2).substring(0, 500));
  console.log();

  console.log('Test 2: POST with payment → expect 200 + bundle');
  const r2 = await post('/api/bundle', { payload: TEST_PAYLOAD, type: 'text' }, {
    'X-PAYMENT': fakePayment,
  });
  console.log('  Status:', r2.status);
  console.log('  Bundle ID:', r2.body.bundle?.bundleId);
  console.log('  Content hash:', r2.body.bundle?.contentHash);
  console.log('  TX hash:', r2.body.bundle?.payment?.txHash);
  console.log();

  console.log('Test 3: GET /.well-known/x402-discovery → expect 200');
  const r3 = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3402, path: '/.well-known/x402-discovery', method: 'GET',
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.end();
  });
  console.log('  Status:', r3.status);
  console.log('  Wallet:', r3.body.wallet);
  console.log('  Price:', r3.body.endpoints[0].price, r3.body.endpoints[0].currency);
}

main().catch(console.error);
