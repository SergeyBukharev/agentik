import type {Assistant} from './catalog';
import type {Message} from './state';
export type ReplyOptions={mode:'demo'|'live';token:string;signal?:AbortSignal};
export async function replyTo(assistant:Assistant,messages:Message[],options:ReplyOptions):Promise<string>{
 if(options.mode==='demo'){
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,450);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  return `Это демонстрационный ответ «${assistant.name}», а не результат AI.\n\nВаш запрос: «${messages.at(-1)?.content}»\n\nВ рабочем режиме я помогу уточнить задачу, предложить варианты и подготовить результат. Для начала определите, кому он нужен, какие есть ограничения и как выглядит хороший итог.\n\nПодключите сервер AI в профиле, чтобы получить содержательный ответ на ваш запрос.`;
 }
 const {supabase}=import.meta.env.VITE_SUPABASE_URL?await import('./remote'):{supabase:null};
 const session=supabase?(await supabase.auth.getSession()).data.session:null;
 const token=session?.access_token||options.token;
 if(!token)throw new Error('Войдите в профиль или укажите локальный токен API.');
 const response=await fetch(`${import.meta.env.VITE_API_URL||''}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({assistant:{name:assistant.name,instruction:assistant.instruction},messages:messages.slice(-20)}),signal:options.signal??AbortSignal.timeout(35000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.error||'Не удалось получить ответ. Проверьте подключение и повторите.');
 if(typeof data?.reply!=='string')throw new Error('Сервер вернул некорректный ответ.');
 return data.reply;
}
