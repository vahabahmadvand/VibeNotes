#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VibeNotesDB } from './db.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

async function main() {
  const db = new VibeNotesDB();

  const server = new McpServer({
    name: 'vibenotes-mcp',
    version: '0.1.0',
  });

  registerTools(server, db);
  registerResources(server, db);
  registerPrompts(server, db);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error in VibeNotes MCP server:', err);
  process.exit(1);
});
