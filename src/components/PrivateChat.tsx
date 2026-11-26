import {lazy, memo, Suspense, useRef, useSyncExternalStore} from 'react';
import {ChevronLeft, WifiOff} from 'lucide-react';
import type {Assistant} from '../catalog';
import type {Conversation} from '../state';
import {AgentIcon} from './Brand';
import {WelcomeTitle} from './ShaderEffects';
import {ChatComposer, MessageImages} from './ChatComposer';
import {ChatSharing} from './ChatSharing';
import {ChatSuggestions} from './ChatSuggestions';
import {ChatBoardTabs} from './ChatBoardTabs';
import type {ChatImage, ChatModel} from '../chat-media';
import type {ChatDrafts} from '../chat-drafts';
import type {LocalProfile} from '../session';
import {useUi} from '../language';
import {telegramShareSnapshot} from '../telegram-share-client';
import {TelegramShare} from './TelegramShare';

const FamilyBudget = lazy(() => import('./FamilyBudget').then(module => ({default:module.FamilyBudget})));

const PrivateMessages = memo(function PrivateMessages({messages, assistantName, userName}: {
  messages: Conversation['messages'];
  assistantName: string;
  userName: string;
}) {
  return messages.map((message, index) => (
    <article className={`message message--${message.role}`} key={index}>
      <span className="message__author">{message.role === 'user' ? userName : assistantName}</span>
      {message.content && <p className="message__body">{message.content}</p>}
      <MessageImages images={message.images}/>
    </article>
  ));
});

export function PrivateChat({assistant, conversation, profile, messagePrice, mode, online, busy, drafts, error, onSend, model, onModel, telegramShareToken}: {
  assistant: Assistant;
  conversation?: Conversation;
  profile: LocalProfile;
  messagePrice: number;
  mode: 'demo' | 'live';
  online: boolean;
  busy: boolean;
  drafts: ChatDrafts;
  error?: string;
  onSend: (retry: boolean, anchor: HTMLElement | null, images?:ChatImage[]) => boolean | Promise<boolean>;
  model: ChatModel;
  onModel: (model: ChatModel) => void;
  telegramShareToken?: string;
}) {
  const {t,language}=useUi();
  const draftField = useRef<HTMLTextAreaElement>(null);
  const routeKey = conversation?.id ?? 'new:' + assistant.id;
  const draft = useSyncExternalStore(drafts.subscribe, () => drafts.get(routeKey));
  const onDraft = (text: string) => drafts.set(routeKey, text);
  const composer = useRef({route:routeKey, epoch:0, createdId:''});
  if (composer.current.route !== routeKey) {
    if (composer.current.createdId !== routeKey) composer.current.epoch++;
    composer.current.route = routeKey;
    composer.current.createdId = '';
  }
  const offlineAi = mode === 'live' && !online;
  const lastMessage = conversation?.messages.at(-1);
  const canRetry = !busy && lastMessage?.role === 'user';
  const hasMessages = Boolean(conversation?.messages.length);
  const suggestions = <ChatSuggestions assistant={assistant} draft={draft} compact={hasMessages} busy={busy}
    onApply={next => {
      const field = draftField.current;
      if (!field || field.readOnly) return;
      onDraft(next);
      field.focus();
    }}/>;

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
          {import.meta.env.VITE_TELEGRAM_MINI_APP === 'true' && telegramShareToken && (
            <TelegramShare key={conversation.id} source={`chat:${conversation.id}`} token={telegramShareToken} language={language}
              snapshot={() => telegramShareSnapshot(conversation.title.trim() || assistant.name.trim() || t('Чат', 'Chat'), conversation.messages, message => ({
                author:message.role === 'user' ? profile.name.trim() || t('Участник', 'Participant') : assistant.name.trim() || t('Помощник', 'Assistant'),
                role:message.role,
                text:message.content,
                hasImage:!!message.images?.length,
              }))}/>
          )}
          <a className="button button--secondary" href={`#/assistant/${assistant.id}`}>{t('Новый разговор','New chat')}</a>
        </div>}
      </div>
      <ChatBoardTabs assistantId={assistant.id} conversationId={conversation?.id} active="chat"/>
      {assistant.id === 'budget' && <Suspense fallback={null}><FamilyBudget profileId={profile.id}/></Suspense>}
      <div className="chat__messages" aria-live="polite" aria-busy={busy} data-long-thread={(conversation?.messages.length ?? 0) > 60 || undefined}>
        {conversation?.messages.length ? <PrivateMessages messages={conversation.messages} assistantName={assistant.name} userName={t('Вы','You')}/> : (
          <div className="chat-welcome">
            <span className={`avatar avatar--large avatar--${assistant.color}`}><AgentIcon name={assistant.icon} size={32}/></span>
            <WelcomeTitle key={routeKey}/>
            <p className="chat-welcome__text">{assistant.description}</p>
            {suggestions}
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
      {hasMessages && suggestions}
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
