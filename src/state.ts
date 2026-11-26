import type { Assistant } from './catalog';
import {SESSION_MS,listProfiles,saveProfile} from './session';
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
export function readState(storage:Pick<Storage,'getItem'>,profileId?:string,now=Date.now()):{state:AppState;status:'ok'|'missing'|'corrupt'|'unavailable'} {
  let raw:string|null;
  try{raw=storage.getItem(profileId?`agentik:state:${profileId}`:'agentik:v1');}catch{return{state:emptyState(),status:'unavailable'};}
  if(!raw)return{state:emptyState(),status:'missing'};
  try {
    const s=JSON.parse(raw);
    if(!s||s.version!==1)return{state:emptyState(),status:'corrupt'};
    if(profileId&&!Number.isFinite(s.expiresAt))return{state:emptyState(),status:'corrupt'};
    if(profileId&&s.expiresAt<=now)return{state:emptyState(),status:'missing'};
    const state:AppState={version:1,favorites:Array.isArray(s.favorites)?s.favorites.filter((x:unknown)=>typeof x==='string'):[],custom:Array.isArray(s.custom)?s.custom.filter(isAssistant):[],conversations:Array.isArray(s.conversations)?s.conversations.filter(isConversation):[]};
    const valid=['favorites','custom','conversations'].every(k=>Array.isArray(s[k])&&s[k].length===state[k as 'favorites'|'custom'|'conversations'].length);
    return{state,status:valid?'ok':'corrupt'};
  } catch {return{state:emptyState(),status:'corrupt'};}
}
export function loadState(storage:Pick<Storage,'getItem'>,profileId?:string,now=Date.now()):AppState{return readState(storage,profileId,now).state;}
export function saveState(storage:Pick<Storage,'setItem'>&Partial<Pick<Storage,'getItem'>>,state:AppState,profileId?:string,now=Date.now()):boolean {
  try {storage.setItem(profileId?`agentik:state:${profileId}`:'agentik:v1',JSON.stringify({...state,savedAt:now,expiresAt:now+SESSION_MS}));if(profileId&&storage.getItem){const full=storage as Pick<Storage,'getItem'|'setItem'>;const p=listProfiles(full,now).find(p=>p.id===profileId);if(p&&!saveProfile(full,{...p,expiresAt:now+SESSION_MS}))return false;}return true;}catch{return false;}
}
