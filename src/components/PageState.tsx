import {useUi} from '../language';
import {useEffect, useRef} from 'react';
import {CircleHelp, RefreshCw, WifiOff} from 'lucide-react';
import {Scene} from './Scene';
import {useOnline} from '../useAccess';
import {allowsMotion} from './ShaderEffects';

export function PageState({kind, href = '#/', title, description}: {
  kind: 'not-found' | 'conversation' | 'failure';
  href?: string;
  title?: string;
  description?: string;
}) {
  const {t} = useUi();
  const root = useRef<HTMLElement>(null);
  const online = useOnline();
  const HeadingIcon = kind === 'failure' && !online ? WifiOff : CircleHelp;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    node.focus({preventScroll: true});
    if (!node.animate || !allowsMotion()) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    void import('motion/mini').then(({animate}) => {
      if (disposed) return;
      const controls = animate(node, {opacity: [.45, 1], transform: ['translateY(8px)', 'translateY(0)']},
        {duration: .29, ease: [0.2, 0.8, 0.2, 1]});
      cleanup = () => controls.cancel();
    }).catch(() => {});
    return () => { disposed = true; cleanup?.(); };
  }, []);

  return (
    <section ref={root} tabIndex={-1} className="page-state" aria-labelledby="page-state-title">
      <div className="page-state__art"><Scene kind={kind === 'conversation' ? 'history' : 'lost'}/></div>
      <div className="page-state__content">
        <span className="page-state__label">
          <HeadingIcon size={16}/>
          {kind === 'not-found' ? '404' : kind === 'failure' && !online ? t('Офлайн','Offline') : 'Agentik'}
        </span>
        <h1 id="page-state-title" className="section-title">
          {title ?? (kind === 'not-found' ? t('Страница не найдена','Page not found')
            : kind === 'conversation' ? t('Разговор не найден','Chat not found') : t('Не удалось открыть экран','Unable to open this screen'))}
        </h1>
        <p className="page-state__description">
          {description ?? (kind === 'not-found' ? t('Проверьте ссылку или вернитесь на главную.','Check the link or go back home.')
            : kind === 'conversation' ? t('Откройте историю, чтобы продолжить сохранённый разговор.','Open your history to continue a saved chat.')
            : online ? t('Попробуйте загрузить страницу ещё раз.','Try loading the page again.') : t('Для этого экрана нужно соединение. Подключитесь и повторите.','Connect to the internet and try again.'))}
        </p>
        <div className="page-state__actions">
          {kind === 'failure'
            ? <button className="button button--primary" onClick={() => location.reload()}><RefreshCw size={17}/> {t('Повторить загрузку','Reload')}</button>
            : <a className="button button--primary" href={href}>{kind === 'conversation' ? t('К истории','Open history') : t('На главную','Home')}</a>}
          {kind === 'failure' && <a className="button button--secondary" href={import.meta.env.BASE_URL}>{t('На главную','Home')}</a>}
        </div>
      </div>
    </section>
  );
}
