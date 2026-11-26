import {expect, test} from 'vitest';
import {readTelegramShareTarget, telegramBackRoute, telegramWidgetUrl} from './telegram-shell';

const share = `s_${'a'.repeat(32)}_${'B'.repeat(24)}`;

test('routes a compact direct link to the separate widget and keeps launch data in the fragment', () => {
  expect(readTelegramShareTarget('?tgWebAppStartParam='+share, '#tgWebAppData=signed')).toBe(share);
  const widget = new URL(telegramWidgetUrl('https://agentik.example/agentik/?tgWebAppStartParam='+share+'#tgWebAppData=signed', share));
  expect(widget.pathname).toBe('/agentik/widget.html');
  expect(widget.search).toBe('');
  expect(readTelegramShareTarget(widget.search, widget.hash)).toBe(share);
  expect(new URLSearchParams(widget.hash.slice(1)).get('tgWebAppData')).toBe('signed');
  expect(readTelegramShareTarget('?tgWebAppStartParam=../../private', '')).toBeNull();
});

test('uses internal back routes for direct chat and board launches', () => {
  expect(telegramBackRoute('#/chat/abc')).toBe('#/history');
  expect(telegramBackRoute('#/board/assistant/chat')).toBe('#/chat/chat');
  expect(telegramBackRoute('#/rooms/abc')).toBe('#/rooms');
  expect(telegramBackRoute('#/')).toBeNull();
});
