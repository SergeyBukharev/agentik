import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {readAccess, saveAccess} from './access-client';
import {ACCESS_DURATION_MS} from './access-contract';
import {useAccess} from './useAccess';

const accountId = 'a'.repeat(32);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

it('adopts a renewed session when a response for the previous token arrives first', async () => {
  const earlier = {accountId, token: 'v1.earlier.' + 'a'.repeat(43), expiresAt: Date.now() + 5000};
  const updated = {accountId, token: 'v1.updated.' + 'a'.repeat(43), expiresAt: Date.now() + ACCESS_DURATION_MS};
  expect(saveAccess(earlier)).toBe(true);
  let continueRecheck!: (response: Response) => void;
  const request = new Promise<Response>(resolve => {continueRecheck = resolve;});
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) =>
    new Headers(init.headers).get('Authorization') === 'Bearer ' + earlier.token ? request : new Response(null, {status: 200})));
  const {result} = renderHook(() => useAccess());
  expect(result.current.session).toEqual(earlier);

  expect(saveAccess(updated)).toBe(true);
  await act(async () => {continueRecheck(new Response(null, {status: 401}));});
  await waitFor(() => expect(result.current.session).toEqual(updated));
  expect(readAccess()).toEqual(updated);
});

it('updates and caches the plan from the online session check', async () => {
  const earlier = {accountId, token:'v1.plan.'+'a'.repeat(43), expiresAt:Date.now()+ACCESS_DURATION_MS};
  saveAccess(earlier);
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({accountId,expiresAt:earlier.expiresAt,plan:'pro'})));
  const {result}=renderHook(()=>useAccess());
  await waitFor(()=>expect(result.current.session?.plan).toBe('pro'));
  expect(readAccess()?.plan).toBe('pro');
});
