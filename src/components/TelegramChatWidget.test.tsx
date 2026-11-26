import {afterEach, expect, it, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TelegramChatWidget} from './TelegramChatWidget';

const shareId = 's_' + 'a'.repeat(32) + '_' + 'b'.repeat(24);
const view = {title:'Совместный план', expiresAt:Date.now()+60_000, messages:[
  {author:'Анна', role:'user', text:'Привет'},
  {author:'Помощник', role:'assistant', text:'<b>Текст ответа</b>', hasImage:true},
]};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('shows the read-only copy and attachment indicators without needing an account', async () => {
  const fetchShare = vi.fn(async (_url: string, _request: RequestInit) => Response.json(view));
  vi.stubGlobal('fetch', fetchShare);
  render(<TelegramChatWidget id={shareId}/>);
  expect(await screen.findByRole('heading', {name:view.title})).toBeVisible();
  expect(screen.getByText('Только чтение')).toBeVisible();
  const messages = within(screen.getByRole('list', {name:'Сообщения'}));
  expect(messages.getByText('Анна')).toBeVisible();
  expect(messages.getByText('Привет')).toBeVisible();
  expect(messages.getByText('<b>Текст ответа</b>')).toBeVisible();
  expect(messages.getByText('Изображение')).toBeVisible();
  expect(screen.queryByRole('textbox')).toBeNull();
  const [url, request] = fetchShare.mock.calls[0];
  expect(url).toContain('/api/telegram/shares/' + shareId);
  expect(new Headers(request.headers).get('Authorization')).toBeNull();
  expect(request.credentials).toBe('omit');
  expect(request.cache).toBe('no-store');
});

it('offers a retry after a network error and explains a revoked or expired link', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockRejectedValueOnce(new TypeError('network'))
    .mockResolvedValueOnce(new Response(null, {status:404})));
  const user = userEvent.setup();
  render(<TelegramChatWidget id={shareId}/>);
  const retry = await screen.findByRole('button', {name:'Повторить'});
  await user.click(retry);
  expect(await screen.findByRole('heading', {name:'Ссылка недоступна'})).toBeVisible();
  expect(screen.getByText(/пришлёт новую ссылку|прислать новую ссылку/i)).toBeVisible();
});

it('explains why a shared chat needs an internet connection', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const fetchShare = vi.fn();
  vi.stubGlobal('fetch', fetchShare);
  render(<TelegramChatWidget id={shareId}/>);
  expect(await screen.findByRole('heading', {name:'Нет подключения к интернету'})).toBeVisible();
  expect(fetchShare).not.toHaveBeenCalled();
});
