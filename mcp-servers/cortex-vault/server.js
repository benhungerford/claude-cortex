const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const tools = [];

function registerTool(def) {
  if (!def.name || !def.description || !def.inputSchema || !def.handler) {
    throw new Error(`registerTool: missing required field in "${def.name || 'unknown'}"`);
  }
  tools.push(def);
}

// Tool imports
registerTool(require('./tools/append-changelog.js'));
registerTool(require('./tools/update-moc.js'));
registerTool(require('./tools/read-hub.js'));
registerTool(require('./tools/find-project-by-cwd.js'));
registerTool(require('./tools/validate-frontmatter.js'));
registerTool(require('./tools/scaffold-project.js'));
registerTool(require('./tools/thread-meeting.js'));

const server = new Server(
  { name: 'cortex-vault', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true
    };
  }
  try {
    return await tool.handler(args || {});
  } catch (err) {
    console.error(`[cortex-vault] Error in tool "${name}":`, err);
    return {
      content: [{ type: 'text', text: `Error in ${name}: ${err.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('cortex-vault MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
