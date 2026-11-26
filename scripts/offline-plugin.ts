import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Plugin} from 'vite';

const publicAssets = ['favicon.svg', 'illustrations/ideas.svg', 'illustrations/history.svg', 'illustrations/search.svg', 'illustrations/together.svg'];

export function offlinePlugin(): Plugin {
  let base = '/agentik/';
  let publicDir = resolve('public');
  return {
    name: 'agentik-offline',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(path => !path.endsWith('.map'));
      const digest = createHash('sha256').update(base).update(files.join('|'));
      for (const path of publicAssets) digest.update(readFileSync(resolve(publicDir, path)));
      for (const entry of Object.values(bundle)) {
        if (entry.type === 'asset') digest.update(entry.source);
      }
      const version = digest.digest('hex').slice(0, 12);
      const source = `const CACHE='agentik-shell-${version}';
const BASE=${JSON.stringify(base)};
const FILES=${JSON.stringify(['./', ...files.map(path => './' + path), ...publicAssets.map(path => './' + path)])};
const ASSETS=new Set(FILES.slice(1).map(path=>BASE+path.slice(2)));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('agentik-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE)||request.headers.has('Authorization')||url.pathname.includes('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const shell=await cache.match(BASE);
      if(shell) return url.pathname===BASE ? shell : new Response(shell.body,{status:404,headers:shell.headers});
      try{return await fetch(request);}
      catch{return new Response('Agentik недоступен офлайн',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
    })());
    return;
  }
  if(ASSETS.has(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request,{ignoreVary:true});
    if(cached)return cached;
    const response=await fetch(request);
    if(response.ok)event.waitUntil(cache.put(request,response.clone()));
    return response;
  }));
});`;
      this.emitFile({type: 'asset', fileName: 'sw.js', source});
    },
    writeBundle(options) {
      if (options.dir) return copyFile(resolve(options.dir, 'index.html'), resolve(options.dir, '404.html'));
    },
  };
}
