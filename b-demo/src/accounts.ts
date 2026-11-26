export type Identity = {id: string; name: string; email: string};
type Account = Identity & {salt: string; verifier: string};
export type AuthMode = 'choose' | 'create' | 'sign-in';

const accountsKey = 'agentik:b-demo:accounts:v1';
const sessionKey = 'agentik:b-demo:active:v1';
const sessionLength = 90 * 24 * 60 * 60 * 1000;

function readAccounts(): Account[] {
  const data = JSON.parse(localStorage.getItem(accountsKey) ?? '[]');
  if (!Array.isArray(data)) return [];
  return data.filter((record): record is Account => record && typeof record.id === 'string'
    && typeof record.name === 'string' && typeof record.email === 'string'
    && typeof record.salt === 'string' && typeof record.verifier === 'string');
}

function identity({id, name, email}: Account): Identity {
  return {id, name, email};
}

export function activeAccount(): Identity | undefined {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as {id: string; expiresAt: number} | null;
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return;
    const account = readAccounts().find(item => item.id === session.id);
    if (account) return identity(account);
  } catch { /* Storage may be disabled or its value may be invalid. */ }
}

export function rememberAccount(account: Identity) {
  localStorage.setItem(sessionKey, JSON.stringify({id: account.id, expiresAt: Date.now() + sessionLength}));
}

export function signOut() {
  localStorage.removeItem(sessionKey);
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function verifyCode(code: string, salt: string) {
  const bytes = Uint8Array.from(atob(salt), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', iterations: 100_000, salt: bytes}, key, 256);
  return toBase64(new Uint8Array(result));
}

export async function authenticate(mode: 'create' | 'sign-in', form: {email: string; name: string; code: string}, signal: AbortSignal): Promise<Identity> {
  const email = form.email.trim().toLowerCase();
  const name = form.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || !/^\d{6}$/u.test(form.code) || (mode === 'create' && !name)) {
    throw new Error('input');
  }
  const accounts = readAccounts();
  const existing = accounts.find(account => account.email === email);
  if (mode === 'sign-in') {
    if (!existing || await verifyCode(form.code, existing.salt) !== existing.verifier) throw new Error('credentials');
    return identity(existing);
  }
  if (existing) throw new Error('exists');
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const verifier = await verifyCode(form.code, salt);
  signal.throwIfAborted();
  const account = {id: crypto.randomUUID(), email, name, salt, verifier};
  const latest = readAccounts();
  if (latest.some(item => item.email === email)) throw new Error('exists');
  localStorage.setItem(accountsKey, JSON.stringify([...latest, account]));
  return identity(account);
}
