// @vitest-environment node
import {it, expect} from 'vitest';
import {createHandler} from './app';

const origin = 'http://127.0.0.1:5173';
const fixture = '[Q7J2LM][test label]\r\nA5PX8Y';
const secret = 'test-only-key-at-least-thirty-two-bytes';
const makeHandler = (now = () => 1_000) =>
  createHandler({origin, access: {codesText: fixture, secret, now}});

function login(code: string, headers: HeadersInit = {}) {
  return new Request(origin + '/api/access/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin, ...headers},
    body: JSON.stringify({code}),
  });
}

function session(token: string) {
  return new Request(origin + '/api/access/session', {headers: {Authorization: 'Bearer ' + token}});
}

it('accepts the first bracketed code and emits an opaque 90-day credential', async () => {
  const handler = makeHandler();
  const response = await handler(login('q7j-2lm'));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const verified = await response.json();
  expect(verified.expiresAt).toBe(1_000 + 90 * 86_400_000);
  expect(JSON.stringify(verified)).not.toMatch(/Q7J2LM|test label/i);
  await expect((await handler(session(verified.token))).json()).resolves.toMatchObject({
    accountId: verified.accountId,
    expiresAt: verified.expiresAt,
  });
  expect((await (await handler(login('A5PX8Y'))).json()).accountId).not.toBe(verified.accountId);
});

it('rejects bad format, wrong code, cross-site origin, and invalidated sessions', async () => {
  let now = 1_000;
  const handler = makeHandler(() => now);
  expect((await handler(login('Q7J2LM123'))).status).toBe(400);
  expect((await handler(login('ABCDEF'))).status).toBe(401);
  expect((await handler(login('A5PX8Y', {Origin: 'https://other.example'}))).status).toBe(403);
  const {token} = await (await handler(login('A5PX8Y'))).json();
  expect((await handler(session(token + 'x'))).status).toBe(401);
  now += 90 * 86_400_000;
  expect((await handler(session(token))).status).toBe(401);
  expect((await createHandler({origin, access: {codesText: '[Q7J2LM][test]', secret}})(session(token))).status).toBe(401);
});

it('throttles repeated guesses and releases the limit when the window ends', async () => {
  let now = 1_000;
  const handler = makeHandler(() => now);
  for (let i = 0; i < 6; i++) expect((await handler(login('ABCDEF'), 'local')).status).toBe(401);
  const throttled = await handler(login('A5PX8Y'), 'local');
  expect(throttled.status).toBe(429);
  expect(Number(throttled.headers.get('Retry-After'))).toBeGreaterThan(0);
  now += 300_001;
  expect((await handler(login('A5PX8Y'), 'local')).status).toBe(200);
});

it('does not accept legacy provider tokens when code authentication is enabled', async () => {
  const handler = createHandler({origin, localToken: 'legacy', access: {codesText: fixture, secret}});
  const response = await handler(new Request(origin + '/api/chat', {
    method: 'POST', headers: {Authorization: 'Bearer legacy'},
  }));
  expect(response.status).toBe(401);
});
