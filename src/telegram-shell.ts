import colors from '../design-system/colors.json';
import {isTelegramShareId} from './telegram-share-contract';

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {start_param?: string};
  platform?: string;
  colorScheme?: 'light' | 'dark';
  BackButton?: {show(): void; hide(): void; onClick(callback: () => void): void};
  ready?(): void;
  expand?(): void;
  close?(): void;
  isVersionAtLeast?(version: string): boolean;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: 'themeChanged', callback: () => void): void;
  openTelegramLink?(url: string): void;
};

export function getTelegramWebApp(): TelegramWebApp | undefined {
  const app = (window as Window & {Telegram?: {WebApp?: TelegramWebApp}}).Telegram?.WebApp;
  return app && (app.initData || (app.platform && app.platform !== 'unknown')) ? app : undefined;
}

export function readTelegramShareTarget(search: string, hash: string, start?: unknown) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.slice(1));
  return [fragment.get('agentikShare'), query.get('tgWebAppStartParam'), start].find(isTelegramShareId) ?? null;
}

export function telegramWidgetUrl(locationHref: string, id: string) {
  const current = new URL(locationHref);
  const widget = new URL('widget.html', current);
  const launch = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(current.hash.slice(1))) {
    if (key.startsWith('tgWebApp')) launch.set(key, value);
  }
  launch.set('agentikShare', id);
  widget.hash = launch.toString();
  return widget.href;
}

export function telegramBackRoute(hash: string) {
  if (!hash.startsWith('#/') || hash === '#/') return null;
  const [page, id, chat] = hash.slice(2).split('/');
  if (page === 'board' && id) return chat ? '#/chat/' + chat : '#/assistant/' + id;
  if (page === 'chat') return '#/history';
  if (page === 'assistant') return '#/assistants';
  if ((page === 'rooms' && id) || page === 'join') return '#/rooms';
  return '#/';
}

export function startTelegramShell(widget = false) {
  const app = getTelegramWebApp();
  if (!app) return;
  const root = document.documentElement;
  root.dataset.telegram = widget ? 'widget' : 'app';
  const updateChrome = () => {
    const color = (root.dataset.theme === 'dark' ? colors.dark : colors.light).canvas;
    app.setBackgroundColor?.(color);
    if (app.isVersionAtLeast?.('6.9')) app.setHeaderColor?.(color);
  };
  const syncPlatform = () => {
    if (widget || !document.querySelector('.app')) root.dataset.theme = app.colorScheme === 'dark' ? 'dark' : 'light';
    updateChrome();
  };
  syncPlatform();
  app.onEvent?.('themeChanged', syncPlatform);
  const theme = new MutationObserver(updateChrome);
  theme.observe(root, {attributes: true, attributeFilter: ['data-theme']});

  const back = app.BackButton;
  if (back && app.isVersionAtLeast?.('6.1') !== false) {
    const updateBack = () => { if (widget || telegramBackRoute(location.hash)) back.show(); else back.hide(); };
    back.onClick(() => {
      if (widget) return app.close?.();
      const target = telegramBackRoute(location.hash);
      if (target) location.hash = target;
    });
    updateBack();
    if (!widget) window.addEventListener('hashchange', updateBack);
  }
  if (!widget) app.expand?.();
  requestAnimationFrame(() => app.ready?.());
}
