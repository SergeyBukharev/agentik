export function createChatDrafts() {
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();

  return {
    get(chatKey: string) {
      return values.get(chatKey) ?? '';
    },
    set(chatKey: string, text: string) {
      if ((values.get(chatKey) ?? '') === text) return;
      if (text) values.set(chatKey, text);
      else values.delete(chatKey);
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {listeners.delete(listener);};
    },
  };
}

export type ChatDrafts = ReturnType<typeof createChatDrafts>;
