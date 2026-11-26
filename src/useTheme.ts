import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';

const themeKey = 'agentik:theme';

function readTheme() {
  try {
    const theme = localStorage.getItem(themeKey);
    if (theme === 'light' || theme === 'dark') return theme === 'dark';
  } catch { /* System preference is available without storage. */ }
}

function applyDocumentTheme(dark: boolean) {
  const theme = dark ? 'dark' : 'light';
  if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
}

export function useTheme(initial: boolean | (() => boolean)) {
  const [dark, setDark] = useState(() => readTheme() ?? (typeof initial === 'function' ? initial() : initial));
  const desired = useRef(dark);
  const manual = useRef(false);
  const running = useRef<ViewTransition | null>(null);
  const request = useRef(0);

  useLayoutEffect(() => {applyDocumentTheme(dark);}, [dark]);
  useEffect(() => {
    if (typeof initial !== 'function') return;
    const system = window.matchMedia?.('(prefers-color-scheme: dark)');
    const synchronize = () => {
      if (manual.current || readTheme() !== undefined) return;
      const next = initial();
      desired.current = next;
      setDark(next);
    };
    system?.addEventListener?.('change', synchronize);
    return () => system?.removeEventListener?.('change', synchronize);
  }, [initial]);
  useEffect(() => () => {
    request.current++;
    running.current?.skipTransition();
    running.current = null;
  }, []);

  function toggleTheme() {
    const next = !desired.current;
    desired.current = next;
    manual.current = true;
    const id = ++request.current;
    const apply = () => {
      applyDocumentTheme(next);
      setDark(next);
      try { localStorage.setItem(themeKey, next ? 'dark' : 'light'); } catch { /* In-memory choice stays active. */ }
    };

    if (running.current || document.hidden || typeof document.startViewTransition !== 'function'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      running.current?.skipTransition();
      running.current = null;
      apply();
      return;
    }

    let transition: ViewTransition;
    try {
      transition = document.startViewTransition(() => {
        if (request.current === id) flushSync(apply);
      });
    } catch {
      apply();
      return;
    }
    running.current = transition;
    const finish = () => {if (running.current === transition) running.current = null;};
    void transition.ready.catch(() => {});
    void transition.finished.then(finish, finish);
  }

  return {dark, toggleTheme};
}
