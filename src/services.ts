import type {Assistant} from './catalog';
import type {Message} from './state';
import type {Language} from './language';
import type {ChatModel} from './chat-media';
import {MAX_MEDIA_CHAT_BODY_BYTES, MAX_CHAT_BODY_BYTES, MAX_CHAT_MESSAGES, MAX_CHAT_MESSAGE_LENGTH} from './chat-contract';

export type ReplyOptions = {mode: 'demo' | 'live'; token: string; signal?: AbortSignal; model?:ChatModel; language?:Language};
const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function buildChatBody(assistant: Assistant, history: Message[], options: ReplyOptions) {
  const identity = {name: assistant.name, instruction: assistant.instruction};
  const encoder = new TextEncoder();
  const meta = {assistant:identity, ...(options.model ? {model:options.model} : {}), ...(options.language ? {language:options.language}: {})};
  const latest = history.at(-1);
  const limit = latest?.images?.length ? MAX_MEDIA_CHAT_BODY_BYTES : MAX_CHAT_BODY_BYTES;
  let available = limit - encoder.encode(JSON.stringify({...meta,messages:[]})).length;
  const messages: Message[] = [];
  for (const item of history.slice(-MAX_CHAT_MESSAGES).reverse()) {
    const message = {role:item.role, content:item.content.slice(0, MAX_CHAT_MESSAGE_LENGTH),
      ...(item === latest && item.images?.length ? {images:item.images} : {}),
      ...(item.document ? {document:item.document} : {})};
    if (!message.content.trim() && !message.images?.length) continue;
    const bytes = encoder.encode(JSON.stringify(message)).length + (messages.length ? 1 : 0);
    if (bytes > available) {
      if (item === latest && item.document) throw new Error(options.language === 'en'
        ? 'Shorten the request to leave room for the attached text.' : 'Сократите запрос, чтобы в него поместился текст файла.');
      break;
    }
    available -= bytes;
    messages.push(message);
  }
  return JSON.stringify({...meta,messages:messages.reverse()});
}

export async function replyTo(assistant: Assistant, messages: Message[], options: ReplyOptions): Promise<string> {
  if (options.mode === 'demo') {
    await new Promise<void>((resolve, reject) => {
      if (options.signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        options.signal?.removeEventListener('abort', abort);
        resolve();
      }, 450);
      options.signal?.addEventListener('abort', abort, {once: true});
    });
    const file = messages.at(-1)?.document;
    if (file) return options.language === 'en'
      ? `The file “${file.name}” is ready for editing. Connect an AI provider to get a revised version.`
      : `Файл «${file.name}» готов к редактированию. Чтобы получить исправленный текст, подключите AI.`;
    if (options.language === 'en') return `Demo reply from ${assistant.name}.

Your message: ${messages.at(-1)?.content || 'Image'}

Define who the result is for and what it should achieve. Enable AI mode for a generated reply.`;
    if (!messages.at(-1)?.content && messages.at(-1)?.images?.length) return 'Это демонстрационный ответ. Изображение прикреплено к чату. Для анализа выберите модель с поддержкой изображений в режиме AI.';
    return `Это демонстрационный ответ «${assistant.name}».\n\nВаш запрос: «${messages.at(-1)?.content}»\n\nДля начала определите, кому нужен результат, какие есть ограничения и как выглядит хороший итог. Настоящие ответы AI доступны после подключения сервера.`;
  }
  if (!options.token) throw new Error('Войдите в Agentik по коду.');
  if (!navigator.onLine) throw new Error('Подключитесь к интернету, чтобы отправить запрос.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, {once: true});
  const timeout = setTimeout(abort, 35_000);
  try {
    let response: Response;
    try {
      response = await fetch(apiOrigin + '/api/chat' + (messages.at(-1)?.images?.length ? '?media=1' : ''), {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + options.token},
        body: buildChatBody(assistant, messages, options),
        signal: controller.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new Error(controller.signal.aborted ? 'Сервер не успел ответить. Попробуйте ещё раз.'
        : 'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Не удалось получить ответ. Попробуйте ещё раз.');
    if (typeof data?.reply !== 'string') throw new Error('Сервер вернул некорректный ответ.');
    return data.reply;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
