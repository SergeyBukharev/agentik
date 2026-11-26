import type {Assistant} from './catalog';
import {isChatImage, type ChatImage} from './chat-media';
import {MAX_CHAT_MESSAGE_LENGTH} from './chat-contract';
import {SESSION_MS} from './session';
import type {Conversation, Message} from './state';

export type Player = {id: string; name: string};
export type RoomMention = {id: string; name: string; handle: string; kind: 'member' | 'bot'};
export type LocalRoomMessage = {
  id: string;
  userId: string;
  name: string;
  body: string;
  createdAt: number;
  images?: ChatImage[];
  mentions?: RoomMention[];
  replyToMessageId?: string;
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
  bots?: Assistant[];
  mentionHandles?: RoomMention[];
  private?: boolean;
  sourceChatId?: string;
  sourceTurnIds?: string[];
};

type Store = Pick<Storage, 'getItem' | 'setItem'>;
export const LOCAL_ROOMS_KEY = 'agentik:rooms:v1';
const DAY_MS = 86_400_000;
const MAX_ROOM_MESSAGES = 500;

function isRoomBot(value: unknown): value is Assistant {
  if (typeof value !== 'object' || value === null) return false;
  const bot = value as Assistant;
  return typeof bot.id === 'string' && !!bot.id && typeof bot.name === 'string' && !!bot.name.trim()
    && (bot.kind === 'assistant' || bot.kind === 'character') && typeof bot.instruction === 'string'
    && typeof bot.description === 'string' && typeof bot.category === 'string' && typeof bot.icon === 'string'
    && typeof bot.color === 'string' && Array.isArray(bot.prompts) && bot.prompts.every(prompt => typeof prompt === 'string');
}

export function normalizeRoomMentionHandle(value: string): string {
  return value.normalize('NFKC').toLowerCase().normalize('NFKC');
}

function isRoomMention(value: unknown): value is RoomMention {
  if (typeof value !== 'object' || value === null) return false;
  const mention = value as RoomMention;
  return typeof mention.id === 'string' && typeof mention.name === 'string'
    && (mention.kind === 'member' || mention.kind === 'bot') && typeof mention.handle === 'string'
    && /^[\p{L}\p{N}][\p{L}\p{M}\p{N}-]*$/u.test(mention.handle)
    && mention.handle === normalizeRoomMentionHandle(mention.handle);
}

function mentionKey(mention: Pick<RoomMention, 'id' | 'kind'>): string {
  return mention.kind + ':' + mention.id;
}

export function roomMentionTargets(room: LocalRoom): RoomMention[] {
  const roster = [
    ...room.members.map(({id, name}) => ({id, name, kind: 'member' as const})),
    ...(room.bots ?? []).map(({id, name}) => ({id, name, kind: 'bot' as const})),
  ];
  const assigned = new Map<string, string>();
  const used = new Set<string>();
  // Keep issued handles reserved even when the original member or bot is gone.
  for (const target of room.mentionHandles ?? []) {
    if (used.has(target.handle)) continue;
    used.add(target.handle);
    const key = mentionKey(target);
    if (!assigned.has(key)) assigned.set(key, target.handle);
  }
  return roster.map(target => {
    const assignedHandle = assigned.get(mentionKey(target));
    if (assignedHandle) return {...target, handle: assignedHandle};
    const base = normalizeRoomMentionHandle(target.name)
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
      .replace(/^[\p{M}-]+|-$/gu, '') || target.kind;
    let handle = base;
    for (let suffix = 2; used.has(handle); suffix++) handle = `${base}-${suffix}`;
    used.add(handle);
    return {...target, handle};
  });
}

function reserveRoomMentionHandles(room: LocalRoom) {
  const previous = room.mentionHandles ?? [];
  const used = new Set(previous.map(target => target.handle));
  room.mentionHandles = [...previous, ...roomMentionTargets(room).filter(target => !used.has(target.handle))];
}

function matchRoomMentions(body: string, targets: readonly RoomMention[]) {
  if (!targets.length) return [];
  const byHandle = new Map(targets.map(target => [target.handle, target]));
  // Match standalone handles and leave email addresses and dotted domains intact.
  const matches = body.matchAll(/(^|[^\p{L}\p{M}\p{N}_@.+%\/-])@([\p{L}\p{M}\p{N}_-]+)(?![\p{L}\p{M}\p{N}_@-]|\.[\p{L}\p{M}\p{N}])/gu);
  return Array.from(matches).flatMap(match => {
    const mention = byHandle.get(normalizeRoomMentionHandle(match[2]));
    return mention ? [{start: match.index + match[1].length, end: match.index + match[0].length, mention}] : [];
  });
}

