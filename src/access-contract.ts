export const ACCESS_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export type AccessSession = {
  accountId: string;
  token: string;
  expiresAt: number;
  plan?: 'pro';
};

export function normalizeAccessCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const code = value.replace(/[\s-]/g, '');
  return /^[a-z0-9]{6}$/i.test(code) ? code.toUpperCase() : null;
}

export function isAccessSession(value: unknown, now = Date.now()): value is AccessSession {
  if (!value || typeof value !== 'object') return false;
  const {accountId, token, expiresAt, plan} = value as Partial<AccessSession>;
  return typeof accountId === 'string' && /^[a-f0-9]{32}$/.test(accountId)
    && (plan === undefined || plan === 'pro')
    && typeof token === 'string' && token.length < 512 && /^v1\.[\w-]+\.[\w-]{43}$/.test(token)
    && typeof expiresAt === 'number' && Number.isSafeInteger(expiresAt)
    && expiresAt > now && expiresAt <= now + ACCESS_DURATION_MS + 60_000;
}
