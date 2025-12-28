import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

export async function createNotionMCPClient() {
  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) {
    throw new Error('NOTION_TOKEN environment variable is required');
  }

  // ref: https://github.com/makenotion/notion-mcp-server
  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: {
      ...process.env,
      OPENAPI_MCP_HEADERS: JSON.stringify({
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2025-09-03',
      }),
    },
  });

  const mcpClient = await experimental_createMCPClient({
    transport,
  });

  return mcpClient;
}

export type NotionMCPClient = Awaited<ReturnType<typeof createNotionMCPClient>>;
