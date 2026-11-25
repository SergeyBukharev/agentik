import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createHandler} from './app';
const handler=createHandler({apiKey:process.env.AI_API_KEY,apiBase:process.env.AI_API_BASE,model:process.env.AI_MODEL,localToken:process.env.LOCAL_API_TOKEN,origin:process.env.ALLOWED_ORIGIN??'http://127.0.0.1:5173',supabaseUrl:process.env.VITE_SUPABASE_URL,supabaseKey:process.env.VITE_SUPABASE_ANON_KEY});
const server=createServer(async(req,res)=>{
 try{
  const request=new Request(`http://localhost${req.url}`,{method:req.method,headers:req.headers as HeadersInit,...(!['GET','HEAD'].includes(req.method??'GET')?{body:Readable.toWeb(req) as ReadableStream,duplex:'half'}:{})} as RequestInit);
  const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Внутренняя ошибка сервера.'}));}
});
server.requestTimeout=45000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1',()=>console.log('Agentik API: http://127.0.0.1:'+String(process.env.PORT??3001)));
