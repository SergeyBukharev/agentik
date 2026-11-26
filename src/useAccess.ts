import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {accessKey, clearAccess, checkAccessSession, refreshSavedAccess, readAccess, readAccountAccess, saveAccess} from './access-client';
import type {AccessSession} from './access-contract';

function subscribeToConnection(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeToConnection, () => navigator.onLine, () => true);
}

export function useAccess() {
  const [session, setSession] = useState(readAccess);
  const [persisted, setPersisted] = useState(true);
  const [notice, setNotice] = useState('');

  const accept = useCallback((value: AccessSession) => {
    setPersisted(saveAccess(value));
    setNotice('');
    setSession(value);
  }, []);

  const signOut = useCallback(() => {
    if (session) clearAccess(session);
    setNotice('');
    setSession(null);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const latest = readAccountAccess(session.accountId);
      if (latest && latest.token !== session.token) {
        setSession(latest);
        return;
      }
      clearAccess(session);
      setNotice('Срок входа истёк. Введите код ещё раз.');
      setSession(null);
    };
    const checkTime = () => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) expire();
      else timer = setTimeout(checkTime, Math.min(remaining, 2_147_483_647));
    };
    const recheck = () => {
      if (Date.now() >= session.expiresAt) return expire();
      void checkAccessSession(session, controller.signal).then(accepted => {
        if (controller.signal.aborted) return;
        if (!accepted) return expire();
        if (accepted.plan !== session.plan) {
          refreshSavedAccess(accepted);
          setSession(accepted);
        }
      }).catch(() => { /* A valid previously checked session remains available offline. */ });
    };
    const sync = (event: StorageEvent) => {
      if (event.key === accessKey(session.accountId) && event.newValue !== null) {
        const latest = readAccountAccess(session.accountId);
        if (latest && (latest.token !== session.token || latest.plan !== session.plan)) setSession(latest);
        return;
      }
      if (event.key === null || (event.key === accessKey(session.accountId) && event.newValue === null)) {
        controller.abort();
        setNotice('');
        setSession(null);
      }
    };
    checkTime();
    recheck();
    const checkOnFocus = () => { if (Date.now() >= session.expiresAt) expire(); };
    window.addEventListener('storage', sync);
    window.addEventListener('online', recheck);
    window.addEventListener('focus', checkOnFocus);
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener('storage', sync);
      window.removeEventListener('online', recheck);
      window.removeEventListener('focus', checkOnFocus);
    };
  }, [session]);

  return {session, persisted, notice, accept, signOut};
}
