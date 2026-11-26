import {useEffect, useRef, useState, type FormEvent} from 'react';
import {WifiOff} from 'lucide-react';
import {animate} from 'motion/mini';
import {AccessError, demoAccessEnabled, logIn, publicDemoAccounts} from '../access-client';
import {normalizeAccessCode, type AccessSession} from '../access-contract';
import {useOnline} from '../useAccess';
import {useUi} from '../language';
import {allowsMotion} from './ShaderEffects';

const ease: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export default function CodeGate({notice, onUnlock, onAccept}: {notice: string; onUnlock:()=>void; onAccept: (value: AccessSession) => void}) {
  const {t} = useUi();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'accepted' | 'rejected'>('idle');
  const [error, setError] = useState('');
  const online = useOnline();
  const canCheck = online || demoAccessEnabled;
  const group = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const handoff = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = phase === 'checking' || phase === 'accepted';
  const result = phase === 'accepted' ? t('ПРИНЯТ','PASSED') : phase === 'rejected' ? t('ОШИБКА','FAILED') : '';

  useEffect(() => {
    panel.current?.focus({preventScroll: true});
    return () => {
      operation.current?.abort();
      clearTimeout(handoff.current);
    };
  }, []);

  useEffect(() => {
    if (!result || !group.current || !allowsMotion()) return;
    if (!group.current.animate) return;
    const controls = phase === 'rejected'
      ? animate(group.current, {transform: ['translateX(0)', 'translateX(-3px)', 'translateX(3px)', 'translateX(0)']}, {duration: .28, ease})
      : animate(group.current, {transform: ['scale(0.98)', 'scale(1)'], opacity: [.8, 1]}, {duration: .34, ease});
    return () => controls.cancel();
  }, [phase, result]);

  function updateCode(value: string, selection: number) {
    clearTimeout(handoff.current);
    setCode(value);
    setCursor(value.slice(0, selection).replace(/[\s-]/g, '').length);
    setError('');
    setPhase('idle');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void check(code);
  }

  function receiveCode(field: HTMLInputElement, complete: boolean) {
    if (operation.current || busy) return;
    const {value, selectionStart} = field;
    updateCode(value, selectionStart ?? value.length);
    if (complete && normalizeAccessCode(value)) void check(value);
  }

  async function check(value: string, address = email) {
    if (operation.current || busy || !canCheck) return;
    const normalized = normalizeAccessCode(value);
    if (!normalized) {
      setError(t('Введите шесть латинских букв или цифр.','Enter six Latin letters or digits.'));
      input.current?.focus();
      return;
    }
    const trimmedEmail = address.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('Укажите корректный email.','Enter a valid email address.'));
      emailField.current?.focus();
      return;
    }
    const controller = new AbortController();
    clearTimeout(handoff.current);
    operation.current = controller;
    setError('');
    setPhase('checking');
    try {
      const session = await logIn(normalized, controller.signal, trimmedEmail);
      if (controller.signal.aborted) return;
      setCode('');
      setPhase('accepted');
      onUnlock();
      if (!allowsMotion()) onAccept(session);
      else handoff.current = setTimeout(() => onAccept(session), 390);
    } catch (failure) {
      if (controller.signal.aborted) return;
      const rejected = failure instanceof AccessError && failure.reason === 'invalid';
      setPhase(rejected ? 'rejected' : 'idle');
      setError(failure instanceof AccessError
        ? t(failure.message, rejected ? 'The email or code did not match.' : 'Sign-in failed. Try again shortly.')
        : t('Не удалось войти. Попробуйте ещё раз.', 'Sign-in failed. Please try again.'));
      if (rejected) {
        setCode('');
        setCursor(0);
        input.current?.focus();
        handoff.current = setTimeout(() => setPhase('idle'), allowsMotion() ? 510 : 0);
      }
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }

  const visible = code.replace(/[\s-]/g, '').toUpperCase();
  return (
    <main className="code-gate">
      <section className="code-gate__panel" ref={panel} tabIndex={-1} aria-labelledby="access-title">
        <h1 id="access-title" className="code-gate__title">{t('Вход в Agentik','Sign in to Agentik')}</h1>
        <p className="code-gate__description">{demoAccessEnabled
          ? t('Выберите тестовый аккаунт или введите его email и код.','Choose a demo account or enter its email and code.')
          : t('Введите код доступа и email, если он указан для вашего кода.','Enter your access code and its associated email if you have one.')}</p>
        {demoAccessEnabled && <div className="code-gate__demo" role="group" aria-label={t('Тестовые аккаунты','Demo accounts')}>
          {publicDemoAccounts.map(account => <button type="button" key={account.accountId} className="button button--secondary" disabled={busy}
            onClick={() => {setEmail(account.email); void check(account.code, account.email);}}>
            {account.plan === 'pro' ? t('Демо PRO','PRO demo') : t('Демо Free','Free demo')}
          </button>)}
        </div>}
        <form className="code-gate__form" onSubmit={submit} noValidate>
          <label htmlFor="access-email" className="form__label">Email</label>
          <input id="access-email" ref={emailField} className="code-gate__email" type="email" autoComplete="email" maxLength={254}
            placeholder={t('Ваш email','Your email')} value={email} readOnly={busy}
            onChange={event => {setEmail(event.target.value);setError('');}}/>
          <label htmlFor="access-code" className="form__label">{t('Код доступа','Access code')}</label>
          <div className="code-gate__field" ref={group} data-phase={phase}>
            <div className="code-gate__cells" aria-hidden="true">
              {Array.from({length: 6}, (_, index) => (
                <span className="code-gate__cell" data-caret={index === Math.min(cursor, 5)} key={index}>
                  {result[index] || visible[index] || ''}
                </span>
              ))}
            </div>
            <input
              className="code-gate__input"
              id="access-code"
              name="access-code"
              autoComplete="one-time-code"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
              readOnly={busy}
              value={code}
              aria-invalid={!!error && canCheck && phase !== 'checking'}
              aria-describedby="access-help"
              onChange={event => receiveCode(event.currentTarget, !(event.nativeEvent as InputEvent).isComposing)}
              onCompositionEnd={event => receiveCode(event.currentTarget, true)}
              onSelect={event => setCursor(event.currentTarget.value.slice(0, event.currentTarget.selectionStart ?? 0).replace(/[\s-]/g, '').length)}
            />
          </div>
          <div id="access-help" className="code-gate__help">
            {!canCheck ? <p role="status"><WifiOff size={16}/> {t('Для проверки кода нужен интернет.','Connect to the internet to verify your code.')}</p>
              : error ? <p className="code-gate__error" role="alert">{error}</p>
              : phase === 'accepted' ? <p role="status">{t('Вход выполнен.','Signed in successfully.')}</p>
              : phase === 'checking' ? <p role="status">{t('Проверяем код…','Verifying your code…')}</p>
              : <p>{notice || t('6 латинских букв или цифр. Код можно вставить целиком.','6 Latin letters or digits. You can paste the full code.')}</p>}
          </div>
          <button type="submit" className="button code-gate__submit" disabled={busy || !canCheck}>
            {phase === 'checking' ? t('Проверяем…','Verifying…') : phase === 'accepted' ? t('Открываем…','Opening…') : t('Войти','Sign in')}
          </button>
        </form>
        <p className="code-gate__agreement">
          <a className="text-link" href="#/agreement">{t('Пользовательское соглашение','User agreement')}</a>
        </p>
      </section>
    </main>
  );
}
