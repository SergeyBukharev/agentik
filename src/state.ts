import type { Assistant } from './catalog';
import {SESSION_MS} from './session';
export type Message = {role:'user'|'assistant'; content:string};
export type Conversation = {id:string; assistantId:string; title:string; updatedAt:number; messages:Message[]};
export type AppState = {version:1;favorites:string[];custom:Assistant[];conversations:Conversation[]};
export const emptyState = ():AppState => ({version:1,favorites:[],custom:[],conversations:[]});
function isAssistant(a:unknown):a is Assistant {
  if(!a || typeof a!=='object')return false;
  const x=a as Assistant;
  return ['id','name','description','category','icon','color','instruction'].every(k=>typeof x[k as keyof Assistant]==='string')&&['assistant','character'].includes(x.kind)&&Array.isArray(x.prompts)&&x.prompts.every(p=>typeof p==='string');
}
function isConversation(c:unknown):c is Conversation {
  if(!c||typeof c!=='object')return false;
  const x=c as Conversation;
  return typeof x.id==='string'&&typeof x.assistantId==='string'&&typeof x.title==='string'&&Number.isFinite(x.updatedAt)&&Array.isArray(x.messages)&&x.messages.every(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string');
}
export function loadState(storage:Pick<Storage,'getItem'>,profileId?:string,now=Date.now()):AppState {
  try {
    const s=JSON.parse(storage.getItem(profileId?`agentik:state:${profileId}`:'agentik:v1')||'null');
    if(profileId&&(!s||!Number.isFinite(s.expiresAt)||s.expiresAt<=now))return emptyState();
    if(!s||s.version!==1||!Array.isArray(s.favorites)||!s.favorites.every((v:unknown)=>typeof v==='string')||!Array.isArray(s.custom)||!s.custom.every(isAssistant)||!Array.isArray(s.conversations)||!s.conversations.every(isConversation))return emptyState();
    return {version:1,favorites:s.favorites,custom:s.custom,conversations:s.conversations};
  } catch {return emptyState();}
}
export function saveState(storage:Pick<Storage,'setItem'>,state:AppState,profileId?:string,now=Date.now()):boolean {
  try {storage.setItem(profileId?`agentik:state:${profileId}`:'agentik:v1',JSON.stringify({...state,savedAt:now,expiresAt:now+SESSION_MS}));return true;}catch{return false;}
}
