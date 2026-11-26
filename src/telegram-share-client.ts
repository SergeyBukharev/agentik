import {
  isTelegramShareId, MAX_TELEGRAM_SHARE_AUTHOR_LENGTH, MAX_TELEGRAM_SHARE_MESSAGES,
  MAX_TELEGRAM_SHARE_TEXT_LENGTH, MAX_TELEGRAM_SHARE_TITLE_LENGTH, TELEGRAM_SHARE_PREFIX,
  type TelegramShareLink, type TelegramShareMessage, type TelegramShareSnapshot, type TelegramShareView,
} from './telegram-share-contract';

const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + TELEGRAM_SHARE_PREFIX;

export type TelegramShareSource = `chat:${string}` | `room:${string}`;
type ShareAction = {method: 'GET'; signal: AbortSignal}
  | {method: 'PUT'; snapshot: TelegramShareSnapshot}
  | {method: 'DELETE'};

export class TelegramShareHttpError extends Error {
  constructor(readonly status: number) {
    super('Telegram share request failed');
  }
}

export function telegramShareSnapshot<T>(title: string, messages: T[], project: (message: T) => TelegramShareMessage): TelegramShareSnapshot {
  return {
    title: title.trim().slice(0, MAX_TELEGRAM_SHARE_TITLE_LENGTH),
    messages: messages.slice(-MAX_TELEGRAM_SHARE_MESSAGES).map(message => {
      const {author, role, text, hasImage} = project(message);
      return {
        author: author.trim().slice(0, MAX_TELEGRAM_SHARE_AUTHOR_LENGTH),
        role,
        text: text.slice(0, MAX_TELEGRAM_SHARE_TEXT_LENGTH),
        ...(hasImage && {hasImage: true}),
      };
    }),
  };
}

async function request(path: string, {signal, ...init}: RequestInit) {
  if (!navigator.onLine) throw new Error('Offline');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, {once:true});
  const timeout = setTimeout(abort, 12_000);
  try {
    const response = await fetch(apiUrl + path, {
      ...init, signal:controller.signal, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer',
    });
    if (!response.ok) throw new TelegramShareHttpError(response.status);
    return response.status === 204 ? null : await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function isShareLink(share: TelegramShareLink | null | undefined): share is TelegramShareLink {
  if (!share || !isTelegramShareId(share.id) || !Number.isFinite(share.expiresAt) || typeof share.url !== 'string') return false;
  try {
    const url = new URL(share.url);
    return url.origin === 'https://t.me' && !url.username && !url.password && url.searchParams.get('startapp') === share.id;
  } catch {
    return false;
  }
}

export async function manageTelegramShare(source: TelegramShareSource, token: string, action: ShareAction): Promise<TelegramShareLink | null> {
  const snapshot = action.method === 'PUT' ? action.snapshot : undefined;
  const data = await request('?source=' + encodeURIComponent(source), {
    method:action.method,
    signal:action.method === 'GET' ? action.signal : undefined,
    headers:{
      Authorization: 'Bearer ' + token,
      ...(snapshot && {'Content-Type': 'application/json'}),
    },
    body:snapshot && JSON.stringify(snapshot),
  });
  if (action.method === 'DELETE' || (action.method === 'GET' && data?.share === null)) return null;
  if (!isShareLink(data?.share)) throw new Error('Invalid Telegram share link');
  if (data.share.expiresAt > Date.now()) return data.share;
  if (action.method === 'GET') return null;
  throw new Error('Telegram share has expired');
}

export async function readTelegramShare(id: string, signal: AbortSignal): Promise<TelegramShareView> {
  const view: TelegramShareView | null = await request('/' + encodeURIComponent(id), {signal});
  if (!view || typeof view.title !== 'string' || !Number.isFinite(view.expiresAt) || !Array.isArray(view.messages)
    || view.messages.length > MAX_TELEGRAM_SHARE_MESSAGES || !view.messages.every(message => message &&
      (message.role === 'user' || message.role === 'assistant') && typeof message.author === 'string' && typeof message.text === 'string')) {
    throw new Error('Invalid Telegram share');
  }
  return view;
}
