/**
 * config.js — evidencebundle configuration
 *
 * Sourced from environment variables (12-factor app pattern).
 * No secrets in code. Wallet address is NOT a secret.
 */

export const config = {
  port: parseInt(process.env.PORT || '3402'),
  skillScanPort: parseInt(process.env.SKILL_SCAN_PORT || '3403'),
  walletAddress: process.env.WALLET_ADDRESS || '0x62cac459ed425f67ac0e56573084fa061bf89abc',
  signingKey: process.env.SIGNING_KEY || 'default-evidencebundle-key-change-me',
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.x402.org',
  network: 'base-mainnet',
  chainId: 8453,
  usdcContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};
