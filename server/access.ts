import {createHmac, timingSafeEqual} from 'node:crypto';
import {ACCESS_DURATION_MS, isAccessSession, normalizeAccessCode, type AccessSession} from '../src/access-contract.ts';

export type AccessConfig = {codesText?: string; accountEmail?: string; accountEmailAliases?: string; accountCode?: string; clientAccounts?: string; proCodes?: string; secret?: string; now?: () => number};
const WINDOW_MS = 5 * 60 * 1000;
const MAX_BODY = 1024;

function parseCodes(text: string): string[] {
  const codes = text.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const match = /^\[([a-z0-9]{6})\](?:\[[^\]]*\])?$/i.exec(line);
      return normalizeAccessCode(match?.[1] ?? line);
    });
  // A malformed list fails closed and never emits the offending row.
  return codes.some(code => code === null) ? [] : [...new Set(codes as string[])];
}

function parseClientAccounts(text?: string): Map<string, string> {
  const accounts = new Map<string, string>();
  if (!text?.trim()) return accounts;
  try {
    const entries: unknown = JSON.parse(text);
    if (!Array.isArray(entries)) return accounts;
    for (const entry of entries) {
      const code = normalizeAccessCode(entry?.code);
      const email = typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : '';
      if (!code || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || accounts.has(code)) return new Map();
      accounts.set(code, email);
    }
    return accounts;
  } catch {
    return new Map();
  }
}

class BodyTooLarge extends Error {}

async function readCredentials(request: Request): Promise<{code: string; email: string} | null> {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(MAX_BODY);
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (length + value.byteLength > MAX_BODY) throw new BodyTooLarge();
      bytes.set(value, length);
      length += value.byteLength;
    }
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)));
    if (!data || typeof data !== 'object' || !('code' in data)) return null;
    const code = normalizeAccessCode(data.code);
    const email = 'email' in data ? data.email : '';
    if (!code || typeof email !== 'string' || email.length > 254) return null;
    return {code, email: email.trim().toLowerCase()};
  } finally {
    reader.releaseLock();
  }
}

export function createAccess(config: AccessConfig) {
  const now = config.now ?? Date.now;
  const secret = config.secret ?? '';
  const accountId = (code: string) => createHmac('sha256', secret).update('account:' + code).digest('hex').slice(0, 32);
  const signature = (payload: string) => createHmac('sha256', secret).update(payload).digest();
  const accounts = new Set(secret.length >= 32 ? parseCodes(config.codesText ?? '').map(accountId) : []);
  const bindings = new Map<string, {emails: Set<string>; stamp: string}>();
  function bind(id: string, email: string, aliases: string[] = []) {
    if (secret.length < 32 || !email) return;
    accounts.add(id);
    bindings.set(id, {emails: new Set([email, ...aliases]), stamp: signature('paired-login:' + email).toString('base64url')});
  }
  const pairedCode = normalizeAccessCode(config.accountCode);
  const pairedEmail = config.accountEmail?.trim().toLowerCase() ?? '';
  const pairedId = pairedCode ? accountId(pairedCode) : undefined;
  if (pairedId) {
    accounts.delete(pairedId);
    const aliases = (config.accountEmailAliases ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    bind(pairedId, pairedEmail, aliases);
  }
  for (const [code, email] of parseClientAccounts(config.clientAccounts)) {
    const id = accountId(code);
    if (id !== pairedId) bind(id, email);
  }
  const proAccounts = new Set((config.proCodes ?? '').split(',').map(normalizeAccessCode).filter((item):item is string => !!item).map(accountId));
  const planFor = (id:string) => proAccounts.has(id) ? {plan:'pro' as const} : {};
  const ready = accounts.size > 0;
  const failures = new Map<string, {until: number; count: number}>();
  let globalFailures = {until: 0, count: 0};

  function verify(token: string | undefined): AccessSession | null {
    if (!ready || !token || token.length >= 512 || !/^v1\.[\w-]+\.[\w-]{43}$/.test(token)) return null;
    const [version, encoded, presented] = token.split('.');
    const signedPayload = version + '.' + encoded;
    const presentedBytes = Buffer.from(presented, 'base64url');
    if (presentedBytes.toString('base64url') !== presented || !timingSafeEqual(signature(signedPayload), presentedBytes)) return null;
    try {
      const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (decoded.binding !== bindings.get(decoded.accountId)?.stamp) return null;
      const session = {accountId: decoded.accountId, expiresAt: decoded.expiresAt, token, ...planFor(decoded.accountId)};
      return isAccessSession(session, now()) && accounts.has(session.accountId) ? session : null;
    } catch {
      return null;
    }
  }

  function issue(id: string): AccessSession {
    const expiresAt = now() + ACCESS_DURATION_MS;
    const payload = 'v1.' + Buffer.from(JSON.stringify({accountId: id, expiresAt, binding:bindings.get(id)?.stamp})).toString('base64url');
    return {accountId: id, expiresAt, ...planFor(id), token: payload + '.' + signature(payload).toString('base64url')};
  }

  async function respond(request: Request, path: string, client: string, headers: Record<string, string>) {
    const out = (status: number, data: unknown, extra = {}) => Response.json(data, {status, headers: {...headers, ...extra}});
    if (!ready) return out(503, {error: 'Проверка кодов сейчас недоступна.'});

    if (path === '/api/access/session') {
      if (request.method !== 'GET') return out(405, {error: 'Используйте GET.'});
      const verified = verify(request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]);
      return verified
        ? out(200, {accountId: verified.accountId, expiresAt: verified.expiresAt, ...planFor(verified.accountId)})
        : out(401, {error: 'Срок входа истёк. Введите код ещё раз.'});
    }

    if (path !== '/api/access/login') return out(404, {error: 'Не найдено.'});
    if (request.method !== 'POST') return out(405, {error: 'Используйте POST.'});
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return out(415, {error: 'Ожидается JSON.'});
    }

    let credentials: Awaited<ReturnType<typeof readCredentials>>;
    try {
      credentials = await readCredentials(request);
    } catch (error) {
      return error instanceof BodyTooLarge
        ? out(413, {error: 'Запрос слишком большой.'})
        : out(400, {error: 'Некорректный запрос.'});
    }
    if (!credentials) return out(400, {error: 'Введите шесть латинских букв или цифр.'});

    const time = now();
    if (globalFailures.until <= time) {
      globalFailures = {until: time + WINDOW_MS, count: 0};
      for (const [ip, entry] of failures) if (entry.until <= time) failures.delete(ip);
    }
    const record = failures.get(client);
    const attempts = record && record.until > time ? record : {until: time + WINDOW_MS, count: 0};
    if (attempts.count >= 6 || globalFailures.count >= 100) {
      const deadline = Math.max(attempts.count >= 6 ? attempts.until : 0, globalFailures.count >= 100 ? globalFailures.until : 0);
      return out(429, {error: 'Слишком много попыток.'}, {'Retry-After': String(Math.ceil((deadline - time) / 1000))});
    }
    const id = accountId(credentials.code);
    const binding = bindings.get(id);
    if (accounts.has(id) && (!binding || binding.emails.has(credentials.email))) return out(200, issue(id));
    attempts.count++;
    failures.set(client, attempts);
    globalFailures.count++;
    return out(401, {error: 'Код не подошёл. Проверьте символы и повторите.'});
  }

  return {ready, respond, verify};
}
