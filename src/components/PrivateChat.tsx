import {lazy, memo, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject} from 'react';
import {ChevronLeft, Link2, Table2, WifiOff, X} from 'lucide-react';
import type {Assistant} from '../catalog';
import {lastChatMessageIndex, type Conversation} from '../state';
import {usePinnedChatThread} from '../usePinnedChatThread';
import {AgentIcon} from './Brand';
import {WelcomeTitle} from './ShaderEffects';
import {ChatComposer, DocumentLabel, MessageImages} from './ChatComposer';
import {ChatSharing} from './ChatSharing';
import {ChatSuggestions} from './ChatSuggestions';
import {ChatBoardTabs} from './ChatBoardTabs';
import type {ChatImage, ChatModel} from '../chat-media';
import type {ChatDrafts} from '../chat-drafts';
import type {LocalProfile} from '../session';
import {useUi} from '../language';
import {telegramShareSnapshot} from '../telegram-share-client';
import {TelegramShare} from './TelegramShare';

const FamilyBudgetDialog = lazy(() => import('./FamilyBudgetDialog').then(module => ({default:module.FamilyBudgetDialog})));

const PrivateMessages = memo(function PrivateMessages({messages, assistantName, userName, budgetCard, onOpenBudget}: {
  messages: Conversation['messages'];
  assistantName: string;
  userName: string;
  budgetCard: RefObject<HTMLButtonElement | null>;
  onOpenBudget: (opener: HTMLButtonElement) => void;
}) {
  const {t} = useUi();
  return messages.map((message, index) => (
    <article className={`message message--${message.role}`} key={index}>
      <span className="message__author">{message.role === 'user' ? userName : assistantName}</span>
      {message.artifact === 'family-budget' ? <>
        <p className="message__body"><strong>{t('Таблица семейного бюджета', 'Family budget table')}</strong></p>
        <button className="button button--secondary message__budget-action" type="button" ref={budgetCard}
          aria-haspopup="dialog" onClick={event => onOpenBudget(event.currentTarget)}>
          <Table2 size={18} aria-hidden="true"/>{t('Открыть таблицу бюджета', 'Open budget table')}
        </button>
      </> : message.content && <p className="message__body">{message.content}</p>}
      {message.document && <div className="message__document"><DocumentLabel file={message.document}/></div>}
      <MessageImages images={message.images}/>
    </article>
  ));
});

