import {expect, test} from 'vitest';
import preview from './sites-preview';

const origin = 'https://preview.example.test';
const env = {
  AGENTIK_ACCESS_SECRET: 'preview-integration-fixture-signing-key',
  AGENTIK_CLIENT_ACCOUNTS: '[{"email":"reviewer@example.test","code":"92VX1A"}]',
  AGENTIK_PRO_CODES: '92VX1A',
  ASSETS: {fetch: async (request: Request) => new Response(new URL(request.url).pathname)},
};
const owner = {'OAI-Authenticated-User-Id': 'preview-owner-fixture'};

test('requires visitor identity before serving the preview or processing a code', async () => {
  const landing = await preview.fetch(new Request(origin + '/agentik/'), env);
  expect(landing.status).toBe(401);
  const login = await preview.fetch(new Request(origin + '/api/access/login', {method: 'POST'}), env);
  expect(login.status).toBe(401);
});

test('serves the Agentik build and verifies the configured account on the same origin', async () => {
  const landing = await preview.fetch(new Request(origin + '/agentik/', {headers: owner}), env);
  expect(await landing.text()).toBe('/agentik/index.html');

  const login = (email: string) => preview.fetch(new Request(origin + '/api/access/login', {
    method: 'POST',
    headers: {...owner, Origin: origin, 'Content-Type': 'application/json'},
    body: JSON.stringify({email, code: '92VX1A'}),
  }), env);
  expect((await login('other@example.test')).status).toBe(401);
  const accepted = await login('reviewer@example.test');
  expect(accepted.status).toBe(200);
  expect(accepted.headers.get('Cache-Control')).toBe('no-store');
  const session = await accepted.json();
  expect(session.plan).toBe('pro');

  const refreshed = await preview.fetch(new Request(origin + '/api/access/session', {
    headers: {...owner, Authorization: `Bearer ${session.token}`},
  }), env);
  expect(refreshed.status).toBe(200);
  expect(await refreshed.json()).toEqual({accountId: session.accountId, expiresAt: session.expiresAt, plan: 'pro'});
});
