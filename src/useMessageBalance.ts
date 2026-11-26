import {useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {
  FREE_MESSAGE_BALANCE, MESSAGE_PRICE, messageBalanceKey, readMessageBalance,
  submitMessageBudget, subscribeToMessageBalance, type MessageSubmission,
} from './message-balance';

export function useMessageBalance(accountId: string, pro: boolean) {
  const scope = useMemo(() => ({accountId, pro}), [accountId, pro]);
  const active = useRef<{scope: typeof scope; controller: AbortController} | null>(null);
  useLayoutEffect(() => {
    const controller = new AbortController();
    active.current = {scope, controller};
    return () => {
      active.current = null;
      controller.abort();
    };
  }, [scope]);

  const subscribe = useCallback((notify: () => void) => subscribeToMessageBalance(accountId, notify), [accountId]);
  const snapshot = useCallback(() => pro ? Infinity : readMessageBalance(accountId), [accountId, pro]);
  const remaining = useSyncExternalStore(subscribe, snapshot, () => pro ? Infinity : FREE_MESSAGE_BALANCE);

  const submit = useCallback(async (commit: () => boolean): Promise<MessageSubmission> => {
    const lifetime = active.current;
    if (lifetime?.scope !== scope) return 'failed';
    const signal = lifetime.controller.signal;
    let started = false;
    const run = (): MessageSubmission => {
      started = true;
      if (signal.aborted) return 'failed';
      try {
        return submitMessageBudget(scope.accountId, scope.pro, commit);
      } catch {
        return 'failed';
      }
    };
    try {
      const locks = navigator.locks;
      if (locks) return await locks.request(messageBalanceKey(scope.accountId), {signal}, run);
    } catch {
      if (started) return 'failed';
    }
    return run();
  }, [scope]);

  return {remaining, price:pro ? 0 : MESSAGE_PRICE, submit};
}
