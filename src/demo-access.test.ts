import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {isAccessSession} from './access-contract';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  vi.stubEnv('VITE_DEMO_ACCESS', 'true');
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('opens two separate demo workspaces locally and keeps demo tokens out of server authentication', async () => {
  const request = vi.fn(async () => new Response(null, {status: 503}));
  vi.stubGlobal('fetch', request);
  const {logIn, saveAccess, readAccess, checkAccessSession} = await import('./access-client');
  const {signal} = new AbortController();
  const free = await logIn('free26', signal, ' FREE@DEMO.AGENTIK.TEST ');
  const pro = await logIn('PRO026', signal, 'pro@demo.agentik.test');

  expect(free.plan).toBeUndefined();
  expect(pro.plan).toBe('pro');
  expect(pro.accountId).not.toBe(free.accountId);
  expect(isAccessSession(pro)).toBe(false);
  expect(saveAccess(pro)).toBe(true);
  expect(readAccess()).toEqual(pro);
  expect(await checkAccessSession(pro, signal)).toEqual(pro);
  await expect(logIn('FREE26', signal, 'pro@demo.agentik.test')).rejects.toMatchObject({reason:'invalid'});
  expect(request).not.toHaveBeenCalled();
});
