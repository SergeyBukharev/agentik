// @vitest-environment node
import {it,expect} from 'vitest';
import {createHandler} from './app';
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
