/**
 * Test individual MCP tools directly
 * Usage: pnpm tsx scripts/test-mcp-tool.ts <tool-name> [json-params]
 *
 * Examples:
 *   pnpm tsx scripts/test-mcp-tool.ts API-get-self
 *   pnpm tsx scripts/test-mcp-tool.ts API-post-search '{"query":"Tasks"}'
 *   pnpm tsx scripts/test-mcp-tool.ts API-retrieve-a-data-source '{"data_source_id":"abc123"}'
 */
import 'dotenv/config';
import { createNotionMCPClient } from '../src/agents/notion-agent/utils/mcp-client.js';

async function main() {
  const [toolName, paramsJson] = process.argv.slice(2);

  if (!toolName) {
    console.log('Usage: pnpm tsx scripts/test-mcp-tool.ts <tool-name> [json-params]\n');
    console.log('Examples:');
    console.log('  pnpm tsx scripts/test-mcp-tool.ts API-get-self');
    console.log('  pnpm tsx scripts/test-mcp-tool.ts API-post-search \'{"query":"Tasks"}\'');
    console.log('  pnpm tsx scripts/test-mcp-tool.ts --list  (list all tools with schemas)\n');
    process.exit(0);
  }

  const mcpClient = await createNotionMCPClient();
  const tools = await mcpClient.tools();

  // List all tools with their schemas
  if (toolName === '--list') {
    console.log('Available MCP Tools:\n');
    for (const [name, tool] of Object.entries(tools)) {
      console.log(`## ${name}`);
      console.log(`Description: ${tool.description?.split('\n')[0]}`);
      // Try different property names for schema
      const schema = (tool as any).inputSchema || (tool as any).parameters || (tool as any).schema;
      if (schema) {
        console.log(`Schema: ${JSON.stringify(schema, null, 2)}`);
      }
      console.log('');
    }
    await mcpClient.close();
    return;
  }

  // Check if tool exists
  if (!(toolName in tools)) {
    console.error(`Tool "${toolName}" not found.\n`);
    console.log('Available tools:', Object.keys(tools).join(', '));
    await mcpClient.close();
    process.exit(1);
  }

  const tool = tools[toolName];

  // Show tool info
  console.log(`\n## Tool: ${toolName}`);
  console.log(`Description: ${tool.description?.split('\n')[0]}`);

  // Show all tool properties for debugging
  const toolKeys = Object.keys(tool);
  console.log(`\nTool properties: ${toolKeys.join(', ')}`);

  // Try to find and display the input schema
  const schema = (tool as any).inputSchema || (tool as any).parameters || (tool as any).schema;
  if (schema) {
    console.log(`\nInput Schema:`);
    console.log(JSON.stringify(schema, null, 2));
  }

  // Parse params
  const params = paramsJson ? JSON.parse(paramsJson) : {};
  console.log(`\nCalling with params:`, JSON.stringify(params, null, 2));

  try {
    // execute requires (input, options) where options has toolCallId, messages, abortSignal
    const result = await tool.execute(params, {
      toolCallId: 'test-call',
      messages: [],
    });
    console.log(`\n## Response:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`\n## Error:`);
    console.error(error);
  }

  await mcpClient.close();
}

main().catch(console.error);
