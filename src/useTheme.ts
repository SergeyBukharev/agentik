import {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';

function applyDocumentTheme(dark: boolean) {
  const theme = dark ? 'dark' : 'light';
  if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
}

export function useTheme(initial: boolean | (() => boolean)) {
  const [dark, setDark] = useState(initial);
  const desired = useRef(dark);
  const running = useRef<ViewTransition | null>(null);
  const request = useRef(0);

  useEffect(() => {applyDocumentTheme(dark);}, [dark]);
  useEffect(() => () => {
    request.current++;
    running.current?.skipTransition();
    running.current = null;
  }, []);

  function toggleTheme() {
    const next = !desired.current;
    desired.current = next;
    const id = ++request.current;
    const apply = () => {applyDocumentTheme(next); setDark(next);};

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
