// @vitest-environment node
import {fileURLToPath} from 'node:url';
import {it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

it('exposes documented project files and keeps local credentials private', async () => {
 const client = new Client({name:'agentik-test',version:'1.0.0'});
 try {
   await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./mcp-files.mjs',import.meta.url))]}));
   const tools = await client.listTools();
   expect(tools.tools.map(item=>item.name)).toEqual(['list_project_files','read_project_file']);
   const read = (path:string)=>client.callTool({name:'read_project_file',arguments:{path}});
   expect(await read('src/chat-contract.ts')).toMatchObject({content:[{type:'text',text:expect.stringContaining('MAX_CHAT_MESSAGE_LENGTH')}]});
   expect(await read('.env')).toMatchObject({isError:true});
   expect(await read('docs/../.env')).toMatchObject({isError:true});
 } finally { await client.close(); }
}, 20_000);