export function splitRoomMentions(body: string, mentions: readonly RoomMention[] = []): {text: string; mention?: RoomMention}[] {
  const parts: {text: string; mention?: RoomMention}[] = [];
  let offset = 0;
  for (const {start, end, mention} of matchRoomMentions(body, mentions)) {
    if (start > offset) parts.push({text: body.slice(offset, start)});
    parts.push({text: body.slice(start, end), mention});
    offset = end;
  }
  if (offset < body.length) parts.push({text: body.slice(offset)});
  return parts;
}

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
      if (room.bots !== undefined) room.bots = Array.isArray(room.bots) ? room.bots.filter(isRoomBot) : undefined;
      if (room.mentionHandles !== undefined) {
        room.mentionHandles = Array.isArray(room.mentionHandles) ? room.mentionHandles.filter(isRoomMention) : undefined;
      }
      for (const message of room.messages) {
        if (message.images !== undefined) {
          message.images = Array.isArray(message.images) ? message.images.filter(isChatImage).slice(0, 1) : undefined;
        }
        if (message.mentions !== undefined) {
          message.mentions = Array.isArray(message.mentions) ? message.mentions.filter(isRoomMention) : undefined;
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
  if (!room.members.some(member => member.id === user.id)) {
    if (!room.mentionHandles) reserveRoomMentionHandles(room);
    room.members.push(user);
    reserveRoomMentionHandles(room);
  }
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
  return room;
}

export function addLocalRoomBot(storage: Store, user: Player, id: string, assistant: Assistant, now = Date.now()): LocalRoom {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && item.ownerId === user.id);
  if (!room) throw new Error('Ботов может добавлять только владелец комнаты.');
  if (!isRoomBot(assistant)) throw new Error('Выберите бота для комнаты.');
  if (room.bots?.some(bot => bot.id === assistant.id)) return room;
  room.bots = [...(room.bots ?? []), assistant];
  reserveRoomMentionHandles(room);
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
  return room;
}

export function removeLocalRoomBot(storage: Store, user: Player, id: string, botId: string, now = Date.now()): LocalRoom {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && item.ownerId === user.id);
  if (!room) throw new Error('Ботов может удалять только владелец комнаты.');
  if (!room.bots?.some(bot => bot.id === botId)) return room;
  reserveRoomMentionHandles(room);
  room.bots = room.bots.filter(bot => bot.id !== botId);
  room.expiresAt = now + SESSION_MS;
  write(storage, rooms);
  return room;
}

function appendRoomMessage(storage: Store, rooms: LocalRoom[], room: LocalRoom, message: LocalRoomMessage): LocalRoomMessage {
  room.messages = [...room.messages, message].slice(-MAX_ROOM_MESSAGES);
  room.expiresAt = message.createdAt + SESSION_MS;
  write(storage, rooms);
  return message;
}

export function postLocalMessage(storage: Store, user: Player, id: string, body: string, now = Date.now(), images: ChatImage[] = []): LocalRoomMessage {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && isRoomMember(item, user.id));
  if (!room) throw new Error('У профиля нет доступа к этой комнате.');
  const text = body.trim();
  if ((!text && !images.length) || text.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error('Напишите сообщение до 6000 символов или прикрепите изображение.');
  }
  if (images.length > 1 || !images.every(isChatImage)) throw new Error('Выберите одно поддерживаемое изображение.');
  const mentions = [...new Set(matchRoomMentions(text, roomMentionTargets(room)).map(match => match.mention))];
  return appendRoomMessage(storage, rooms, room, {
    id: crypto.randomUUID(), userId: user.id, name: user.name, body: text, createdAt: now,
    ...(images.length ? {images} : {}),
    ...(mentions.length ? {mentions} : {}),
  });
}

export function postLocalBotReply(storage: Store, user: Player, id: string, botId: string, sourceMessageId: string, body: string, now = Date.now()): LocalRoomMessage | undefined {
  const rooms = read(storage, now);
  const room = rooms.find(item => item.id === id && isRoomMember(item, user.id));
  const bot = room?.bots?.find(item => item.id === botId);
  if (!room || !bot) return;
  const source = room.messages.find(message => message.id === sourceMessageId && message.userId === user.id);
  if (!source?.mentions?.some(mention => mention.kind === 'bot' && mention.id === botId)) return;
  const botUserId = 'assistant:' + botId;
  if (room.messages.some(message => message.userId === botUserId && message.replyToMessageId === sourceMessageId)) return;
  const text = body.trim();
  if (!text) throw new Error('Бот вернул пустой ответ.');
  return appendRoomMessage(storage, rooms, room, {
    id: crypto.randomUUID(), userId: botUserId, name: bot.name, body: text, createdAt: now,
    replyToMessageId: sourceMessageId,
  });
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
    reserveRoomMentionHandles(room);
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
