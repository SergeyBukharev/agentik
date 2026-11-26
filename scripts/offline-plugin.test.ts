// @vitest-environment node
import {runInNewContext} from 'node:vm';
import {expect, it, vi} from 'vitest';
import {offlinePlugin} from './offline-plugin';

const origin = 'https://demo.test';
const entry = '/agentik/';
const oldAsset = entry + 'assets/build-A.js';
const sharePage = entry + 'share/published-copy';
const shellA = `<script src="${oldAsset}"></script>`;
const shellB = '<script src="/agentik/assets/build-B.js"></script>';

function worker(network: typeof fetch, fixture: {rollback?: boolean; installError?: Error} = {}) {
  let source = '';
  (offlinePlugin().generateBundle as Function).call({emitFile: (asset: {source: string}) => { source = asset.source; }}, {}, {});
  const release = /^const CACHE='([^']+)'/.exec(source)?.[1];
  if (!release) throw new Error('Missing app cache name');
  const handlers: Record<string, Function> = {};
  const stored = new Map([[entry, new Response(shellA)]]);
  const cache = {
    match: async (key: string | Request) => stored.get(typeof key === 'string' ? key : new URL(key.url).pathname)?.clone(),
    put: vi.fn(),
    addAll: vi.fn(async (_requests: Request[]) => {
      if (fixture.installError) throw fixture.installError;
    }),
  };
  const oldCache = {match: async () => new Response('old immutable script')};
  const stateCache = {match: async () => fixture.rollback ? new Response('agentik-shell-previous') : undefined, put: vi.fn()};
  const skipWaiting = vi.fn(async () => {});
  const claim = vi.fn(async () => {});
  const deleteCache = vi.fn(async () => true);
  runInNewContext(source, {
    self: {
      location: {origin,href:origin + entry + 'sw.js'}, skipWaiting, clients: {claim},
      addEventListener: (name: string, handler: Function) => { handlers[name] = handler; },
    },
    caches: {
      has: async (name: string) => fixture.rollback && name === release,
      open: async (name: string) => {
        if (name === 'agentik-worker-state') return stateCache;
        return name === 'agentik-shell-previous' ? oldCache : cache;
      },
      keys: async () => fixture.rollback
        ? ['another-app-cache','agentik-shell-previous','agentik-shell-obsolete',release]
        : ['another-app-cache','agentik-shell-obsolete','agentik-shell-previous',release],
      delete: deleteCache,
    },
    Headers, Request, Response, URL, AbortSignal, fetch: network,
  });
  const run = (name: string) => new Promise<void>((resolve,reject) => {
    handlers[name]({waitUntil: (promise: Promise<void>) => { void promise.then(resolve,reject); }});
  });
  const request = (path: string, mode = 'navigate') => {
    let response: Promise<Response> | undefined;
    handlers.fetch({request: {method:'GET',url:origin + path,headers:new Headers(),mode},
      respondWith: (value: Promise<Response>) => { response = value; }, waitUntil: () => {},
    });
    return response;
  };
  return {cache, claim, deleteCache, request, run, skipWaiting, stored};
}

it('revalidates the online navigation against the current release and keeps the coherent offline copy', async () => {
  const network = vi.fn<typeof fetch>(async () => new Response(shellB));
  const app = worker(network);
  expect(await (await app.request(entry))?.text()).toBe(shellB);
  expect(network).toHaveBeenCalledWith(expect.objectContaining({url:origin + entry}), expect.objectContaining({cache:'no-cache'}));
  expect(await app.stored.get(entry)?.text()).toBe(shellA);
});

it('loads the saved shell only when the network is unavailable', async () => {
  const app = worker(async () => { throw new TypeError('Offline'); });
  expect(await (await app.request(entry))?.text()).toBe(shellA);
  expect((await app.request(entry + 'missing'))?.status).toBe(404);
});

it('uses the saved shell during a server outage and preserves access-denied responses', async () => {
  const network = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('Unavailable',{status:503}))
    .mockResolvedValueOnce(new Response('Forbidden',{status:403}));
  const app = worker(network);
  expect(await (await app.request(entry))?.text()).toBe(shellA);
  expect((await app.request(entry))?.status).toBe(403);
});

it('lets the server handle published share pages', () => {
  const app = worker(async () => new Response('Shared page'));
  expect(app.request(sharePage)).toBeUndefined();
});

it('activates after complete precaching and keeps scripts for clients on the previous release', async () => {
  const network = vi.fn<typeof fetch>(async () => new Response('From the network'));
  const app = worker(network);
  await app.run('install');
  expect(app.cache.addAll.mock.calls[0][0][0]).toMatchObject({url:origin + entry,cache:'reload'});
  expect(app.skipWaiting).toHaveBeenCalledOnce();
  expect(app.cache.addAll.mock.invocationCallOrder[0]).toBeLessThan(app.skipWaiting.mock.invocationCallOrder[0]);
  await app.run('activate');
  expect(app.claim).toHaveBeenCalledOnce();
  expect(app.deleteCache.mock.calls).toEqual([['agentik-shell-obsolete']]);
  expect(await (await app.request(oldAsset,'same-origin'))?.text()).toBe('old immutable script');
  expect(network).not.toHaveBeenCalled();
});

it('retains the preceding active release after a rollback', async () => {
  const app = worker(async () => new Response('From the network'), {rollback:true});
  await app.run('activate');
  expect(app.deleteCache.mock.calls).toEqual([['agentik-shell-obsolete']]);
});

it('keeps a usable existing cache when reinstalling its release fails', async () => {
  const installError = new Error('Asset unavailable');
  const app = worker(async () => new Response('From the network'), {rollback:true,installError});
  await expect(app.run('install')).rejects.toBe(installError);
  expect(app.skipWaiting).not.toHaveBeenCalled();
  expect(app.deleteCache).not.toHaveBeenCalled();
});
