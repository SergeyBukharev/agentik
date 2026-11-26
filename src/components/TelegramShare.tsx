import {useEffect, useId, useRef, useState} from 'react';
import {Copy, Send} from 'lucide-react';
import type {Language} from '../language';
import {manageTelegramShare, TelegramShareHttpError, type TelegramShareSource} from '../telegram-share-client';
import type {TelegramShareLink, TelegramShareSnapshot} from '../telegram-share-contract';
import {MAX_TELEGRAM_SHARE_MESSAGES} from '../telegram-share-contract';
import {getTelegramWebApp} from '../telegram-shell';
import {Modal} from './Modal';
import './telegram-share.css';

type LinkState = {kind: 'loading' | 'error'} | {kind: 'ready'; share: TelegramShareLink | null};

export function TelegramShare({source, token, snapshot, language}: {
  source: TelegramShareSource;
  token: string;
  snapshot: () => TelegramShareSnapshot;
  language: Language;
}) {
  const t = (ru: string, en: string) => language === 'en' ? en : ru;
  const title = t('Поделиться в Telegram', 'Share to Telegram');
  const linkField = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LinkState>({kind:'loading'});
  const [pending, setPending] = useState<'PUT' | 'DELETE' | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const lookup = useRef<AbortController | null>(null);
  const share = state.kind === 'ready' ? state.share : null;

  useEffect(() => () => lookup.current?.abort(), []);
  useEffect(() => {
    if (!open || !share) return;
    const timeout = setTimeout(() => {
      setState({kind:'ready', share:null});
      setNotice('');
    }, share.expiresAt - Date.now());
    return () => clearTimeout(timeout);
  }, [open, share]);

  function failure(cause: unknown) {
    if (!navigator.onLine) return t('Подключитесь к интернету, чтобы управлять ссылкой.', 'Connect to the internet to manage the link.');
    if (cause instanceof TelegramShareHttpError) {
      if (cause.status === 401) return t('Войдите в Agentik заново, чтобы управлять ссылкой.', 'Sign in to Agentik again to manage the link.');
      if (cause.status === 503) return t('Публикация ссылок пока недоступна.', 'Sharing links is currently unavailable.');
    }
    return t('Не удалось выполнить запрос. Попробуйте ещё раз.', 'The request failed. Try again.');
  }

  async function loadShare() {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setState({kind:'loading'});
    setError('');
    setNotice('');
    try {
      const current = await manageTelegramShare(source, token, {method:'GET', signal:controller.signal});
      if (!controller.signal.aborted) setState({kind:'ready', share:current});
    } catch (cause) {
      if (controller.signal.aborted) return;
      setState({kind:'error'});
      setError(failure(cause));
    } finally {
      if (lookup.current === controller) lookup.current = null;
    }
  }

  async function changeLink(method: 'PUT' | 'DELETE') {
    if (pending) return;
    setPending(method);
    setNotice('');
    setError('');
    try {
      const current = await manageTelegramShare(source, token, method === 'PUT' ? {method, snapshot:snapshot()} : {method});
      setState({kind:'ready', share:current});
      setNotice(method === 'PUT' ? t('Ссылка создана.', 'Link created.') : t('Ссылка отозвана.', 'Link revoked.'));
    } catch (cause) {
      setError(failure(cause));
    } finally {
      setPending(null);
    }
  }

  async function copyLink(url: string) {
    setError('');
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t('Ссылка скопирована.', 'Link copied.'));
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
      setNotice(t('Скопируйте выделенную ссылку.', 'Copy the selected link.'));
    }
  }

  const publicLink = share?.previewUrl ?? share?.url;
  const shareUrl = publicLink ? 'https://t.me/share/url?' + new URLSearchParams({
    url:publicLink, text:t('Чат из Agentik', 'Agentik chat'),
  }).toString() : undefined;

  return (
    <>
      <button type="button" className="button button--secondary telegram-share-trigger" aria-haspopup="dialog" onClick={() => {
        setOpen(true);
        if (!pending) void loadShare();
      }}>
        <Send size={16} aria-hidden="true"/>{title}
      </button>
      {open && <Modal title={title}
        description={t(
          'Любой человек с этой ссылкой сможет читать копию чата. Ссылка действует 24 часа.',
          'Anyone with this link can view a read-only copy of the chat for 24 hours.',
        )}
        onClose={() => {lookup.current?.abort(); setOpen(false);}}>
        <div className="telegram-share-panel">
          {state.kind === 'loading' && <p role="status">{t('Проверяем ссылку…', 'Checking for a link…')}</p>}
          {state.kind === 'error' && <button type="button" className="button button--secondary telegram-share-panel__retry"
            onClick={() => void loadShare()}>{t('Повторить', 'Retry')}</button>}
          {state.kind === 'ready' && (share ? (
            <>
              <div className="form">
                <label className="form__label" htmlFor={fieldId}>{t('Ссылка на чат', 'Chat link')}</label>
                <input id={fieldId} ref={linkField} className="form__input" readOnly value={publicLink}
                  onFocus={event => event.currentTarget.select()}/>
              </div>
              <div className="telegram-share-panel__actions">
                <a href={pending ? undefined : shareUrl} target="_blank" rel="noopener noreferrer" className="button button--primary"
                  aria-disabled={pending ? true : undefined}
                  onClick={event => {
                    if (!shareUrl || pending || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                    const app = getTelegramWebApp();
                    if (!app?.openTelegramLink) return;
                    try {
                      app.openTelegramLink(shareUrl);
                      event.preventDefault();
                    } catch { /* The link can still open from the browser. */ }
                  }}>
                  <Send size={17} aria-hidden="true"/>{t('Отправить в Telegram', 'Send to Telegram')}
                </a>
                <button type="button" className="button button--secondary" disabled={!!pending} onClick={() => void copyLink(publicLink ?? share.url)}>
                  <Copy size={17} aria-hidden="true"/>{t('Скопировать ссылку', 'Copy link')}
                </button>
              </div>
              {share.previewUrl && <a href={pending ? undefined : share.url} target="_blank" rel="noopener noreferrer"
                className="button button--text" aria-disabled={pending ? true : undefined}>{t('Открыть в Telegram', 'Open in Telegram')}</a>}
              <button type="button" className="button button--text telegram-share-panel__revoke" disabled={!!pending}
                onClick={() => void changeLink('DELETE')}>{t('Отозвать ссылку', 'Revoke link')}</button>
            </>
          ) : (
            <>
              <p className="telegram-share-panel__details">{t(
                `В копию войдут название, имена авторов и текст последних ${MAX_TELEGRAM_SHARE_MESSAGES} сообщений. Длинный текст может быть сокращён. Изображения будут отмечены как вложения.`,
                `The copy includes the title, authors, and text from up to ${MAX_TELEGRAM_SHARE_MESSAGES} recent messages. Long messages may be shortened. Images appear as attachment indicators.`,
              )}</p>
              <div className="telegram-share-panel__actions">
                <button type="button" className="button button--secondary" disabled={!!pending} onClick={() => setOpen(false)}>
                  {t('Отмена', 'Cancel')}
                </button>
                <button type="button" className="button button--primary" disabled={!!pending} onClick={() => void changeLink('PUT')}>
                  {t('Создать ссылку', 'Create link')}
                </button>
              </div>
            </>
          ))}
          {(pending || notice) && <p role="status">{pending === 'PUT' ? t('Создаём ссылку…', 'Creating the link…')
            : pending === 'DELETE' ? t('Отзываем ссылку…', 'Revoking the link…') : notice}</p>}
          {error && <p role="alert" className="notice notice--error">{error}</p>}
        </div>
      </Modal>}
    </>
  );
}
