import {isChatImage, prepareChatImage, type ChatImage} from '../../src/chat-media';
import {isChatDocument, MAX_CHAT_DOCUMENT_LENGTH, type ChatDocument} from '../../src/chat-contract';

export type Locale = 'ru' | 'en';
export type Theme = 'light' | 'dark' | 'system';
export type Attachment = {kind: 'image'; value: ChatImage} | {kind: 'text'; value: ChatDocument};
export type Message = {id: string; role: 'user' | 'assistant'; text: string; at: number; attachment?: Attachment};
export type Chat = {id: string; assistantId: string; title: string; messages: Message[]; updatedAt: number};
export type Note = {id: string; chatId: string; title: string; text: string};
export type State = {chats: Chat[]; favorites: string[]; notes: Note[]; locale: Locale; theme: Theme};
export type Route =
  | {kind: 'home' | 'agents' | 'history' | 'saved' | 'new' | 'missing'}
  | {kind: 'assistant' | 'chat'; id: string};

const storageKey = 'agentik:b-demo:v1';
const retention = 90 * 24 * 60 * 60 * 1000;
export const guestRetention = 3 * 24 * 60 * 60 * 1000;
const fresh = (): State => ({chats: [], favorites: [], notes: [], locale: 'ru', theme: 'system'});
const words = (value: string) => value.trim().split(/\s+/u).filter(Boolean);
export const attachmentAccept = 'image/png,image/jpeg,image/webp,image/avif,image/gif,.txt,.md,.csv,.json,.log,.js,.ts,.tsx,.html,.css,.xml,.py,.yaml,.yml';

function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false;
  const file = value as Attachment;
  return file.kind === 'image' ? isChatImage(file.value) : file.kind === 'text' && isChatDocument(file.value);
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const item = value as Message;
  return typeof item.id === 'string' && (item.role === 'assistant' || item.role === 'user')
    && typeof item.text === 'string' && Number.isFinite(item.at)
    && (item.attachment === undefined || isAttachment(item.attachment));
}

function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== 'object') return false;
  const chat = value as Chat;
  return typeof chat.id === 'string' && typeof chat.assistantId === 'string' && typeof chat.title === 'string'
    && Number.isFinite(chat.updatedAt) && Array.isArray(chat.messages) && chat.messages.every(isMessage);
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false;
  const note = value as Note;
  return typeof note.id === 'string' && typeof note.chatId === 'string' && typeof note.title === 'string' && typeof note.text === 'string';
}

export function pruneGuest(state: State, now = Date.now()): State {
  const chats = state.chats.filter(chat => now - chat.updatedAt < guestRetention);
  if (chats.length === state.chats.length) return state;
  const ids = new Set(chats.map(chat => chat.id));
  return {...state, chats, notes: state.notes.filter(note => ids.has(note.chatId))};
}

function accountKey(accountId?: string) {
  return accountId ? `${storageKey}:account:${accountId}` : storageKey;
}

export function loadState(accountId?: string): State {
  const state = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(accountKey(accountId)) ?? 'null') as (State & {expiresAt: number}) | null;
    if (!saved || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) return state;
    const restored: State = {
      chats: Array.isArray(saved.chats) ? saved.chats.filter(isChat) : [],
      favorites: Array.isArray(saved.favorites) ? saved.favorites.filter(id => typeof id === 'string') : [],
      notes: Array.isArray(saved.notes) ? saved.notes.filter(isNote) : [],
      locale: saved.locale === 'en' ? 'en' : 'ru',
      theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : 'system',
    };
    return accountId ? restored : pruneGuest(restored);
  } catch { return state; }
}

export function persistState(state: State, accountId?: string) {
  try {
    localStorage.setItem(accountKey(accountId), JSON.stringify({...state, expiresAt: Date.now() + retention}));
    return true;
  } catch { return false; }
}

export function mergeGuest(account: State, guest: State): State {
  const chats = new Map([...guest.chats, ...account.chats].map(chat => [chat.id, chat]));
  const notes = new Map([...guest.notes, ...account.notes].map(note => [note.id, note]));
  return {...guest, chats: [...chats.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    notes: [...notes.values()], favorites: Array.from(new Set([...account.favorites, ...guest.favorites]))};
}

export function readRoute(hash = location.hash): Route {
  const path = hash.replace(/^#\/?/u, '').replace(/\/$/u, '');
  if (!path) return {kind: 'home'};
  if (path === 'agents' || path === 'history' || path === 'saved' || path === 'new') return {kind: path};
  const match = /^(chat|assistant)\/([\w-]+)$/u.exec(path);
  if (match) return {kind: match[1] === 'chat' ? 'chat' : 'assistant', id: match[2]};
  return {kind: 'missing'};
}

export async function readAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith('image/')) return {kind: 'image', value: await prepareChatImage(file)};
  if (!/\.(txt|md|csv|json|log|js|ts|tsx|html|css|xml|py|ya?ml)$/iu.test(file.name) || file.size > 1024 * 1024) {
    throw new Error('format');
  }
  const text = await file.slice(0, MAX_CHAT_DOCUMENT_LENGTH * 4).text();
  if (!text.trim() || text.includes('\0')) throw new Error('empty');
  return {kind: 'text', value: {
    id: crypto.randomUUID(), name: file.name.slice(0, 160),
    text: text.slice(0, MAX_CHAT_DOCUMENT_LENGTH),
    ...(text.length > MAX_CHAT_DOCUMENT_LENGTH ? {truncated: true as const} : {}),
  }};
}

