export type ServerConfig={apiKey?:string;apiBase?:string;model?:string;localToken?:string;origin?:string;supabaseUrl?:string;supabaseKey?:string;fetcher?:typeof fetch};
export function createHandler(config:ServerConfig) {
 const fetcher=config.fetcher??fetch;
 const hits=new Map<string,{count:number;start:number}>();
 return async (req:Request):Promise<Response> => {
  const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const out=(status:number,data:unknown)=>Response.json(data,{status,headers});
  const origin=req.headers.get('Origin');
  if(origin&&origin!==config.origin)return out(403,{error:'Источник запроса не разрешён.'});
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
  if(new URL(req.url).pathname!=='/api/chat')return out(404,{error:'Не найдено.'});
  if(req.method!=='POST')return out(405,{error:'Используйте POST.'});
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token)return out(401,{error:'Войдите в профиль или укажите локальный токен API.'});
  let identity='local';
  if(config.supabaseUrl&&config.supabaseKey){
   try{
    const auth=await fetcher(`${config.supabaseUrl}/auth/v1/user`,{headers:{apikey:config.supabaseKey,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});
    if(!auth.ok)return out(401,{error:'Сессия истекла. Войдите снова.'});
    const user=await auth.json();if(typeof user.id!=='string')return out(401,{error:'Недействительная сессия.'});identity=user.id;
   }catch{return out(503,{error:'Сервис входа временно недоступен.'});}
  }else if(!config.localToken||token!==config.localToken)return out(401,{error:'Недействительный токен API.'});
  let payload:any;
  try{
   const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
   if(reader)for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return out(413,{error:'Запрос слишком большой.'});}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   payload=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return out(400,{error:'Некорректный JSON.'});}
  if(!payload?.assistant||typeof payload.assistant.instruction!=='string'||payload.assistant.instruction.length>4000||!payload.assistant.instruction.trim()||!Array.isArray(payload.messages)||!payload.messages.length||payload.messages.length>20||!payload.messages.every((m:any)=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.trim()&&m.content.length<=6000)||payload.messages.at(-1).role!=='user')return out(400,{error:'Проверьте сообщения: до 6000 символов каждое, не более 20 сообщений.'});
  if(!config.apiKey||!config.model)return out(503,{error:'AI ещё не настроен на сервере. Вы можете использовать деморежим.'});
  const now=Date.now();for(const[k,v]of hits)if(now-v.start>60000)hits.delete(k);
  if(hits.size>=10000&&!hits.has(identity))return out(429,{error:'Сервис занят. Повторите позже.'});
  const hit=hits.get(identity)??{count:0,start:now};if(hit.count>=20)return out(429,{error:'Лимит запросов: повторите через минуту.'});hit.count++;hits.set(identity,hit);
  try{
   const response=await fetcher(`${(config.apiBase??'https://api.openai.com/v1').replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:[{role:'system',content:payload.assistant.instruction},...payload.messages.map((m:any)=>({role:m.role,content:m.content}))],max_tokens:1200}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)return out(502,{error:'AI временно не отвечает. Попробуйте ещё раз.'});
   const data=await response.json();const reply=data?.choices?.[0]?.message?.content;
   if(typeof reply!=='string'||!reply.trim())return out(502,{error:'Получен пустой ответ AI. Повторите запрос.'});
   return out(200,{reply});
  }catch{return out(502,{error:'Не удалось связаться с AI. Повторите запрос.'});}
 };
}
