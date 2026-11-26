import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowRight, Bookmark} from 'lucide-react';
import {authenticate, type AuthMode, type Identity} from './accounts';
import {Modal, useCopy} from './ui';

export const guestCopy = [
  'Без аккаунта чаты исчезнут из истории через 3 дня после последнего сообщения.',
  'Without an account, chats leave your history three days after the last message.',
] as const;

export function AuthDialog({mode, onMode, onContinue, onSuccess}: {
  mode: AuthMode | null; onMode: (mode: AuthMode | null) => void;
  onContinue?: () => void; onSuccess: (identity: Identity) => void;
}) {
  const t = useCopy();
  const title = mode === 'create' ? t('Создать аккаунт', 'Create account')
    : mode === 'sign-in' ? t('Вход в B-demo', 'Sign in to B-demo') : t('Сохрани свои чаты', 'Keep your chats');
  return <Modal open={mode !== null} onOpenChange={open => {if (!open) onMode(null);}} title={title} extra="dialog--auth">
    {mode === 'choose' && <div className="auth-choice">
      <span className="auth-choice__art" aria-hidden="true"><Bookmark size={30} strokeWidth={2.25}/></span>
      <p>{t(...guestCopy)}</p>
      <button type="button" className="button button--primary button--large" onClick={() => onMode('create')}>
        {t('Создать аккаунт', 'Create account')}<ArrowRight size={19}/>
      </button>
      <button type="button" className="button button--secondary" onClick={() => onMode('sign-in')}>{t('Войти', 'Sign in')}</button>
      {onContinue && <button type="button" className="button button--quiet" onClick={onContinue}>{t('Продолжить гостем', 'Continue as guest')}</button>}
    </div>}
    {(mode === 'create' || mode === 'sign-in') && <AccountForm key={mode} mode={mode}
      onBack={() => onMode('choose')} onSuccess={onSuccess}/>}
  </Modal>;
}

function AccountForm({mode, onBack, onSuccess}: {
  mode: 'create' | 'sign-in'; onBack: () => void; onSuccess: (identity: Identity) => void;
}) {
  const t = useCopy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const create = mode === 'create';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const form = new FormData(event.currentTarget);
    const task = new AbortController();
    request.current = task;
    setBusy(true);
    setError('');
    try {
      const account = await authenticate(mode, {email: String(form.get('email') ?? ''), name: String(form.get('name') ?? ''), code: String(form.get('code') ?? '')}, task.signal);
      if (!task.signal.aborted) onSuccess(account);
    } catch (cause) {
      if (task.signal.aborted) return;
      const reason = cause instanceof Error ? cause.message : '';
      const messages: Record<string, string> = {
        input: t('Проверь email, имя и код из шести цифр.', 'Check your email, name and six-digit code.'),
        credentials: t('Аккаунт или код не подошли.', 'The account or code did not match.'),
        exists: t('Такой аккаунт уже есть в этом браузере. Выбери «Войти».', 'This account already exists in this browser. Choose Sign in.'),
      };
      setError(messages[reason] ?? t('Не удалось сохранить аккаунт. Проверь, доступно ли хранилище браузера.', 'The account could not be saved. Check whether browser storage is available.'));
    } finally {
      request.current = null;
      if (!task.signal.aborted) setBusy(false);
    }
  }
  return <form className="account-form" onSubmit={event => {void submit(event);}}>
    <p>{t('Аккаунт и чаты сохраняются в этом браузере. Придумай код, чтобы вернуться к своим чатам.', 'Your account and chats stay in this browser. Choose a code to access them again.')}</p>
    {create && <label>{t('Имя', 'Name')}<input required name="name" autoComplete="nickname" maxLength={50} placeholder={t('Как тебя зовут?', 'What should we call you?')}/></label>}
    <label>Email<input required type="email" name="email" autoComplete="email" maxLength={120} placeholder="name@example.com"/></label>
    <label>{t('Код из 6 цифр', 'Six-digit code')}<input required type="password" name="code" inputMode="numeric" autoComplete={create ? 'new-password' : 'current-password'}
      maxLength={6} pattern="[0-9]{6}" placeholder="••••••"/></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="button button--primary button--large" disabled={busy}>
      {create ? t('Создать аккаунт', 'Create account') : t('Войти', 'Sign in')}<ArrowRight size={19}/>
    </button>
    <button className="button button--quiet" type="button" onClick={onBack} disabled={busy}><ArrowLeft size={17}/>{t('Назад', 'Back')}</button>
  </form>;
}
