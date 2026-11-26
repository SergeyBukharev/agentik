import {createAccess, type AccessConfig} from './access.ts';
import {isChatImage, isChatModel, type ChatImage, type ChatModel} from '../src/chat-media.ts';
import {isChatDocument, MAX_MEDIA_CHAT_BODY_BYTES, MAX_CHAT_BODY_BYTES, MAX_CHAT_MESSAGES, MAX_CHAT_MESSAGE_LENGTH, type ChatDocument} from '../src/chat-contract.ts';
import {TELEGRAM_SHARE_PREFIX} from '../src/telegram-share-contract.ts';
import type {TelegramShareHandler} from './telegram-shares.ts';

type Provider = {apiKey?:string;apiBase?:string;model?:string;vision?:boolean;authScheme?:'Bearer'|'Api-Key';project?:string};
type Turn = {role:'user'|'assistant';content:string;images?:ChatImage[];document?:ChatDocument};

function isChatTurn(value: unknown, media: boolean): value is Turn {
 if (!value || typeof value !== 'object') return false;
 const {role, content, images, document} = value as Partial<Turn>;
 return (role === 'user' || role === 'assistant') && typeof content === 'string' && content.length <= MAX_CHAT_MESSAGE_LENGTH
   && (!!content.trim() || !!images?.length)
   && (images === undefined || (media && role === 'user' && Array.isArray(images) && images.length === 1 && images.every(isChatImage)))
   && (document === undefined || (role === 'user' && !!content.trim() && isChatDocument(document)));
}