export function PrivateChat({assistant, conversation, profile, messagePrice, mode, online, busy, drafts, error, onSend, onCreateBudget, model, onModel, telegramShareToken}: {
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
  onCreateBudget?: () => string | undefined;
  model: ChatModel;
  onModel: (model: ChatModel) => void;
  telegramShareToken?: string;
}) {
  const {t,language}=useUi();
  const draftField = useRef<HTMLTextAreaElement>(null);
  const budgetCard = useRef<HTMLButtonElement>(null);
  const [budgetDialog, setBudgetDialog] = useState<{conversationId: string; opener: HTMLButtonElement}>();
  const routeKey = conversation?.id ?? 'new:' + assistant.id;
  const thread = usePinnedChatThread(routeKey, conversation?.messages, busy);
  const draft = useSyncExternalStore(drafts.subscribe, () => drafts.get(routeKey));
  const attachment = useSyncExternalStore(drafts.subscribe, () => drafts.getAttachment(routeKey));
  const onDraft = (text: string) => drafts.set(routeKey, text);
  useEffect(() => {
    if (attachment) draftField.current?.focus({preventScroll:true});
  }, [attachment]);
  useEffect(() => {
    setBudgetDialog(current => current?.conversationId === routeKey ? current : undefined);
  }, [routeKey]);
  const composer = useRef({route:routeKey, epoch:0, createdId:''});
  if (composer.current.route !== routeKey) {
    if (composer.current.createdId !== routeKey) composer.current.epoch++;
    composer.current.route = routeKey;
    composer.current.createdId = '';
  }
  const openSavedBudget = useCallback((opener: HTMLButtonElement) => {
    setBudgetDialog({conversationId:routeKey, opener});
  }, [routeKey]);
  const offlineAi = mode === 'live' && !online;
  const lastMessage = conversation?.messages[lastChatMessageIndex(conversation.messages)];
  const canRetry = !busy && lastMessage?.role === 'user';
  const hasMessages = Boolean(conversation?.messages.length);
  const watchWithLeo = assistant.id === 'leo';
  function applySuggestion(next: string) {
    const field = draftField.current;
    if (!field || field.readOnly) return;
    onDraft(next);
    field.focus();
  }
  const suggestions = <ChatSuggestions assistant={assistant} draft={draft} compact={hasMessages || watchWithLeo} busy={busy}
    onCreateBudget={onCreateBudget && (opener => {
      const conversationId = onCreateBudget();
      if (!conversationId) return;
      if (!conversation) composer.current.createdId = conversationId;
      setBudgetDialog({conversationId, opener});
    })}
    onApply={applySuggestion}/>;

  return (
    <section className="chat chat--docked">
      <div className="chat__header">
        <div className="chat__identity">
          <a className="icon-button chat__back" href="#/history" aria-label={t('Назад к чатам','Back to chats')}><ChevronLeft size={22}/></a>
          <span className={`avatar avatar--${assistant.color}`}><AgentIcon name={assistant.icon}/></span>
          <div className="chat__heading">
            <h1 className="chat__title">{assistant.name}</h1>
            <span className="chat__subtitle">{mode === 'demo' ? t('Деморежим · ответы по шаблону','Demo · template replies') : t('Режим AI','AI mode')}</span>
          </div>
        </div>
        <div className="chat__header-actions">
          <ChatSharing conversation={hasMessages ? conversation : undefined} profile={profile} assistantName={assistant.name} language={language}/>
          {conversation && import.meta.env.VITE_TELEGRAM_MINI_APP === 'true' && telegramShareToken && (
            <TelegramShare key={conversation.id} source={`chat:${conversation.id}`} token={telegramShareToken} language={language}
              snapshot={() => telegramShareSnapshot(conversation.title.trim() || assistant.name.trim() || t('Чат', 'Chat'), conversation.messages, message => ({
                author:message.role === 'user' ? profile.name.trim() || t('Участник', 'Participant') : assistant.name.trim() || t('Помощник', 'Assistant'),
                role:message.role,
                text:message.content,
                hasImage:!!message.images?.length,
              }))}/>
          )}
          {conversation && <a className="button button--secondary" href={`#/assistant/${assistant.id}`}>{t('Новый разговор','New chat')}</a>}
        </div>
        <a className="icon-button chat__close" href="#/history" aria-label={t('Закрыть чат','Close chat')}><X size={20} aria-hidden="true"/></a>
      </div>
      <div className="chat__thread" ref={thread} tabIndex={0} role="region" aria-label={t('История сообщений','Message history')}>
        <ChatBoardTabs assistantId={assistant.id} conversationId={conversation?.id} active="chat"/>
        <div className="chat__messages" aria-live="polite" aria-busy={busy} data-long-thread={(conversation?.messages.length ?? 0) > 60 || undefined}>
          {!hasMessages && (
            <div className="chat-welcome">
              <span className={`avatar avatar--large avatar--${assistant.color}`}><AgentIcon name={assistant.icon} size={32}/></span>
              <WelcomeTitle key={routeKey}/>
              <p className="chat-welcome__text">{assistant.description}</p>
              {!watchWithLeo && suggestions}
            </div>
          )}
          {watchWithLeo && <article className="message message--assistant" aria-label={t('Совместный просмотр с Лео', 'Watch together with Leo')}>
            <span className="message__author">{assistant.name}</span>
            <p className="message__body message__stream-copy">{t(
              'У нас есть расширение для совместного просмотра на YouTube и VK Видео. Вставь ссылку на стрим или ролик. Пока смотрим, спрашивай про отсылки, сложные темы и незнакомые слова.',
              'We have a browser extension for watching together on YouTube and VK Video. Paste a link to a stream or video. While we watch, ask me about references, tricky topics, or unfamiliar words.',
            )}</p>
            <button type="button" className="button button--secondary message__stream-action"
              disabled={busy || offlineAi} onClick={() => applySuggestion(draft)}>
              <Link2 size={18} aria-hidden="true"/>{t('Добавить ссылку на стрим', 'Add a stream link')}
            </button>
          </article>}
          {hasMessages && conversation && <PrivateMessages messages={conversation.messages} assistantName={assistant.name}
            userName={t('Вы','You')} budgetCard={budgetCard} onOpenBudget={openSavedBudget}/>}
          {busy && <p role="status" className="chat__loading chat__loading--skeleton" data-skeleton-level="surface"><span/>{t('Готовим ответ…','Preparing a reply…')}</p>}
        </div>
        {offlineAi && <p role="status" className="offline-note"><WifiOff size={16}/> {t('Подключитесь к интернету, чтобы отправить запрос AI.','Connect to the internet to send an AI request.')}</p>}
        {canRetry && (
          <div className={`notice chat__error${error ? ' notice--error' : ''}`} role={error ? 'alert' : 'status'}>
            <span>{error || t('Ответ ещё не получен.','No reply yet.')}</span>
            <button className="button button--text" disabled={offlineAi} onClick={() => onSend(true, null)}>{t('Повторить запрос','Try again')}</button>
          </div>
        )}
        {(hasMessages || watchWithLeo) && suggestions}
      </div>
      <ChatComposer key={composer.current.epoch} fieldRef={draftField} draft={draft} onDraft={onDraft}
        busy={busy} disabled={offlineAi} model={model} onModel={onModel}
        attachment={attachment} onRemoveAttachment={() => drafts.setAttachment(routeKey)}
        price={messagePrice} retryDraft={!!(canRetry && !attachment && draft.trim() && lastMessage.content === draft.trim())}
        onSubmit={async (images, anchor) => {
          const accepted = await onSend(canRetry && !attachment && !images.length && lastMessage.content === draft.trim(), anchor, images);
          if (accepted && !conversation) composer.current.createdId = location.hash.match(/^#\/chat\/([^/]+)$/)?.[1] ?? '';
          return accepted;
        }}/>
      <p className="chat__disclaimer">{mode === 'demo' ? t('Демочат работает офлайн.','Demo chat works offline.') : t('AI может ошибаться. Проверяйте важные факты.','AI can make mistakes. Verify important facts.')}</p>
      {budgetDialog?.conversationId === routeKey && <Suspense fallback={null}>
        <FamilyBudgetDialog profileId={profile.id} onClose={() => setBudgetDialog(undefined)}
          returnFocus={() => budgetDialog.opener.isConnected ? budgetDialog.opener : budgetCard.current}/>
      </Suspense>}
    </section>
  );
}
