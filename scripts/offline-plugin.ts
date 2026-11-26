import {createHash} from 'node:crypto';
import type {Plugin} from 'vite';
export function offlinePlugin():Plugin{return{name:'agentik-offline',generateBundle(_options,bundle){
 const files=Object.keys(bundle).filter(p=>!p.endsWith('.map'));
 const version=createHash('sha256').update(files.join('|')).digest('hex').slice(0,12);
 const source=`const CACHE='agentik-shell-${version}';const BASE='/agentik/';const FILES=${JSON.stringify(['./',...files.map(f=>'./'+f),'./favicon.svg'])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('agentik-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE)||request.headers.has('Authorization')||url.pathname.endsWith('/sw.js')||url.pathname.includes('/api/'))return;
if(request.mode==='navigate'){event.respondWith((async()=>{const cache=await caches.open(CACHE);const shell=await cache.match(BASE);if(shell)return shell;try{return await fetch(request,{signal:AbortSignal.timeout(2000)});}catch{return new Response('Agentik недоступен офлайн',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}})());return;}
if(url.pathname.includes('/assets/')||url.pathname.endsWith('/favicon.svg'))event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;})));});`;
 this.emitFile({type:'asset',fileName:'sw.js',source});
}};}
