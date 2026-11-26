import {isAccessSession, type AccessSession} from './access-contract';

const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const ACTIVE = 'agentik:access:active';
const SIGNED_OUT = 'signed-out';
export const accessKey = (account: string) => `agentik:access:${account}`;

export class AccessError extends Error {
  constructor(public reason: 'invalid' | 'offline' | 'unavailable' | 'limited' | 'format', message: string) {
    super(message);
  }
}

async function request(path: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  if (!navigator.onLine) throw new AccessError('offline', 'Подключитесь к интернету, чтобы проверить код.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 7000);
  if (signal.aborted) abort();
  signal.addEventListener('abort', abort, {once: true});
  try {
    return await fetch(apiOrigin + '/api/access/' + path, {...init, signal: controller.signal, cache: 'no-store'});
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AccessError(navigator.onLine ? 'unavailable' : 'offline',
      'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export async function logIn(code: string, signal: AbortSignal, email?: string): Promise<AccessSession> {
  const response = await request('login', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, ...(email ? {email} : {})}),
  }, signal);
  if (response.status === 401) throw new AccessError('invalid', 'Код не подошёл. Проверьте код и email.');
  if (response.status === 400) throw new AccessError('format', 'Введите шесть латинских букв или цифр.');
  if (response.status === 429) {
    const minutes = Math.max(1, Math.ceil((Number(response.headers.get('Retry-After')) || 60) / 60));
    throw new AccessError('limited', `Слишком много попыток. Подождите ${minutes} мин. и повторите.`);
  }
  const value: unknown = response.ok ? await response.json().catch(() => null) : null;
  if (!isAccessSession(value)) throw new AccessError('unavailable', 'Сервис проверки кодов временно недоступен.');
  return value;
}

export async function checkAccessSession(session: AccessSession, signal: AbortSignal) {
  const response = await request('session', {headers: {Authorization: 'Bearer ' + session.token}}, signal);
  if (response.status === 401) return null;
  if (response.status !== 200) return session;
  const data = await response.json().catch(() => null);
  if (!data || data.accountId !== session.accountId || data.expiresAt !== session.expiresAt) return session;
  return {...session, plan:data.plan === 'pro' ? 'pro' as const : undefined};
}

export function readAccountAccess(account: string): AccessSession | null {
  try {
    const session: unknown = JSON.parse(localStorage.getItem(accessKey(account)) ?? 'null');
    return isAccessSession(session) && session.accountId === account ? session : null;
  } catch {
    return null;
  }
}

export function readAccess(): AccessSession | null {
  try {
    const account = sessionStorage.getItem(ACTIVE) ?? localStorage.getItem(ACTIVE);
    if (!account || account === SIGNED_OUT || !/^[a-f0-9]{32}$/.test(account)) return null;
    const session = readAccountAccess(account);
    if (!session) return null;
    try { sessionStorage.setItem(ACTIVE, account); } catch { /* The saved default remains usable. */ }
    return session;
  } catch {
    return null;
  }
}

export function refreshSavedAccess(session: AccessSession) {
  try {
    if (readAccountAccess(session.accountId)?.token === session.token) {
      localStorage.setItem(accessKey(session.accountId), JSON.stringify(session));
    }
  } catch {}
}

export function saveAccess(session: AccessSession) {
  try {
    localStorage.setItem(accessKey(session.accountId), JSON.stringify(session));
    localStorage.setItem(ACTIVE, session.accountId);
    sessionStorage.setItem(ACTIVE, session.accountId);
    return true;
  } catch {
    return false;
  }
}

export function clearAccess(session: AccessSession) {
  try { sessionStorage.setItem(ACTIVE, SIGNED_OUT); } catch { /* Storage is optional. */ }
  try {
    localStorage.removeItem(accessKey(session.accountId));
    if (localStorage.getItem(ACTIVE) === session.accountId) localStorage.removeItem(ACTIVE);
  } catch { /* In-memory access is cleared by the caller. */ }
}