export function titleFor(text: string, attachment?: Attachment) {
  const label = text.trim().replace(/\s+/gu, ' ') || attachment?.value.name || '';
  return label.length > 62 ? label.slice(0, 61) + '…' : label;
}

export function demoReply(assistant: string, text: string, language: Locale, attachment?: Attachment) {
  const t = (ru: string, en: string) => language === 'ru' ? ru : en;
  if (attachment?.kind === 'text') {
    const file = attachment.value;
    const excerpt = file.text.split(/\r?\n/u).find(line => line.trim())?.trim().slice(0, 260) ?? '';
    return t(
      `Открыл «${file.name}»\n\nВ доступном фрагменте ${words(file.text).length} слов${file.truncated ? '. Остальной текст сохранён в исходном файле' : ''}.\n\n${excerpt}\n\nОтметь абзац, который стоит сократить или переформулировать.`,
      `Opened “${file.name}”\n\nThe available excerpt has ${words(file.text).length} words.\n\n${excerpt}\n\nPick the paragraph you want to shorten or rewrite.`,
    );
  }
  if (attachment?.kind === 'image') return t(
    'Изображение в чате\n\nОпиши, что на нём нужно изменить или обсудить. В демо картинка сохраняется как вложение, а её содержимое автоматически не анализируется.',
    'Image attached\n\nDescribe what you want to change or discuss. The demo saves your image as an attachment and leaves analysis to a connected model.',
  );
  const value = text.trim();
  if (assistant === 'ideas' || assistant === 'naming') return t(
    'Три направления для идеи\n\n1. Начни с конкретной проблемы. Покажи один случай, когда она возникает, и предложи простой способ её решить.\n2. Сделай из идеи маленький эксперимент. Выбери один вариант, набросай прототип за вечер и покажи его знакомому.\n3. Поменяй ракурс. Представь, что это формат для пятиминутного видео, подарка или игры. Что сохранится?\n\nКакой вариант хочется развить?',
    'Three directions to try\n\n1. Start with a specific problem. Describe one time it happens and suggest a small fix.\n2. Turn it into a quick experiment. Make a rough prototype tonight and show it to someone.\n3. Change the format. What would the idea look like as a five-minute video, a gift or a game?\n\nWhich direction would you explore?',
  );
  if (assistant === 'writer' || assistant === 'social' || assistant === 'story') {
    const body = value.split(/\r?\n/u).slice(1).join(' ').trim();
    if (body) return t(
      `Черновик для правки\n\n${body.replace(/\s+/gu, ' ').slice(0, 1200)}\n\nПроверь первое предложение. Оно должно сразу объяснять, зачем читателю этот текст.`,
      `Draft to edit\n\n${body.replace(/\s+/gu, ' ').slice(0, 1200)}\n\nCheck the first sentence. It should tell the reader why this matters.`,
    );
    return t(
      'Начнём с первой фразы\n\nОпиши ситуацию одним предложением. Следом добавь, что хочешь изменить и что человек может сделать прямо сейчас.\n\nВставь черновик следующим сообщением или прикрепи текстовый файл.',
      'Start with the first sentence\n\nDescribe the situation in one line, then say what you want to change and what the reader can do next.\n\nPaste a draft or attach a text file.',
    );
  }
  if (assistant === 'planner' || assistant === 'product-manager' || assistant === 'study') return t(
    'План на первый заход\n\n1. Запиши результат, который нужен к концу дня.\n2. Выдели один шаг на 25 минут. Остальные задачи пока оставь в списке.\n3. Поставь время для проверки. Если первый шаг займёт дольше, сократи объём следующего.\n\nПришли свой список дел, чтобы было от чего оттолкнуться.',
    'A first plan\n\n1. Write down one outcome you want by the end of the day.\n2. Pick a step that fits into 25 minutes. Keep the rest in a list.\n3. Pick a check-in time. If you run long, reduce the scope of the next step.\n\nShare your list to put the plan in context.',
  );
  if (assistant === 'code') return t(
    'Разберём по шагам\n\nЗапусти самый маленький пример, в котором повторяется проблема. Сравни фактическое значение с ожидаемым и проверь, где оно меняется впервые.\n\nПрикрепи фрагмент кода и текст ошибки. Для примера хватит функции или компонента, где это видно.',
    'Let’s narrow it down\n\nRun the smallest example that reproduces the problem. Compare the actual and expected values, then check where they first diverge.\n\nAttach the relevant code and the error. One function or component is enough to start.',
  );
  if (assistant === 'english') return t(
    'Короткая практика\n\nLet’s start with a simple question. What’s something you enjoyed this week?\n\nОтветь в двух предложениях. В первом расскажи, что случилось, во втором — почему тебе понравилось.',
    'A short practice\n\nWhat’s something you enjoyed this week?\n\nAnswer in two sentences. Say what happened first, then explain why you liked it.',
  );
  if (assistant === 'leo') return t(
    'Какой момент обсуждаем?\n\nПришли ссылку на YouTube или VK Видео и таймкод. Добавь реплику или пару слов о сцене, которую хочется разобрать.',
    'Which moment should we discuss?\n\nShare a YouTube or VK Video link and a timestamp. Include the line or briefly describe the scene you want to discuss.',
  );
  return t(
    'С чего можно начать\n\nОпиши одним предложением, какой результат хочешь получить. Добавь пример, данные или одно важное ограничение.\n\nСобери первый вариант, которым уже можно воспользоваться, и дополни его после проверки.',
    'A place to start\n\nDescribe your desired outcome in one sentence. Add an example, some data or one important constraint.\n\nMake a first version you can use, then improve it after a check.',
  );
}
