/**
 * Test MCP connection to Notion MCP Server
 * Run with: pnpm tsx scripts/test-mcp-connection.ts
 */
import 'dotenv/config';
import { createNotionMCPClient } from '../src/agents/notion-agent/utils/mcp-client.js';

async function main() {
  console.log('Testing MCP connection to Notion...\n');

  try {
    const mcpClient = await createNotionMCPClient();
    console.log('MCP Client created successfully!\n');

    // List available tools
    const tools = await mcpClient.tools();
    console.log(`Available MCP Tools (${Object.keys(tools).length} total):`);
    for (const [name, tool] of Object.entries(tools)) {
      // Extract just the first line of description (before "Error Responses")
      const shortDesc = tool.description?.split('\n')[0]?.slice(0, 60) || 'No description';
      console.log(`  - ${name}: ${shortDesc}`);
    }
    console.log('');

    await mcpClient.close();
    console.log('\nMCP connection test completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
