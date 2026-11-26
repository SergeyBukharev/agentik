export const MAX_MEDIA_CHAT_BODY_BYTES = 400_000;
export const MAX_CHAT_BODY_BYTES = 65_536;
export const MAX_CHAT_MESSAGES = 20;
export const MAX_CHAT_MESSAGE_LENGTH = 6000;
export const MAX_CHAT_DOCUMENT_LENGTH = 4000;
export const MAX_CHAT_DOCUMENT_NAME_LENGTH = 160;

export type ChatDocument = {id: string; name: string; text: string; truncated?: true};

export function isChatDocument(value: unknown): value is ChatDocument {
  if (!value || typeof value !== 'object') return false;
  const {id, name, text, truncated} = value as Partial<ChatDocument>;
  return typeof id === 'string' && !!id && id.length <= 128
    && typeof name === 'string' && !!name.trim() && name.length <= MAX_CHAT_DOCUMENT_NAME_LENGTH
    && typeof text === 'string' && !!text.trim() && text.length <= MAX_CHAT_DOCUMENT_LENGTH
    && (truncated === undefined || truncated === true);
}
