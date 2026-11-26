import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{detectSessionInUrl:false}}):null;
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
