import {afterEach, expect, it, vi} from 'vitest';
import {catalog} from './catalog';
import {replyTo} from './services';
import type {Message} from './state';

afterEach(() => vi.unstubAllGlobals());

it('keeps the newest full turn and bounds previous live context by the API limits', async () => {
  const getBody = vi.fn(async (_url: string, init: RequestInit) => {
    const body = String(init.body);
    const payload = JSON.parse(body);
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(65_536);
    expect(payload.messages.length).toBeLessThanOrEqual(20);
    expect(payload.messages.every((message: Message) => message.content.length <= 6000)).toBe(true);
    expect(payload.messages.at(-1)).toEqual({role: 'user', content: 'Я'.repeat(6000)});
    return Response.json({reply: 'Готово'});
  });
  vi.stubGlobal('fetch', getBody);
  const history: Message[] = Array.from({length: 25}, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: 'Тест'.repeat(1600),
  }));
  await expect(replyTo(catalog[0], [...history, {role: 'user', content: 'Я'.repeat(6000)}], {mode: 'live', token: 'fixture'})).resolves.toBe('Готово');
  expect(getBody).toHaveBeenCalledOnce();
});
