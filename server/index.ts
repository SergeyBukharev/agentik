import {createServer} from 'node:http';
import {createRuntime, nodeApi} from './runtime';
const server = createServer(nodeApi(createRuntime(process.env)));
server.requestTimeout=45000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1',()=>console.log('Agentik API: http://127.0.0.1:'+String(process.env.PORT??3001)));