function textWithDocument(message: Turn, english: boolean) {
 const {content, document} = message;
 if (!document) return content;
 const label = document.truncated ? (english ? 'File excerpt' : 'Фрагмент файла') : (english ? 'Attached file' : 'Прикреплённый файл');
 return `${content}\n\n${label} — ${document.name}\n${document.text}${document.truncated ? '\n[…]': ''}`;
}
export type ServerConfig=Provider & {providers?:Partial<Record<Exclude<ChatModel,'auto'>,Provider>>;localToken?:string;origin?:string;origins?:string[];supabaseUrl?:string;supabaseKey?:string;fetcher?:typeof fetch;access?:AccessConfig;telegramShares?:TelegramShareHandler};
export function createHandler(config:ServerConfig) {
 const fetcher=config.fetcher??fetch;
 const hits=new Map<string,{count:number;start:number}>();
 const access = config.access ? createAccess(config.access) : null;
 const origins = new Set(config.origins ?? (config.origin ? [config.origin] : []));
 return async (req:Request, clientAddress = 'unknown'):Promise<Response> => {
  const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const out=(status:number,data:unknown)=>Response.json(data,{status,headers});
  const origin=req.headers.get('Origin');
  if(origin&&!origins.has(origin))return out(403,{error:'Источник запроса не разрешён.'});
  if(origin){
   headers['Access-Control-Allow-Origin']=origin;
   headers['Access-Control-Expose-Headers']='Retry-After';
  }
  const url = new URL(req.url);
  const path = url.pathname;
  const telegramOwnerRoute = path === TELEGRAM_SHARE_PREFIX;
  const telegramRoute = config.telegramShares && (telegramOwnerRoute || path.startsWith(`${TELEGRAM_SHARE_PREFIX}/`));
  if (req.method === 'OPTIONS') {
   const methods = telegramRoute ? (telegramOwnerRoute ? 'GET, PUT, DELETE, OPTIONS' : 'GET, OPTIONS') : 'GET, POST, OPTIONS';
   return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':methods,'Access-Control-Allow-Headers':'Authorization, Content-Type'}});
  }
  if (path.startsWith('/api/access/') && access) return access.respond(req, path, clientAddress, headers);
  if (telegramRoute && config.telegramShares) {
   const token = telegramOwnerRoute ? req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1] : undefined;
   return config.telegramShares(req, token ? access?.verify(token) ?? null : null, headers);
  }
  if(path!=='/api/chat')return out(404,{error:'Не найдено.'});
  if(req.method!=='POST')return out(405,{error:'Используйте POST.'});
  const token=req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!token)return out(401,{error:'Войдите по коду доступа.'});
  let identity='local';
  if (access) {
   const verified = access.verify(token);
   if (!verified) return out(401,{error:'Срок входа истёк. Введите код ещё раз.'});
   identity = verified.accountId;
  }else if(config.supabaseUrl&&config.supabaseKey){
   try{
    const auth=await fetcher(`${config.supabaseUrl}/auth/v1/user`,{headers:{apikey:config.supabaseKey,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});
    if(!auth.ok)return out(401,{error:'Сессия истекла. Войдите снова.'});
    const user=await auth.json();if(typeof user.id!=='string')return out(401,{error:'Недействительная сессия.'});identity=user.id;
   }catch{return out(503,{error:'Сервис входа временно недоступен.'});}
  }else if(!config.localToken||token!==config.localToken)return out(401,{error:'Недействительный токен API.'});
  const media = url.searchParams.get('media') === '1';
  const maxBytes = media ? MAX_MEDIA_CHAT_BODY_BYTES : MAX_CHAT_BODY_BYTES;
  let payload:any;
  try{
   const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
   if(reader)for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return out(413,{error:'Запрос слишком большой.'});}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   payload=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return out(400,{error:'Некорректный JSON.'});}
  if(!payload?.assistant||typeof payload.assistant.instruction!=='string'||payload.assistant.instruction.length>4000||!payload.assistant.instruction.trim()||!Array.isArray(payload.messages)||!payload.messages.length||payload.messages.length>MAX_CHAT_MESSAGES||!payload.messages.every((message:unknown)=>isChatTurn(message,media))||payload.messages.at(-1).role!=='user')return out(400,{error:'Проверьте сообщения: до 6000 символов каждое, не более 20 сообщений.'});
  const choice = payload.model ?? 'auto';
  if (!isChatModel(choice)) return out(400,{error:'Неизвестная модель.'});
  const messages:Turn[] = payload.messages;
  const images = messages.flatMap(message=>message.images ?? []);
  if (media && images.length !== 1) return out(400,{error:'Прикрепите одно изображение.'});
  const candidates = [config, config.providers?.chatgpt, config.providers?.deepseek, config.providers?.alice].filter(
    (item):item is Provider => !!item?.apiKey && !!item.model);
  const provider = choice === 'auto'
    ? (candidates.find(item=>!images.length || item.vision) ?? candidates[0])
    : config.providers?.[choice];
  if(!provider?.apiKey||!provider.model)return out(503,{error:'Выбранная модель ещё не настроена. Используйте другую модель или деморежим.'});
  if (images.length && !provider.vision) return out(422,{error:'Эта модель принимает только текст. Для изображения выберите модель с поддержкой изображений.'});
  const english = payload.language === 'en';
  const providerMessages = messages.map(message => {
    const text = textWithDocument(message, english);
    return {role:message.role, content:message.images?.length ? [
      {type:'text',text:text || (english ? 'Describe the image.' : 'Опиши изображение.')},
      ...message.images.map(image=>({type:'image_url',image_url:{url:image.url}})),
    ] : text};
  });
  const system = payload.language === 'en' ? payload.assistant.instruction+' Respond in English unless requested otherwise.' : payload.assistant.instruction;
  const now=Date.now();for(const[k,v]of hits)if(now-v.start>60000)hits.delete(k);
  if(hits.size>=10000&&!hits.has(identity))return out(429,{error:'Сервис занят. Повторите позже.'});
  const hit=hits.get(identity)??{count:0,start:now};if(hit.count>=20)return out(429,{error:'Лимит запросов: повторите через минуту.'});hit.count++;hits.set(identity,hit);
  try{
   const upstreamHeaders: Record<string, string> = {
    Authorization:`${provider.authScheme ?? 'Bearer'} ${provider.apiKey}`,
    'Content-Type':'application/json',
   };
   if (provider.project) upstreamHeaders['OpenAI-Project'] = provider.project;
   const response=await fetcher(`${(provider.apiBase??'https://api.openai.com/v1').replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:upstreamHeaders,body:JSON.stringify({model:provider.model,messages:[{role:'system',content:system},...providerMessages],max_tokens:1200}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)return out(502,{error:'AI временно не отвечает. Попробуйте ещё раз.'});
   const data=await response.json();const reply=data?.choices?.[0]?.message?.content;
   if(typeof reply!=='string'||!reply.trim())return out(502,{error:'Получен пустой ответ AI. Повторите запрос.'});
   return out(200,{reply});
  }catch{return out(502,{error:'Не удалось связаться с AI. Повторите запрос.'});}
 };
}
