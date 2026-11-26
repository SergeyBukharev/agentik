import {MAX_CHAT_MESSAGE_LENGTH} from './chat-contract.ts';

export const TELEGRAM_SHARE_PREFIX = '/api/telegram/shares';
export const TELEGRAM_SHARE_PAGE_PREFIX = '/agentik/share';
export const TELEGRAM_SHARE_PREVIEW_WIDTH = 1200;
export const TELEGRAM_SHARE_PREVIEW_HEIGHT = 630;
export const MAX_TELEGRAM_SHARE_PREVIEW_BYTES = 192 * 1024;
export const MAX_TELEGRAM_SHARE_MESSAGES = 50;
export const MAX_TELEGRAM_SHARE_TITLE_LENGTH = 100;
export const MAX_TELEGRAM_SHARE_AUTHOR_LENGTH = 100;
export const MAX_TELEGRAM_SHARE_TEXT_LENGTH = MAX_CHAT_MESSAGE_LENGTH;

export type TelegramShareMessage = {
  author: string;
  text: string;
  role: 'user' | 'assistant';
  hasImage?: boolean;
};

export type TelegramShareSnapshot = {title: string; messages: TelegramShareMessage[]};
export type TelegramShareView = TelegramShareSnapshot & {expiresAt: number};
export type TelegramShareLink = {id: string; url: string; expiresAt: number; previewUrl?: string};

export function isTelegramShareId(value: unknown): value is string {
  return typeof value === 'string' && value.length === 59 && /^s_[a-f0-9]{32}_[A-Za-z0-9_-]{24}$/.test(value);
}
