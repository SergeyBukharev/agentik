// @vitest-environment node
import {expect, it} from 'vitest';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isTelegramShareId, type TelegramShareLink} from '../src/telegram-share-contract.ts';
import {createRuntime} from './runtime.ts';
import {createTelegramShares} from './telegram-shares.ts';

const origin = 'https://agentik.example.test';
const prefix = '/api/telegram/shares';
const accounts = [
  {email: 'owner@example.test', code: 'ABC123'},
  {email: 'viewer@example.test', code: 'XYZ789'},
];
const snapshot = {
  title: 'Team notes',
  messages: [
    {author: 'Ashley', text: 'What did we agree?', role: 'user'},
    {author: 'Editor', text: 'Review the draft.', role: 'assistant', hasImage: true},
  ],
};

function setup(options: Parameters<typeof createTelegramShares>[0] = {}) {
  return createRuntime({
    ALLOWED_ORIGIN: origin,
    AGENTIK_ACCESS_SECRET: 'telegram-share-test-session-signature',
    AGENTIK_CLIENT_ACCOUNTS: JSON.stringify(accounts),
  }, undefined, createTelegramShares({botUsername: 'AgentikDemoBot', ...options}));
}

async function login(api: ReturnType<typeof setup>, account = accounts[0]): Promise<string> {
  const result = await api(new Request(`${origin}/api/access/login`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(account),
  }));
  expect(result.status).toBe(200);
  return (await result.json()).token;
}

function manage(method: string, token?: string, body?: unknown, source = 'chat:my-source') {
  return new Request(`${origin}${prefix}?${new URLSearchParams({source})}`, {
    method,
    headers: {Origin: origin, 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function read(id: string) {
  return new Request(`${origin}${prefix}/${id}`);
}

async function publish(api: ReturnType<typeof setup>, token: string, body: unknown = snapshot, source?: string): Promise<TelegramShareLink> {
  const result = await api(manage('PUT', token, body, source));
  expect(result.status).toBe(200);
  return (await result.json()).share;
}

it('allows PUT and DELETE in the Telegram share preflight', async () => {
  const api = setup();
  const response = await api(new Request(`${origin}${prefix}?source=chat:fixture`, {
    method: 'OPTIONS', headers: {Origin: origin},
  }));

  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, PUT, DELETE, OPTIONS');
});

it('returns a compact direct link whose anonymous response exposes only the snapshot fields', async () => {
  const api = setup({botUsername: '@AgentikDemoBot', miniAppShortName: 'widget', now: () => 1_000});
  const token = await login(api);
  const share = await publish(api, token, {
    ...snapshot, accountId: 'private-account',
    messages: snapshot.messages.map(message => ({...message, images: ['data:image/png;base64,AAAA']})),
  });

  expect(isTelegramShareId(share.id)).toBe(true);
  expect(share.url).toBe(`https://t.me/AgentikDemoBot/widget?startapp=${share.id}&mode=compact`);
  expect(share.expiresAt).toBe(86_401_000);
  expect(await (await api(manage('GET', token))).json()).toEqual({share});
  const response = await api(read(share.id));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(await response.json()).toEqual({...snapshot, expiresAt: 86_401_000});
  expect((await api(read(share.id.replace(/.$/, share.id.endsWith('x') ? 'y' : 'x')))).status).toBe(404);
  expect((await api(new Request(read(share.id), {method: 'DELETE'}))).status).toBe(405);
});

it('requires a verified access session and blocks requests from foreign origins', async () => {
  const api = setup();
  const token = await login(api);
  expect((await api(manage('GET'))).status).toBe(401);
  expect((await api(manage('PUT', `${token}x`, snapshot))).status).toBe(401);
  expect((await api(manage('DELETE'))).status).toBe(401);
  const request = manage('PUT', token, snapshot);
  request.headers.set('Origin', 'https://other.example.test');
  expect((await api(request)).status).toBe(403);
});

it('scopes share management to the verified account and keeps room and chat sources distinct', async () => {
  const api = setup();
  const owner = await login(api);
  const viewer = await login(api, accounts[1]);
  const ownerShare = await publish(api, owner);

  expect(await (await api(manage('GET', viewer))).json()).toEqual({share: null});
  expect((await api(manage('DELETE', viewer))).status).toBe(204);
  const viewerShare = await publish(api, viewer, {...snapshot, title: 'Copy'});
  expect(viewerShare.id).not.toBe(ownerShare.id);
  expect(viewerShare.url).toBe(`https://t.me/AgentikDemoBot?startapp=${viewerShare.id}&mode=compact`);
  const roomShare = await publish(api, owner, {title: 'Empty room', messages: []}, 'room:my-source');
  expect(roomShare.id).not.toBe(ownerShare.id);
  expect(await (await api(manage('GET', owner))).json()).toEqual({share: ownerShare});
  expect((await api(read(ownerShare.id))).status).toBe(200);
});

it('persists one active snapshot per account and source across restarts, then revokes it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agentik-telegram-test-'));
  try {
    const api = setup({directory});
    const token = await login(api);
    const original = await publish(api, token);
    const candidates = await Promise.all([
      publish(api, token, {...snapshot, title: 'First version'}),
      publish(api, token, {...snapshot, title: 'Second version'}),
    ]);

    const restarted = setup({directory});
    const {share} = await (await restarted(manage('GET', token))).json();
    expect(candidates).toContainEqual(share);
    expect((await restarted(read(share.id))).status).toBe(200);
    expect((await restarted(read(original.id))).status).toBe(404);
    const previous = candidates.find(candidate => candidate.id !== share.id)!;
    expect((await restarted(read(previous.id))).status).toBe(404);

    expect((await restarted(manage('DELETE', token))).status).toBe(204);
    const afterRevoke = setup({directory});
    expect((await afterRevoke(read(share.id))).status).toBe(404);
    expect(await (await afterRevoke(manage('GET', token))).json()).toEqual({share: null});
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

it('expires both the public view and the managed link at the 24-hour boundary', async () => {
  let now = 1_000_000;
  const api = setup({now: () => now});
  const token = await login(api);
  const share = await publish(api, token);
  now += 86_399_999;
  expect((await api(read(share.id))).status).toBe(200);
  now++;
  expect((await api(read(share.id))).status).toBe(404);
  expect(await (await api(manage('GET', token))).json()).toEqual({share: null});
});

it('bounds incoming snapshots without replacing a valid link when validation fails', async () => {
  const api = setup();
  const token = await login(api);
  const share = await publish(api, token);
  const invalid = [
    {...snapshot, messages: Array.from({length: 51}, () => snapshot.messages[0])},
    {...snapshot, messages: [{author: 'Alice', text: 'x'.repeat(6001), role: 'user'}]},
    {...snapshot, messages: [{author: 'Alice', text: 'Hello', role: 'system'}]},
  ];
  for (const body of invalid) expect((await api(manage('PUT', token, body))).status).toBe(400);
  expect((await api(manage('PUT', token, {...snapshot, extra: 'a'.repeat(2_097_152)}))).status).toBe(413);
  expect((await api(manage('PUT', token, snapshot, 'other:source'))).status).toBe(400);
  expect((await api(read('malformed'))).status).toBe(404);
  expect(await (await api(manage('GET', token))).json()).toEqual({share});
});

it('reports unavailable publishing when no bot is configured', async () => {
  const api = setup({botUsername: undefined});
  const token = await login(api);
  expect((await api(manage('PUT', token, snapshot))).status).toBe(503);
  expect(await (await api(manage('GET', token))).json()).toEqual({share: null});
});
