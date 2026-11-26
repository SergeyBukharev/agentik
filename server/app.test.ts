// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {createHandler} from './app';
import {createRuntime} from './runtime';
const body={assistant:{name:'Редактор',instruction:'Помогай писать'},messages:[{role:'user',content:'Привет'}]};
const req=(payload:unknown=body,token='test',origin='http://localhost:5173')=>new Request('http://localhost/api/chat',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:origin},body:JSON.stringify(payload)});
const config={localToken:'test',origin:'http://localhost:5173'};
it('rejects unauthenticated requests before contacting provider',async()=>{
 expect((await createHandler(config)(req(body,''))).status).toBe(401);
});
it('rejects foreign origins',async()=>{
 expect((await createHandler(config)(req(body,'test','https://other.example'))).status).toBe(403);
});
it('reports unconfigured AI without charging a provider',async()=>{
 expect((await createHandler(config)(req())).status).toBe(503);
 expect((await createHandler(config)(req({...body,model:'alice'}))).status).toBe(503);
});
it('rejects malformed and oversized messages',async()=>{
 const h=createHandler({...config,apiKey:'key'});
 expect((await h(req({messages:[{role:'system',content:'x'}]}))).status).toBe(400);
 expect((await h(req({...body,messages:[{role:'user',content:'x'.repeat(6001)}]}))).status).toBe(400);
 expect((await h(req({...body,extra:'x'.repeat(70000)}))).status).toBe(413);
});
it('returns provider text using server-selected model and system prompt',async()=>{
 let sent:any;
 const h=createHandler({...config,apiKey:'key',model:'my-model',fetcher:async(_url,init)=>{sent=JSON.parse(init!.body as string);return Response.json({choices:[{message:{content:'Здравствуйте'}}]});}});
 const r=await h(req());expect(r.status).toBe(200);expect(await r.json()).toEqual({reply:'Здравствуйте'});
 expect(sent.model).toBe('my-model');expect(sent.messages[0]).toEqual({role:'system',content:'Помогай писать'});
});
it('hides upstream error payloads and handles invalid success responses',async()=>{
 for(const upstream of [Response.json({secret:'key'},{status:429}),Response.json({choices:[]})]){
 const r=await createHandler({...config,apiKey:'key',model:'test',fetcher:async()=>upstream})(req());
  expect(r.status).toBe(502);expect(await r.text()).not.toContain('secret');
 }
});
it('limits requests per authenticated identity',async()=>{
 const h=createHandler({...config,apiKey:'key',model:'test',fetcher:async()=>Response.json({choices:[{message:{content:'ok'}}]})});
 for(let i=0;i<20;i++)expect((await h(req())).status).toBe(200);
 expect((await h(req())).status).toBe(429);
});

it('routes an allowed model choice and sends the image only through a vision provider', async () => {
 let sent: any;
 const handler=createHandler({...config,providers:{
   chatgpt:{apiKey:'fixture',model:'vision-model',vision:true},
   deepseek:{apiKey:'fixture',model:'text-model'},
 },fetcher:async(_url,init)=>{
   sent=JSON.parse(init!.body as string);
   return Response.json({choices:[{message:{content:'Received.'}}]});
 }});
 const image={id:'test',name:'test.png',url:'data:image/png;base64,AA=='};
 const request=(model:string)=>new Request('http://localhost/api/chat?media=1',{
   method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},
   body:JSON.stringify({...body,model,messages:[{role:'user',content:'',images:[image]}]}),
 });
 expect((await handler(request('deepseek'))).status).toBe(422);
 expect((await handler(request('other'))).status).toBe(400);
 expect((await handler(request('chatgpt'))).status).toBe(200);
 expect(sent.model).toBe('vision-model');
 expect((await handler(request('auto'))).status).toBe(200);
 expect(sent.messages.at(-1).content[1]).toEqual({type:'image_url',image_url:{url:image.url}});
});

it('authenticates chat requests for Alice AI with the configured Yandex Cloud project', async () => {
 const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
   Response.json({choices:[{message:{content:'Ответ Алисы'}}]}));
 vi.stubGlobal('fetch', fetcher);
 try {
   const handler = createRuntime({
     ALLOWED_ORIGIN:config.origin,
     AGENTIK_ACCESS_SECRET:'test-only-session-secret-alice-fixture',
     AGENTIK_ACCOUNT_EMAIL:'alice-fixture@example.test',
     AGENTIK_ACCOUNT_CODE:'ABCDEF',
     AI_ALICE_API_KEY:'test-only-key',
     AI_ALICE_FOLDER_ID:'example-folder',
   });
   const login = await handler(new Request('http://localhost/api/access/login', {
     method:'POST', headers:{'Content-Type':'application/json'},
     body:JSON.stringify({email:'alice-fixture@example.test',code:'ABCDEF'}),
   }));
   expect(login.status).toBe(200);
   const {token} = await login.json();
   const response = await handler(req({...body,model:'alice'},token));
   expect(response.status).toBe(200);
   expect(await response.json()).toEqual({reply:'Ответ Алисы'});
   expect(fetcher).toHaveBeenCalledTimes(1);
   const [url, init] = fetcher.mock.calls[0];
   expect(url).toBe('https://ai.api.cloud.yandex.net/v1/chat/completions');
   const headers = new Headers(init?.headers);
   expect(headers.get('Authorization')).toBe('Api-Key test-only-key');
   expect(headers.get('OpenAI-Project')).toBe('example-folder');
   expect(JSON.parse(String(init?.body)).model).toBe('gpt://example-folder/aliceai-llm');
 } finally {
   vi.unstubAllGlobals();
 }
});
