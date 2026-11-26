import {useCallback, useLayoutEffect, useRef} from 'react';

export function usePinnedChatThread(
  threadKey: string | undefined,
  messages: readonly unknown[] | undefined,
  pending: number | boolean,
) {
  const thread = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const followLatest = useCallback(() => {
    const element = thread.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    const element = thread.current;
    if (!element) return;
    pinned.current = true;

    const trackScroll = () => {
      pinned.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 24;
    };
    element.addEventListener('scroll', trackScroll, {passive:true});
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(followLatest) : undefined;
    resize?.observe(element);
    for (const child of element.children) resize?.observe(child);
    return () => {
      element.removeEventListener('scroll', trackScroll);
      resize?.disconnect();
    };
  }, [threadKey, followLatest]);

  useLayoutEffect(followLatest, [threadKey, messages, pending, followLatest]);

  return thread;
}
