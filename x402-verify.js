/**
 * x402-verify.js — Verify x402 payment receipts
 *
 * In production, this would call a facilitator API (e.g., facilitator.x402.org)
 * to verify the payment on-chain.
 *
 * For the MVP / test mode, we accept any payment header and verify a minimal
 * structure. The production version should:
 *   1. POST to facilitator with the payment receipt
 *   2. Verify the txHash on Base via Basescan or RPC
 *   3. Verify the USDC transfer went to our wallet
 *   4. Verify the amount >= required price
 */

export async function verifyPayment(paymentHeader, requiredAmount, recipientWallet) {
  // Parse the payment header
  let payment;
  try {
    payment = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8')
    );
  } catch (err) {
    throw new Error('Invalid X-PAYMENT header encoding');
  }

  // Minimal validation
  if (!payment.txHash) {
    throw new Error('Payment missing txHash');
  }

  if (!payment.network || payment.network !== 'base-mainnet') {
    throw new Error(`Unsupported network: ${payment.network}`);
  }

  if (!payment.amount || parseFloat(payment.amount) < parseFloat(requiredAmount)) {
    throw new Error(`Payment amount ${payment.amount} below required ${requiredAmount}`);
  }

  // In production: call facilitator here
  // const verified = await fetch('https://facilitator.x402.org/verify', { ... })
  // For MVP, we accept the payment as stated
  // TODO: replace with real facilitator call

  return {
    txHash: payment.txHash,
    amount: payment.amount,
    currency: payment.currency || 'USDC',
    payer: payment.payer || 'unknown',
    network: payment.network,
  };
}
