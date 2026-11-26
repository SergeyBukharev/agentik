import type {ChatDocument} from './chat-contract';
import type {ChatImage} from './chat-media';

export type ChatDraftAttachment = {kind: 'document'; document: ChatDocument} | {kind: 'image'; image: ChatImage};

export function createChatDrafts() {
  const values = new Map<string, string>();
  const attachments = new Map<string, ChatDraftAttachment>();
  const listeners = new Set<() => void>();
  const notify = () => {for (const listener of listeners) listener();};

  return {
    get(chatKey: string) {
      return values.get(chatKey) ?? '';
    },
    set(chatKey: string, text: string) {
      if ((values.get(chatKey) ?? '') === text) return;
      if (text) values.set(chatKey, text);
      else values.delete(chatKey);
      notify();
    },
    getAttachment(chatKey: string) {
      return attachments.get(chatKey);
    },
    setAttachment(chatKey: string, attachment?: ChatDraftAttachment) {
      if (attachments.get(chatKey) === attachment) return;
      if (attachment) attachments.set(chatKey, attachment);
      else attachments.delete(chatKey);
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {listeners.delete(listener);};
    },
  };
}

export type ChatDrafts = ReturnType<typeof createChatDrafts>;
