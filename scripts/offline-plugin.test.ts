// @vitest-environment node
import {runInNewContext} from 'node:vm';
import {it,expect} from 'vitest';
import {offlinePlugin} from './offline-plugin';
it('keeps cached HTML on its matching asset generation until a new worker installs',async()=>{
 let source='';(offlinePlugin().generateBundle as Function).call({emitFile:(asset:{source:string})=>{source=asset.source;}},{},{});
 const handlers:Record<string,Function>={};const stored=new Map<string,Response>([['/agentik/',new Response('<script src="/assets/build-A.js"></script>')]]);
 const cache={match:async(key:string)=>stored.get(key)?.clone(),put:async(key:string,response:Response)=>{stored.set(key,response);}};
 runInNewContext(source,{self:{location:{origin:'https://demo.test'},addEventListener:(name:string,fn:Function)=>{handlers[name]=fn;}},caches:{open:async()=>cache,match:cache.match},URL,Response,AbortSignal,fetch:async()=>new Response('<script src="/assets/build-B.js"></script>')});
 let response!:Promise<Response>;handlers.fetch({request:{method:'GET',url:'https://demo.test/agentik/',headers:new Headers(),mode:'navigate'},respondWith:(p:Promise<Response>)=>{response=p;},waitUntil:()=>{}});
 expect(await(await response).text()).toContain('build-A.js');
 expect(await stored.get('/agentik/')!.text()).toContain('build-A.js');
});
