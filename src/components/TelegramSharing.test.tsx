import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {catalog} from '../catalog';
import {createChatDrafts} from '../chat-drafts';
import {joinLocalRoom, makeRoom, postLocalMessage} from '../local-rooms';
import type {Conversation} from '../state';
import type {TelegramShareLink} from '../telegram-share-contract';
import {PrivateChat} from './PrivateChat';
import {Rooms} from './Rooms';

const owner = {id:'owner', name:'Анна', createdAt:0, expiresAt:Date.now()+100_000};
const guest = {...owner, id:'guest', name:'Борис'};
const assistant = catalog.find(item => item.id === 'writer')!;
const token = 'session-token';
const shareId = 's_' + 'a'.repeat(32) + '_' + 'b'.repeat(24);
const link = 'https://t.me/agentik_test_bot?startapp=' + shareId + '&mode=compact';
const image = {id:'image', name:'private-attachment.png', url:'data:image/png;base64,AAAA'};
const chat: Conversation = {
  id:'chat-1', title:'Чат для отправки', assistantId:assistant.id, updatedAt:1,
  messages:Array.from({length:52}, (_, index) => ({
    role:index === 51 ? 'assistant' : 'user',
    content:'Сообщение ' + index,
    ...(index === 51 ? {images:[image]} : {}),
  })),
};
const shareLabel = 'Поделиться в Telegram';

function privateChat(conversation?: Conversation) {
  return <PrivateChat assistant={assistant} conversation={conversation} profile={owner} online
    messagePrice={1} mode="demo" busy={false} drafts={createChatDrafts()} onSend={() => true}
    model="auto" onModel={() => {}} telegramShareToken={token}/>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_TELEGRAM_MINI_APP', 'true');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('creates a Telegram link only after consent and supports sharing, copying and revoking it', async () => {
  let activeShare: TelegramShareLink | null = null;
  const fetchShare = vi.fn(async (_url: string, request: RequestInit) => {
    if (request.method === 'PUT') activeShare = {id:shareId, url:link, expiresAt:Date.now()+86_400_000};
    if (request.method === 'DELETE') {
      activeShare = null;
      return new Response(null, {status:204});
    }
    return Response.json({share:activeShare});
  });
  const openTelegramLink = vi.fn();
  vi.stubGlobal('fetch', fetchShare);
  vi.stubGlobal('Telegram', {WebApp:{platform:'android', openTelegramLink}});
  const user = userEvent.setup();
  render(privateChat(chat));
  expect(fetchShare).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', {name:shareLabel}));
  const dialog = within(await screen.findByRole('dialog'));
  const create = await dialog.findByRole('button', {name:'Создать ссылку'});
  expect(dialog.getByText(/любой человек с этой ссылкой/i)).toBeVisible();
  expect(dialog.getByText(/24 часа/)).toBeVisible();
  expect(fetchShare).toHaveBeenCalledTimes(1);
  const [getUrl, get] = fetchShare.mock.calls[0];
  expect(getUrl).toContain('/api/telegram/shares?source=chat%3Achat-1');
  expect(get.method).toBe('GET');
  expect(new Headers(get.headers).get('Authorization')).toBe('Bearer ' + token);
  expect(get.body).toBeUndefined();

  await user.click(create);
  const send = await dialog.findByRole('link', {name:'Отправить в Telegram'});
  const [putUrl, put] = fetchShare.mock.calls[1];
  const body = JSON.parse(put.body as string);
  expect(putUrl).toBe(getUrl);
  expect(put.method).toBe('PUT');
  expect(body.title).toBe(chat.title);
  expect(body.messages).toHaveLength(50);
  expect(body.messages[0]).toEqual({author:owner.name, role:'user', text:'Сообщение 2'});
  expect(body.messages.at(-1)).toEqual({author:assistant.name, role:'assistant', text:'Сообщение 51', hasImage:true});
  const shareUrl = new URL((send as HTMLAnchorElement).href);
  expect(shareUrl.origin + shareUrl.pathname).toBe('https://t.me/share/url');
  expect(shareUrl.searchParams.get('url')).toBe(link);
  await user.click(send);
  expect(openTelegramLink).toHaveBeenCalledWith(shareUrl.href);

  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', {name:shareLabel}));
  const reopened = within(await screen.findByRole('dialog'));
  await reopened.findByRole('link', {name:'Отправить в Telegram'});
  expect(fetchShare.mock.calls[2][1].method).toBe('GET');

  const copy = reopened.getByRole('button', {name:'Скопировать ссылку'});
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  await user.click(copy);
  await reopened.findByText('Скопируйте выделенную ссылку.');
  const field = reopened.getByRole<HTMLInputElement>('textbox', {name:'Ссылка на чат'});
  expect(field).toHaveFocus();
  expect(field.selectionEnd).toBe(link.length);
  await user.click(copy);
  expect(await navigator.clipboard.readText()).toBe(link);
  await user.click(reopened.getByRole('button', {name:'Отозвать ссылку'}));
  await reopened.findByText('Ссылка отозвана.');
  expect(fetchShare.mock.calls[3][1].method).toBe('DELETE');
  expect(reopened.queryByRole('link', {name:'Отправить в Telegram'})).toBeNull();
});

it('shows Telegram sharing only for saved chats and room owners in the Telegram build', async () => {
  const {rerender, unmount} = render(privateChat());
  expect(screen.queryByRole('button', {name:shareLabel})).toBeNull();
  vi.stubEnv('VITE_TELEGRAM_MINI_APP', 'false');
  rerender(privateChat(chat));
  expect(screen.queryByRole('button', {name:shareLabel})).toBeNull();
  unmount();

  vi.stubEnv('VITE_TELEGRAM_MINI_APP', 'true');
  const room = makeRoom(localStorage, owner, 'План поездки');
  joinLocalRoom(localStorage, guest, room.invite);
  postLocalMessage(localStorage, guest, room.id, 'Сообщение в комнате');
  const asGuest = render(<Rooms profile={guest} roomId={room.id} telegramShareToken={token}/>);
  expect(screen.queryByRole('button', {name:shareLabel})).toBeNull();
  asGuest.unmount();
  render(<Rooms profile={owner} roomId={room.id} telegramShareToken={token}/>);
  const fetchShare = vi.fn(async (_url: string, request: RequestInit) => Response.json({share:request.method === 'PUT'
    ? {id:shareId, url:link, expiresAt:Date.now()+86_400_000} : null}));
  vi.stubGlobal('fetch', fetchShare);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name:shareLabel}));
  await user.click(await screen.findByRole('button', {name:'Создать ссылку'}));
  await screen.findByRole('link', {name:'Отправить в Telegram'});
  const [url, request] = fetchShare.mock.calls[1];
  expect(url).toContain('/api/telegram/shares?source=room%3A' + room.id);
  expect(JSON.parse(request.body as string)).toEqual({
    title:'План поездки', messages:[{author:'Борис', text:'Сообщение в комнате', role:'user'}],
  });
});
