import {useRef} from 'react';
import {ChevronLeft, Plus, WifiOff} from 'lucide-react';
import type {Assistant} from '../catalog';
import type {Conversation} from '../state';
import {AgentIcon} from './Brand';
import {WelcomeTitle} from './ShaderEffects';
import {ChatComposer, MessageImages} from './ChatComposer';
import {ChatSharing} from './ChatSharing';
import type {ChatImage, ChatModel} from '../chat-media';
import type {LocalProfile} from '../session';
import {useUi} from '../language';

export function PrivateChat({assistant, conversation, profile, messagePrice, mode, online, busy, draft, error, onDraft, onSend, model, onModel}: {
  assistant: Assistant;
  conversation?: Conversation;
  profile: LocalProfile;
  messagePrice: number;
  mode: 'demo' | 'live';
  online: boolean;
  busy: boolean;
  draft: string;
  error?: string;
  onDraft: (text: string) => void;
  onSend: (retry: boolean, anchor: HTMLElement | null, images?:ChatImage[]) => boolean | Promise<boolean>;
  model: ChatModel;
  onModel: (model: ChatModel) => void;
}) {
  const {t,language}=useUi();
  const draftField = useRef<HTMLTextAreaElement>(null);
  const routeKey = conversation?.id ?? 'new:' + assistant.id;
  const composer = useRef({route:routeKey, epoch:0, createdId:''});
  if (composer.current.route !== routeKey) {
    if (composer.current.createdId !== routeKey) composer.current.epoch++;
    composer.current.route = routeKey;
    composer.current.createdId = '';
  }
  const offlineAi = mode === 'live' && !online;
  const lastMessage = conversation?.messages.at(-1);
  const canRetry = !busy && lastMessage?.role === 'user';


  return (
    <section className="chat">
      <div className="chat__header">
        <div className="chat__identity">
          <a className="icon-button chat__back" href="#/history" aria-label={t('Назад к чатам','Back to chats')}><ChevronLeft size={22}/></a>
          <span className={`avatar avatar--${assistant.color}`}><AgentIcon name={assistant.icon}/></span>
          <div className="chat__heading">
            <h1 className="chat__title">{assistant.name}</h1>
            <span className="chat__subtitle">{mode === 'demo' ? t('Деморежим · ответы по шаблону','Demo · template replies') : t('Режим AI','AI mode')}</span>
          </div>
        </div>
        {conversation && <div className="chat__header-actions">
          <ChatSharing conversation={conversation} profile={profile} assistantName={assistant.name} language={language}/>
          <a className="button button--secondary" href={`#/assistant/${assistant.id}`}>{t('Новый разговор','New chat')}</a>
        </div>}
      </div>
      <div className="chat__messages" aria-live="polite" aria-busy={busy}>
        {conversation?.messages.length ? conversation.messages.map((message, index) => (
          <article className={`message message--${message.role}`} key={index}>
            <span className="message__author">{message.role === 'user' ? t('Вы','You') : assistant.name}</span>
            {message.content && <p className="message__body">{message.content}</p>}
            <MessageImages images={message.images}/>
          </article>
        )) : (
          <div className="chat-welcome">
            <span className={`avatar avatar--large avatar--${assistant.color}`}><AgentIcon name={assistant.icon} size={32}/></span>
            <WelcomeTitle key={routeKey}/>
            <p className="chat-welcome__text">{assistant.description}</p>
            <div className="prompt-list">
              {assistant.prompts.map(prompt => (
                <button className="prompt-list__item" key={prompt} onClick={() => {onDraft(prompt); draftField.current?.focus();}}>
                  <span>{prompt}</span><Plus size={17}/>
                </button>
              ))}
            </div>
          </div>
        )}
        {busy && <p role="status" className="chat__loading chat__loading--skeleton" data-skeleton-level="surface"><span/>{t('Готовим ответ…','Preparing a reply…')}</p>}
      </div>
      {offlineAi && <p role="status" className="offline-note"><WifiOff size={16}/> {t('Подключитесь к интернету, чтобы отправить запрос AI.','Connect to the internet to send an AI request.')}</p>}
      {canRetry && (
        <div className={`notice chat__error${error ? ' notice--error' : ''}`} role={error ? 'alert' : 'status'}>
          <span>{error || t('Ответ ещё не получен.','No reply yet.')}</span>
          <button className="button button--text" disabled={offlineAi} onClick={() => onSend(true, null)}>{t('Повторить запрос','Try again')}</button>
        </div>
      )}
      <ChatComposer key={composer.current.epoch} fieldRef={draftField} draft={draft} onDraft={onDraft}
        busy={busy} disabled={offlineAi} model={model} onModel={onModel}
        price={messagePrice} retryDraft={!!(canRetry && draft.trim() && lastMessage.content === draft.trim())}
        onSubmit={async (images, anchor) => {
          const accepted = await onSend(canRetry && !images.length && lastMessage.content === draft.trim(), anchor, images);
          if (accepted && !conversation) composer.current.createdId = location.hash.match(/^#\/chat\/([^/]+)$/)?.[1] ?? '';
          return accepted;
        }}/>
      <p className="chat__disclaimer">{mode === 'demo' ? t('Демочат работает офлайн.','Demo chat works offline.') : t('AI может ошибаться. Проверяйте важные факты.','AI can make mistakes. Verify important facts.')}</p>
    </section>
  );
}
