#!/usr/bin/env node
/**
 * MCP server wrapper for evidencebundle x402 services
 * Uses the proper MCP SDK pattern with imported schemas
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const WALLET = process.env.WALLET_ADDRESS || '0x62cac459ed425f67ac0e56573084fa061bf89abc';

const server = new Server(
  {
    name: 'evidencebundle-x402',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'sign_bundle',
      description: 'Generate a signed evidence bundle. Cost: $0.10 USDC. Returns JSON with contentHash, timestamp, signature.',
      inputSchema: {
        type: 'object',
        properties: {
          payload: { type: 'string', description: 'Content to seal in the bundle' },
        },
        required: ['payload'],
      },
    },
    {
      name: 'scan_skill',
      description: 'Audit SKILL.md for security flaws. Cost: $0.50 USDC. Detects os.system, eval, secrets. Returns score 0-100.',
      inputSchema: {
        type: 'object',
        properties: {
          skill_content: { type: 'string', description: 'SKILL.md content' },
        },
        required: ['skill_content'],
      },
    },
    {
      name: 'get_signal',
      description: 'Get market intelligence. Cost: $0.05 USDC. Sources: crypto, polymarket, moltbook, weather.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['crypto', 'polymarket', 'moltbook', 'weather'] },
        },
      },
    },
    {
      name: 'audit_pipeline',
      description: 'Audit multi-agent pipeline logs. Cost: $1.00 USDC. Detects authority laundering.',
      inputSchema: {
        type: 'object',
        properties: {
          pipeline_log: { type: 'string', description: 'Pipeline log content' },
        },
        required: ['pipeline_log'],
      },
    },
    {
      name: 'get_discovery',
      description: 'Get full x402 service catalog. Free.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_discovery') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          service: 'evidencebundle',
          network: 'base-mainnet',
          wallet: WALLET,
          endpoints: [
            { name: 'bundle', price: '0.10 USDC' },
            { name: 'skill-scan', price: '0.50 USDC' },
            { name: 'signal', price: '0.05 USDC' },
            { name: 'audit-pipeline', price: '1.00 USDC' },
          ],
        }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: 'text',
      text: `x402 paid endpoint. To call ${name}: send USDC to ${WALLET} on Base, use tx hash as X-PAYMENT header.`,
    }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
