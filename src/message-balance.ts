export const FREE_MESSAGE_BALANCE = 2;
export const MESSAGE_PRICE = 1;
export type MessageSubmission = 'accepted' | 'last' | 'blocked' | 'failed';

const lowestSeen = new Map<string, number>();
const changes = new EventTarget();

export function messageBalanceKey(accountId: string) {
  return 'agentik:message-balance:' + accountId;
}

function remember(accountId: string, value: string | null) {
  const previous = lowestSeen.get(accountId) ?? FREE_MESSAGE_BALANCE;
  const remaining = value === '0' || value === '1' ? Math.min(previous, Number(value)) : previous;
  if (remaining < previous) lowestSeen.set(accountId, remaining);
  return remaining;
}

export function readMessageBalance(accountId: string) {
  try {
    return remember(accountId, localStorage.getItem(messageBalanceKey(accountId)));
  } catch {
    return lowestSeen.get(accountId) ?? FREE_MESSAGE_BALANCE;
  }
}

export function subscribeToMessageBalance(accountId: string, notify: () => void) {
  const key = messageBalanceKey(accountId);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    remember(accountId, event.newValue);
    notify();
  };
  changes.addEventListener(key, notify);
  window.addEventListener('storage', onStorage);
  return () => {
    changes.removeEventListener(key, notify);
    window.removeEventListener('storage', onStorage);
  };
}

export function submitMessageBudget(accountId: string, pro: boolean, commit: () => boolean): MessageSubmission {
  if (pro) return commit() ? 'accepted' : 'failed';
  const remaining = readMessageBalance(accountId);
  if (remaining < MESSAGE_PRICE) return 'blocked';
  if (!commit()) return 'failed';

  const next = remaining - MESSAGE_PRICE;
  lowestSeen.set(accountId, next);
  const key = messageBalanceKey(accountId);
  try {
    localStorage.setItem(key, String(next));
  } catch { /* The current page retains its last observed balance. */ }
  changes.dispatchEvent(new Event(key));
  return next === 0 ? 'last' : 'accepted';
}
