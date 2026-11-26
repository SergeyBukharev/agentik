import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {mkdir, open, readFile, rename, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import type {AccessSession} from '../src/access-contract.ts';
import {
  isTelegramShareId, MAX_TELEGRAM_SHARE_AUTHOR_LENGTH, MAX_TELEGRAM_SHARE_MESSAGES,
  MAX_TELEGRAM_SHARE_TEXT_LENGTH, MAX_TELEGRAM_SHARE_TITLE_LENGTH, TELEGRAM_SHARE_PREFIX,
  type TelegramShareLink, type TelegramShareMessage, type TelegramShareSnapshot,
} from '../src/telegram-share-contract.ts';

export type TelegramShareHandler = (
  request: Request, session: AccessSession | null, headers: Record<string, string>,
) => Promise<Response>;

type TelegramShareOptions = {
  directory?: string;
  botUsername?: string;
  miniAppShortName?: string;
  now?: () => number;
};

type StoredShare = {link: TelegramShareLink; snapshot: TelegramShareSnapshot};

const SHARE_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const OWNER_METHODS = 'GET, PUT, DELETE';
const PUBLIC_PREFIX = `${TELEGRAM_SHARE_PREFIX}/`;

class ShareBodyTooLarge extends Error {}

function parseSnapshot(value: unknown): TelegramShareSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const {title, messages} = value as Partial<TelegramShareSnapshot>;
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TELEGRAM_SHARE_TITLE_LENGTH
    || !Array.isArray(messages) || messages.length > MAX_TELEGRAM_SHARE_MESSAGES) return null;

  const sanitized: TelegramShareMessage[] = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object') return null;
    const {author, text, role, hasImage} = message;
    if (typeof author !== 'string' || !author.trim() || author.length > MAX_TELEGRAM_SHARE_AUTHOR_LENGTH
      || typeof text !== 'string' || text.length > MAX_TELEGRAM_SHARE_TEXT_LENGTH
      || (role !== 'user' && role !== 'assistant')
      || (hasImage !== undefined && typeof hasImage !== 'boolean')) return null;
    sanitized.push({author, text, role, ...(hasImage === undefined ? {} : {hasImage})});
  }
  return {title, messages: sanitized};
}

async function readSnapshot(request: Request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new ShareBodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let size = 0;
  let json = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new ShareBodyTooLarge();
      json += decoder.decode(value, {stream: true});
    }
    return parseSnapshot(JSON.parse(json + decoder.decode()));
  } finally {
    reader.releaseLock();
  }
}

function telegramTarget({botUsername, miniAppShortName}: TelegramShareOptions) {
  const bot = botUsername?.trim().replace(/^@/, '');
  const app = miniAppShortName?.trim();
  if (!bot || !/^[a-z0-9_]{5,32}$/i.test(bot) || (app && !/^[a-z0-9_]{1,64}$/i.test(app))) return null;
  return app ? `https://t.me/${bot}/${app}` : `https://t.me/${bot}`;
}

async function replaceFile(temporary: string, destination: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, destination);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows can reject a concurrent replacement while the other rename is finishing.
      if (process.platform !== 'win32' || attempt === 2 || (code !== 'EPERM' && code !== 'EBUSY')) throw error;
      await delay(10 * (attempt + 1));
    }
  }
}

