import {useEffect, useState, type ReactNode} from 'react';
import {ImageIcon, Link2Off, WifiOff} from 'lucide-react';
import {useUi} from '../language';
import {readTelegramShare, TelegramShareHttpError} from '../telegram-share-client';
import {isTelegramShareId, type TelegramShareView} from '../telegram-share-contract';
import {useOnline} from '../useAccess';
import {AgentikMark} from './AgentikMark';
import './telegram-chat-widget.css';

type WidgetState = {kind: 'loading' | 'unavailable' | 'error'} | {kind: 'ready'; view: TelegramShareView};

export function TelegramChatWidget({id}: {id: string}) {
  return <WidgetChat key={id} id={id}/>;
}

function WidgetChat({id}: {id: string}) {
  const {t} = useUi();
  const online = useOnline();
  const valid = isTelegramShareId(id);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WidgetState>({kind:'loading'});
  const view = online && state.kind === 'ready' ? state.view : null;
  const loading = valid && online && state.kind === 'loading';

  useEffect(() => {
    if (!valid) return;
    setState({kind:'loading'});
    if (!online) return;
    const controller = new AbortController();
    void readTelegramShare(id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setState(result.expiresAt > Date.now() ? {kind:'ready', view:result} : {kind:'unavailable'});
    }).catch(cause => {
      if (controller.signal.aborted) return;
      const unavailable = cause instanceof TelegramShareHttpError && [403, 404, 410].includes(cause.status);
      setState({kind: unavailable ? 'unavailable' : 'error'});
    });
    return () => controller.abort();
  }, [id, valid, online, attempt]);

  useEffect(() => {
    if (!view) return;
    const timeout = setTimeout(() => setState({kind:'unavailable'}), view.expiresAt - Date.now());
    return () => clearTimeout(timeout);
  }, [view]);

  return (
    <main className="telegram-widget">
      <div className="telegram-widget__content">
        <header className="telegram-widget__header">
          <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><AgentikMark/></svg>
          <div>
            <h1 dir="auto">{view?.title || t('Чат из Agentik', 'Agentik chat')}</h1>
            {view && <p>{t('Только чтение', 'Read-only')}</p>}
          </div>
        </header>
        {!valid || state.kind === 'unavailable' ? (
          <WidgetNotice icon={<Link2Off size={22} aria-hidden="true"/>}
            title={t('Ссылка недоступна', 'Link unavailable')}>
            {t('Возможно, срок ссылки истёк или её отозвали. Попросите отправителя прислать новую ссылку.',
              'The link may have expired or been revoked. Ask the sender for a new link.')}
          </WidgetNotice>
        ) : !online ? (
          <WidgetNotice icon={<WifiOff size={22} aria-hidden="true"/>}
            title={t('Нет подключения к интернету', 'No internet connection')}>
            {t('Чат загрузится, когда интернет снова будет доступен.', 'The chat will load when you reconnect.')}
          </WidgetNotice>
        ) : state.kind === 'error' ? (
          <WidgetNotice title={t('Не удалось загрузить чат', 'Could not load chat')}
            action={<button type="button" className="button button--secondary" onClick={() => setAttempt(value => value + 1)}>
              {t('Повторить', 'Retry')}
            </button>}>
            {t('Проверьте соединение и попробуйте ещё раз.', 'Check your connection and try again.')}
          </WidgetNotice>
        ) : loading ? (
          <div className="telegram-widget__loading" role="status">
            <span className="sr-only">{t('Загружаем чат…', 'Loading chat…')}</span>
            <span aria-hidden="true"/><span aria-hidden="true"/>
          </div>
        ) : view?.messages.length ? (
          <ol className="telegram-widget__messages" role="list" aria-label={t('Сообщения', 'Messages')}>
            {view.messages.map((message, index) => (
              <li className={`telegram-widget__message telegram-widget__message--${message.role}`} key={index}>
                <bdi className="telegram-widget__author">{message.author}</bdi>
                {message.text && <p className="telegram-widget__text" dir="auto">{message.text}</p>}
                {message.hasImage && <span className="telegram-widget__attachment">
                  <ImageIcon size={15} aria-hidden="true"/>{t('Изображение', 'Image')}
                </span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="telegram-widget__empty" role="status">{t('В этой копии пока нет сообщений.', 'This copy has no messages yet.')}</p>
        )}
      </div>
    </main>
  );
}

function WidgetNotice({title, children, icon, action}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="telegram-widget__notice">
      {icon && <div className="telegram-widget__notice-icon">{icon}</div>}
      <div role="status">
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      {action}
    </section>
  );
}
