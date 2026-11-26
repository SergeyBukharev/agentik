import {SESSION_MS} from './session';
export type Player={id:string;name:string};
export type LocalRoom={id:string;title:string;ownerId:string;invite:string;inviteExpiresAt:number;expiresAt:number;members:Player[];messages:{id:string;userId:string;name:string;body:string;createdAt:number}[]};
type Store=Pick<Storage,'getItem'|'setItem'>;
function read(s:Store,now:number):LocalRoom[]{try{const rooms=JSON.parse(s.getItem('agentik:rooms:v1')||'[]');return Array.isArray(rooms)?rooms.filter(r=>r&&typeof r.id==='string'&&typeof r.title==='string'&&typeof r.invite==='string'&&r.expiresAt>now&&Array.isArray(r.members)&&r.members.every((m:Player)=>m&&typeof m.id==='string'&&typeof m.name==='string')&&Array.isArray(r.messages)&&r.messages.every((m:LocalRoom['messages'][number])=>m&&typeof m.id==='string'&&typeof m.body==='string'&&typeof m.name==='string'&&Number.isFinite(m.createdAt))):[];}catch{return[];}}
function write(s:Store,rooms:LocalRoom[]){try{s.setItem('agentik:rooms:v1',JSON.stringify(rooms));}catch{throw new Error('Браузер не смог сохранить комнату. Освободите место и повторите.');}if(typeof window!=='undefined')window.dispatchEvent(new Event('agentik:rooms'));}
export function readLocalRooms(s:Store,user:string,now=Date.now()):LocalRoom[]{return read(s,now).filter(r=>r.members.some(m=>m.id===user));}
export function makeRoom(s:Store,user:Player,title:string,now=Date.now()):LocalRoom{
 if(!title.trim()||title.trim().length>100)throw new Error('Укажите название до 100 символов.');
 const room:LocalRoom={id:crypto.randomUUID(),title:title.trim(),ownerId:user.id,invite:crypto.randomUUID(),inviteExpiresAt:now+86400000,expiresAt:now+SESSION_MS,members:[user],messages:[]};write(s,[room,...read(s,now)]);return room;
}
export function joinLocalRoom(s:Store,user:Player,invite:string,now=Date.now()):LocalRoom{
 const rooms=read(s,now),room=rooms.find(r=>r.invite===invite&&r.inviteExpiresAt>now);if(!room)throw new Error('Комната не найдена или приглашение истекло. Локальные ссылки работают только в этом браузере.');if(!room.members.some(m=>m.id===user.id))room.members.push(user);room.expiresAt=now+SESSION_MS;write(s,rooms);return room;
}
export function postLocalMessage(s:Store,user:Player,id:string,body:string,now=Date.now()):void{
 const rooms=read(s,now),room=rooms.find(r=>r.id===id&&r.members.some(m=>m.id===user.id));if(!room)throw new Error('У профиля нет доступа к этой комнате.');if(!body.trim()||body.trim().length>6000)throw new Error('Сообщение должно содержать от 1 до 6000 символов.');room.messages.push({id:crypto.randomUUID(),userId:user.id,name:user.name,body:body.trim(),createdAt:now});room.messages=room.messages.slice(-500);room.expiresAt=now+SESSION_MS;write(s,rooms);
}
