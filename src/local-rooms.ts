import {isChatImage, type ChatImage} from './chat-media';
import {MAX_CHAT_MESSAGE_LENGTH} from './chat-contract';
import {SESSION_MS} from './session';
import type {Conversation, Message} from './state';

export type Player = {id: string; name: string};
export type LocalRoomMessage = {
  id: string;
  userId: string;
  name: string;
  body: string;
  createdAt: number;
  images?: ChatImage[];
};
export type LocalRoom = {
  id: string;
  title: string;
  ownerId: string;
  invite: string;
  inviteExpiresAt: number;
  expiresAt: number;
  members: Player[];
  messages: LocalRoomMessage[];
  private?: boolean;
  sourceChatId?: string;
  sourceTurnIds?: string[];
};

type Store = Pick<Storage, 'getItem' | 'setItem'>;
export const LOCAL_ROOMS_KEY = 'agentik:rooms:v1';
const DAY_MS = 86_400_000;
const MAX_ROOM_MESSAGES = 500;

function read(storage: Store, now: number): LocalRoom[] {
  const raw = storage.getItem(LOCAL_ROOMS_KEY);
  try {
    const rooms = JSON.parse(raw ?? '[]');
    if (!Array.isArray(rooms)) return [];
    const current: LocalRoom[] = rooms.filter(room => room && typeof room.id === 'string'
      && typeof room.title === 'string' && typeof room.ownerId === 'string'
      && typeof room.invite === 'string' && room.expiresAt > now
      && Array.isArray(room.members) && room.members.every((member: Player) => member
        && typeof member.id === 'string' && typeof member.name === 'string')
      && Array.isArray(room.messages) && room.messages.every((message: LocalRoomMessage) => message
        && typeof message.id === 'string' && typeof message.body === 'string'
        && typeof message.name === 'string' && Number.isFinite(message.createdAt)));
    for (const room of current) {
      for (const message of room.messages) {
        if (message.images !== undefined) {
          message.images = Array.isArray(message.images) ? message.images.filter(isChatImage).slice(0, 1) : undefined;
        }
      }
    }
    return current;
  } catch {
    return [];
  }
}

function write(storage: Store, rooms: LocalRoom[]) {
  try {
    storage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(rooms));
  } catch {
    throw new Error('Браузер не смог сохранить комнату. Освободите место и повторите.');
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('agentik:rooms'));
}

function issueInvitation(room: LocalRoom, now: number) {
  room.invite = crypto.randomUUID();
  room.inviteExpiresAt = now + DAY_MS;
  room.expiresAt = now + SESSION_MS;
}

function newRoom(user: Player, title: string, now: number): LocalRoom {
  const room: LocalRoom = {
    id: crypto.randomUUID(), title, ownerId: user.id, invite: '', inviteExpiresAt: 0,
    expiresAt: now + SESSION_MS, members: [user], messages: [],
  };
  issueInvitation(room, now);
  return room;
}

function isRoomMember(room: LocalRoom, userId: string) {
  return room.private ? room.ownerId === userId : room.members.some(member => member.id === userId);
}

export function readLocalRooms(storage: Store, userId: string, now = Date.now()): LocalRoom[] {
  return read(storage, now).filter(room => isRoomMember(room, userId));
}

export function makeRoom(storage: Store, user: Player, title: string, now = Date.now()): LocalRoom {
  const name = title.trim();
  if (!name || name.length > 100) throw new Error('Укажите название до 100 символов.');
  const room = newRoom(user, name, now);
  write(storage, [room, ...read(storage, now)]);
  return room;
}

function importConversationMessages(room: LocalRoom, user: Player, conversation: Conversation, assistantName: string) {
  const turns = new Set(Array.isArray(room.sourceTurnIds) ? room.sourceTurnIds : []);
  const imported = conversation.messages.flatMap((message: Message & {images?: ChatImage[]}, index): LocalRoomMessage[] => {
    const id = 'source:' + (message.turnId ?? index) + ':' + message.role;
    if (turns.has(id)) return [];
    turns.add(id);
    return [{
      id,
      userId: message.role === 'user' ? user.id : 'assistant:' + conversation.assistantId,
      name: message.role === 'user' ? user.name : assistantName,
      body: message.content,
      createdAt: conversation.updatedAt,
      images: message.images?.filter(isChatImage).slice(0, 1),
    }];
  });
  room.sourceChatId = conversation.id;
  room.sourceTurnIds = [...turns];
  room.messages = [...room.messages, ...imported].slice(-MAX_ROOM_MESSAGES);
  return imported.length > 0;
}

export function shareLocalConversation(storage: Store, user: Player, conversation: Conversation, assistantName: string, now = Date.now()) {
  const rooms = read(storage, now);
  const existing = rooms.find(room => room.ownerId === user.id && room.sourceChatId === conversation.id);
  const room = existing ?? newRoom(user, (conversation.title.trim() || assistantName).slice(0, 100), now);
  importConversationMessages(room, user, conversation, assistantName);
  if (room.private || room.inviteExpiresAt <= now) issueInvitation(room, now);
  room.private = false;
  room.expiresAt = now + SESSION_MS;
  write(storage, existing ? rooms : [room, ...rooms]);
  return room;
}

export function syncSharedConversation(storage: Store, user: Player, conversation: Conversation, assistantName: string, now = Date.now()) {
  const rooms = read(storage, now);
  const room = rooms.find(item => !item.private && item.ownerId === user.id && item.sourceChatId === conversation.id);
  if (!room || !importConversationMessages(room, user, conversation, assistantName)) return;
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
}

export function joinLocalRoom(storage: Store, user: Player, invite: string, now = Date.now()): LocalRoom {
  const rooms = read(storage, now);
  const room = rooms.find(item => !item.private && item.invite === invite && item.inviteExpiresAt > now);
  if (!room) throw new Error('Комната не найдена или приглашение истекло. Локальные ссылки работают только в этом браузере.');
  if (!room.members.some(member => member.id === user.id)) room.members.push(user);
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
  return room;
}

export function postLocalMessage(storage: Store, user: Player, id: string, body: string, now = Date.now(), images: ChatImage[] = []): void {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && isRoomMember(item, user.id));
  if (!room) throw new Error('У профиля нет доступа к этой комнате.');
  const text = body.trim();
  if ((!text && !images.length) || text.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error('Напишите сообщение до 6000 символов или прикрепите изображение.');
  }
  if (images.length > 1 || !images.every(isChatImage)) throw new Error('Выберите одно поддерживаемое изображение.');
  room.messages = [...room.messages, {
    id: crypto.randomUUID(), userId: user.id, name: user.name, body: text, createdAt: now,
    images: images.length ? images : undefined,
  }].slice(-MAX_ROOM_MESSAGES);
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
}

export function renewLocalInvite(storage: Store, user: Player, id: string, now = Date.now()): string {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && isRoomMember(item, user.id));
  if (!room || room.private) throw new Error('Для этого чата приглашения закрыты.');
  if (room.inviteExpiresAt <= now) {
    issueInvitation(room, now);
    write(storage, rooms);
  }
  return room.invite;
}

export function setLocalRoomPrivacy(storage: Store, user: Player, id: string, isPrivate: boolean, now = Date.now()): LocalRoom {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && item.ownerId === user.id);
  if (!room) throw new Error('Настройки доступа может менять только владелец.');
  if (isPrivate) {
    room.members = [user];
    room.invite = '';
    room.inviteExpiresAt = 0;
    room.private = true;
  } else if (room.private) {
    issueInvitation(room, now);
    room.private = false;
  }
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
  return room;
}