function createStore(directory: string | undefined, now: () => number) {
  if (!directory) {
    const records = new Map<string, StoredShare>();
    return {
      async read(scope: string) { return records.get(scope) ?? null; },
      async write(scope: string, share: StoredShare) {
        const time = now();
        for (const [key, record] of records) if (record.link.expiresAt <= time) records.delete(key);
        records.set(scope, share);
      },
      async remove(scope: string) { records.delete(scope); },
    };
  }

  const root = resolve(directory);
  const pathFor = (scope: string) => join(root, `${scope}.json`);
  return {
    async read(scope: string): Promise<StoredShare | null> {
      try {
        const stored: StoredShare = JSON.parse(await readFile(pathFor(scope), 'utf8'));
        const {id, url, expiresAt} = stored.link;
        const snapshot = parseSnapshot(stored.snapshot);
        if (!isTelegramShareId(id) || id.slice(2, 34) !== scope || typeof url !== 'string'
          || !Number.isSafeInteger(expiresAt) || !snapshot) return null;
        return {link: {id, url, expiresAt}, snapshot};
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return null;
        throw error;
      }
    },
    async write(scope: string, share: StoredShare) {
      await mkdir(root, {recursive: true, mode: 0o700});
      const temporary = join(root, `${share.link.id}.tmp`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        try {
          await file.writeFile(JSON.stringify(share), 'utf8');
          await file.sync();
        } finally {
          await file.close();
        }
        await replaceFile(temporary, pathFor(scope));
      } catch (error) {
        await rm(temporary, {force: true}).catch(() => {});
        throw error;
      }
    },
    async remove(scope: string) { await rm(pathFor(scope), {force: true}); },
  };
}

export function createTelegramShares(options: TelegramShareOptions): TelegramShareHandler {
  const now = options.now ?? Date.now;
  const target = telegramTarget(options);
  const store = createStore(options.directory, now);

  async function current(scope: string) {
    const record = await store.read(scope);
    return record && record.link.expiresAt > now() ? record : null;
  }

  return async (request, session, baseHeaders) => {
    const headers = {...baseHeaders, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex'};
    const out = (status: number, data: unknown, extra?: Record<string, string>) => Response.json(data, {status, headers: {...headers, ...extra}});
    const notFound = () => out(404, {error: 'Ссылка недоступна.'});
    const url = new URL(request.url);
    const method = request.method;
    try {
      if (url.pathname !== TELEGRAM_SHARE_PREFIX) {
        const id = url.pathname.slice(PUBLIC_PREFIX.length);
        if (!url.pathname.startsWith(PUBLIC_PREFIX) || !isTelegramShareId(id)) return notFound();
        if (method !== 'GET') return out(405, {error: 'Используйте GET.'}, {Allow: 'GET'});
        const record = await current(id.slice(2, 34));
        if (!record || !timingSafeEqual(Buffer.from(id), Buffer.from(record.link.id))) return notFound();
        return out(200, {...record.snapshot, expiresAt: record.link.expiresAt});
      }

      if (!session) return out(401, {error: 'Войдите по коду доступа.'});
      if (method !== 'GET' && method !== 'PUT' && method !== 'DELETE') {
        return out(405, {error: 'Используйте GET, PUT или DELETE.'}, {Allow: OWNER_METHODS});
      }
      const sources = url.searchParams.getAll('source');
      const [source] = sources;
      if (sources.length !== 1 || !/^(?:chat|room):[^\x00-\x1f\x7f]{1,128}$/.test(source)
        || /[\x00-\x1f\x7f]/.test(source)) return out(400, {error: 'Укажите чат.'});
      const scope = createHash('sha256').update(JSON.stringify([session.accountId, source])).digest('hex').slice(0, 32);

      if (method === 'GET') return out(200, {share: (await current(scope))?.link ?? null});
      if (method === 'DELETE') {
        await store.remove(scope);
        return new Response(null, {status: 204, headers});
      }

      if (!target) return out(503, {error: 'Telegram ещё не подключён.'});
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return out(415, {error: 'Ожидается JSON.'});
      }
      let snapshot: TelegramShareSnapshot | null;
      try {
        snapshot = await readSnapshot(request);
      } catch (error) {
        if (error instanceof ShareBodyTooLarge) return out(413, {error: 'Запрос слишком большой.'});
        return out(400, {error: 'Некорректный JSON.'});
      }
      if (!snapshot) return out(400, {error: 'Проверьте историю чата.'});

      const id = `s_${scope}_${randomBytes(18).toString('base64url')}`;
      const query = new URLSearchParams({startapp: id, mode: 'compact'});
      const link = {id, url: `${target}?${query}`, expiresAt: now() + SHARE_DURATION_MS};
      await store.write(scope, {link, snapshot});
      return out(200, {share: link});
    } catch {
      return out(503, {error: 'Публикация в Telegram временно недоступна.'});
    }
  };
}
