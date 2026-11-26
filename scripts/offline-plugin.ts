import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Plugin} from 'vite';

const publicAssets = ['capture-guard.js', 'favicon.svg', 'brand/agentik-wordmark-light.svg', 'brand/agentik-wordmark-dark.svg',
  'illustrations/ideas.svg', 'illustrations/history.svg', 'illustrations/search.svg', 'illustrations/together.svg'];

export function offlinePlugin({cacheScope = 'agentik', publicFiles = publicAssets}: {cacheScope?: string; publicFiles?: string[]} = {}): Plugin {
  let base = '/agentik/';
  let publicDir = resolve('public');
  const prefix = cacheScope + '-shell-';
  return {
    name: 'agentik-offline',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(path => !path.endsWith('.map'));
      const optional = files.filter(path => /(?:^|\/)pdf(?:[.-]|$)/i.test(path));
      const shellFiles = files.filter(path => !optional.includes(path));
      const digest = createHash('sha256').update(base).update(files.join('|'));
      for (const path of publicFiles) digest.update(readFileSync(resolve(publicDir, path)));
      for (const entry of Object.values(bundle)) {
        if (entry.type === 'asset') digest.update(entry.source);
      }
      const source = `const CACHE='${prefix}VERSION';
const BASE=${JSON.stringify(base)};
const FILES=${JSON.stringify(['./', ...shellFiles.map(path => './' + path), ...publicFiles.map(path => './' + path)])};
const OPTIONAL=${JSON.stringify(optional.map(path => './' + path))};
const ASSETS=new Set([...FILES.slice(1),...OPTIONAL].map(path=>BASE+path.slice(2)));
const previousCaches=async()=>(await caches.keys()).filter(key=>key.startsWith('${prefix}')&&key!==CACHE);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const existed=await caches.has(CACHE);
  const cache=await caches.open(CACHE);
  try{
    await cache.addAll(FILES.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})));
  }catch(error){
    if(!existed)await caches.delete(CACHE);
    throw error;
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // A tab may still be running the preceding build and need its lazy chunks.
  const state=await caches.open('${cacheScope}-worker-state');
  const active=await (await state.match(self.location.href))?.text();
  const older=await previousCaches();
  const keep=older.includes(active)?active:older.at(-1);
  await state.put(self.location.href,new Response(CACHE));
  await Promise.all(older.filter(key=>key!==keep).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE)||request.headers.has('Authorization')||url.pathname.includes('/api/')||url.pathname.startsWith(BASE+'share/'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      let online;
      try{
        online=await fetch(request,{cache:'no-cache'});
        if(online.status<500)return online;
      }catch{ /* Recover with the installed release while offline. */ }
      const cache=await caches.open(CACHE);
      if(url.pathname===BASE+'widget.html'&&ASSETS.has(url.pathname)){
        const widget=await cache.match(url.pathname);
        if(widget)return widget;
      }
      const shell=await cache.match(BASE);
      if(shell)return url.pathname===BASE?shell:new Response(shell.body,{status:404,headers:shell.headers});
      return online??new Response('Agentik недоступен офлайн',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    })());
    return;
  }
  const currentAsset=ASSETS.has(url.pathname);
  const fingerprinted=url.pathname.startsWith(BASE+'assets/');
  if(currentAsset||fingerprinted)event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request,{ignoreVary:true});
    if(cached)return cached;
    if(fingerprinted){
      for(const name of (await previousCaches()).reverse()){
        const previous=await caches.open(name);
        const oldAsset=await previous.match(request,{ignoreVary:true});
        if(oldAsset)return oldAsset;
      }
    }
    const response=await fetch(request);
    if(response.ok&&currentAsset)event.waitUntil(cache.put(request,response.clone()));
    return response;
  }));
});`;
      const version = digest.update(source).digest('hex').slice(0, 12);
      this.emitFile({type: 'asset', fileName: 'sw.js', source: source.replace(prefix + 'VERSION', prefix + version)});
    },
    writeBundle(options) {
      if (options.dir) return copyFile(resolve(options.dir, 'index.html'), resolve(options.dir, '404.html'));
    },
  };
}
