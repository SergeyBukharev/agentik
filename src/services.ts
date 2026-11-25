import {createClient} from '@supabase/supabase-js';
import type {Assistant} from './catalog';
import type {Message} from './state';
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{detectSessionInUrl:false}}):null;
export type ReplyOptions={mode:'demo'|'live';token:string;signal?:AbortSignal};
export async function replyTo(assistant:Assistant,messages:Message[],options:ReplyOptions):Promise<string>{
 if(options.mode==='demo'){
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,450);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  return `Это демонстрационный ответ «${assistant.name}», а не результат AI.\n\nВаш запрос: «${messages.at(-1)?.content}»\n\nВ рабочем режиме я помогу уточнить задачу, предложить варианты и подготовить результат. Для начала определите, кому он нужен, какие есть ограничения и как выглядит хороший итог.\n\nПодключите сервер AI в профиле, чтобы получить содержательный ответ на ваш запрос.`;
 }
 const session=supabase?(await supabase.auth.getSession()).data.session:null;
 const token=session?.access_token||options.token;
 if(!token)throw new Error('Войдите в профиль или укажите локальный токен API.');
 const response=await fetch(`${import.meta.env.VITE_API_URL||''}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({assistant:{name:assistant.name,instruction:assistant.instruction},messages:messages.slice(-20)}),signal:options.signal??AbortSignal.timeout(35000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.error||'Не удалось получить ответ. Проверьте подключение и повторите.');
 if(typeof data?.reply!=='string')throw new Error('Сервер вернул некорректный ответ.');
 return data.reply;
}
function client(){if(!supabase)throw new Error('Групповые чаты требуют подключения Supabase. Инструкция находится в README.');return supabase;}
export async function signIn(email:string,password:string,register=false){
 const c=client();const result=register?await c.auth.signUp({email,password}):await c.auth.signInWithPassword({email,password});
 if(result.error)throw new Error(result.error.message);
 return result.data;
}
export async function createRoom(title:string){const {data,error}=await client().rpc('create_room',{room_title:title});if(error)throw new Error(error.message);return data as string;}
export async function joinRoom(token:string){const {data,error}=await client().rpc('join_room',{invite_token:token});if(error)throw new Error('Приглашение недействительно, истекло или вы не вошли в профиль.');return data as string;}
export async function inviteRoom(room:string){const {data,error}=await client().rpc('create_room_invite',{room});if(error)throw new Error('Приглашать участников может только создатель чата.');return `${location.origin}${location.pathname}#/join/${data}`;}
export type RoomMessage={id:number;room_id:string;user_id:string;body:string;created_at:string};
export type Room={id:string;title:string;owner_id:string};
export async function listRooms():Promise<Room[]>{const {data,error}=await client().from('rooms').select('id,title,owner_id').order('created_at',{ascending:false});if(error)throw new Error(error.message);return data??[];}
export async function roomMessages(room:string):Promise<RoomMessage[]>{const {data,error}=await client().from('room_messages').select('*').eq('room_id',room).order('id',{ascending:false}).limit(100);if(error)throw new Error(error.message);return (data??[]).reverse();}
export async function sendRoomMessage(room:string,body:string){const c=client();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('Войдите в профиль.');const{error}=await c.from('room_messages').insert({room_id:room,user_id:user.id,body});if(error)throw new Error('Сообщение не отправлено. Проверьте доступ и повторите.');}
export function watchRoom(room:string,onChange:()=>void,onError:()=>void){const c=client();const channel=c.channel(`room:${room}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:`room_id=eq.${room}`},onChange).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError();});return()=>{void c.removeChannel(channel);};}
