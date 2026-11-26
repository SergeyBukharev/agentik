import {open, realpath} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const files = new Set([
  'README.md',
  'backend-specs.md',
  'docs/deployment.md',
  'docs/product-requirements.md',
  'src/access-contract.ts',
  'src/chat-contract.ts',
  'src/chat-media.ts',
]);
const mcp = new McpServer({name:'agentik-files', version:'1.0.0'});
const result = (text) => ({content:[{type:'text',text}]});
const denied = () => ({...result('File is unavailable.'), isError:true});

mcp.registerTool('list_project_files', {
  description:'List readable Agentik specifications and shared source contracts.',
  annotations:{readOnlyHint:true,openWorldHint:false},
}, async () => result(JSON.stringify([...files])));

mcp.registerTool('read_project_file', {
  description:'Read one exact project-relative path returned by list_project_files.',
  inputSchema:{path:z.string().max(160)},
  annotations:{readOnlyHint:true,openWorldHint:false},
}, async ({path}) => {
  if (!files.has(path)) return denied();
  const full = resolve(root, path);
  try {
    const canonical = await realpath(full);
    if (canonical !== full || basename(canonical).startsWith('.')) return denied();
    const file = await open(canonical);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 96_000) return denied();
      const buffer = Buffer.alloc(96_001);
      const {bytesRead} = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 96_000) return denied();
      return result(buffer.subarray(0, bytesRead).toString('utf8'));
    } finally {
      await file.close();
    }
  } catch {
    return denied();
  }
});

await mcp.connect(new StdioServerTransport());
