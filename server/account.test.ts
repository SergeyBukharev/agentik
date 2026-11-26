import {expect, it} from 'vitest';
import {createAccess} from './access';

it('includes the footer upgrade offer only for the paired owner on Free', async () => {
  const config = {accountEmail:'owner@example.test', accountCode:'654ABC', accountEmailAliases:'alias@example.test', codesText:'X44AQ3', secret:'fixture-secret-used-for-auth-tests-only'};
  const logIn = async (access: ReturnType<typeof createAccess>, code: string, email?: string) => {
    const response = await access.respond(new Request('http://localhost/api/access/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code, email}),
    }), '/api/access/login', 'test-client', {});
    expect(response.ok).toBe(true);
    return response.json();
  };
  const free = createAccess(config);
  const owner = await logIn(free, config.accountCode, 'alias@example.test');
  expect(owner.offerPro).toBe(true);
  expect(free.verify(owner.token)?.offerPro).toBe(true);
  expect((await logIn(free, 'X44AQ3')).offerPro).toBeUndefined();
  const upgraded = createAccess({...config, proCodes:config.accountCode});
  expect(upgraded.verify(owner.token)).toMatchObject({plan:'pro'});
  expect(upgraded.verify(owner.token)?.offerPro).toBeUndefined();
});

it('requires the configured email for the paired code even when it is also in the legacy list', async () => {
  const access = createAccess({codesText:'[654ABC][legacy]', accountEmail:'owner@example.test', accountCode:'654ABC', secret:'fixture-secret-used-for-auth-tests-only'});
  const login = (body: object) => access.respond(new Request('http://localhost/api/access/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}), '/api/access/login','test-client',{});
  expect((await login({code:'654ABC'})).status).toBe(401);
  expect((await login({code:'654ABC', email:'wrong@example.test'})).status).toBe(401);
  expect((await login({code:'654ABC', email:' OWNER@example.test '})).status).toBe(200);
});

it('invalidates old code-only tokens after the same account is paired with an email', async () => {
  const base={codesText:'654ABC',secret:'fixture-secret-used-for-auth-tests-only'};
  const prior=createAccess(base);
  const response=await prior.respond(new Request('http://localhost/api/access/login',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'654ABC'})
  }),'/api/access/login','test-client',{});
  const {token}=await response.json();
  const updated=createAccess({...base,accountEmail:'owner@example.test',accountCode:'654ABC'});
  expect(prior.verify(token)).not.toBeNull();
  expect(updated.verify(token)).toBeNull();
});

it('accepts explicitly configured alternate emails for the same paired account', async () => {
  const base = {
    accountEmail: 'owner@example.test',
    accountCode: '654ABC',
    secret: 'fixture-secret-used-for-auth-tests-only',
  };
  const prior = createAccess(base);
  const updated = createAccess({...base, accountEmailAliases: ' , Alt.Owner@example.test, backup@example.test '});
  const login = (access: ReturnType<typeof createAccess>, email: string) => access.respond(
    new Request('http://localhost/api/access/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code: base.accountCode, email}),
    }),
    '/api/access/login',
    'test-client',
    {},
  );
  const initial = await (await login(prior, base.accountEmail)).json();
  const alternate = await login(updated, ' ALT.OWNER@EXAMPLE.TEST ');

  expect(alternate.status).toBe(200);
  const current = await alternate.json();
  expect(current.accountId).toBe(initial.accountId);
  expect(updated.verify(initial.token)?.accountId).toBe(initial.accountId);
  expect(updated.verify(current.token)?.accountId).toBe(initial.accountId);
  expect((await login(updated, base.accountEmail)).status).toBe(200);
  expect((await login(updated, 'backup@example.test')).status).toBe(200);
  expect((await login(updated, '')).status).toBe(401);
  expect((await login(updated, 'unlisted@example.test')).status).toBe(401);
});

it('issues a separate client session and revokes it when the configured pair is removed', async () => {
  const secret = 'fixture-secret-used-for-auth-tests-only';
  const owner = {accountEmail:'owner@example.test', accountCode:'654ABC', secret};
  const clients = JSON.stringify([{email:'viewer@example.test', code:'758X2D'}]);
  const login = (access: ReturnType<typeof createAccess>, email: string, code: string) => access.respond(
    new Request('http://localhost/api/access/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, code})}),
    '/api/access/login', 'test-client', {},
  );
  const existing = createAccess(owner);
  const ownerSession = await (await login(existing, owner.accountEmail, owner.accountCode)).json();
  const access = createAccess({...owner, clientAccounts:clients, codesText:'[758X2D][legacy]'});
  expect((await login(access, '', '758X2D')).status).toBe(401);
  expect((await login(access, owner.accountEmail, '758X2D')).status).toBe(401);
  expect((await login(access, 'viewer@example.test', owner.accountCode)).status).toBe(401);
  const client = await login(access, ' VIEWER@example.test ', '758X2D');
  expect(client.status).toBe(200);
  const session = await client.json();
  expect(session.accountId).not.toBe(ownerSession.accountId);
  expect(access.verify(session.token)?.accountId).toBe(session.accountId);
  expect(access.verify(ownerSession.token)?.accountId).toBe(ownerSession.accountId);
  expect(existing.verify(session.token)).toBeNull();
  expect(createAccess({...owner, codesText:'758X2D'}).verify(session.token)).toBeNull();
});
