import {useEffect, useRef, useState, type CSSProperties, type MouseEvent} from 'react';
import {ArrowRight} from 'lucide-react';
import {AgentikMark} from './AgentikMark';
import {allowsMotion, ShaderLayer} from './ShaderEffects';
import type {Point} from '../motion/shader';
import {prefetchScreen} from '../prefetch';
import {useUi} from '../language';
import './landing-hero-wave.css';

const art = import.meta.env.BASE_URL + 'favicon.svg';
const silhouette = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14"/></svg>';
const mediaMask = { '--media-mask': `url("data:image/svg+xml,${encodeURIComponent(silhouette)}")` } as CSSProperties;

export function LandingHero({signedIn = false}: {signedIn?: boolean}) {
  const {t} = useUi();
  const image = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [waveOrigin, setWaveOrigin] = useState<Point>();

  useEffect(() => {
    if (image.current?.complete) setStatus(image.current.naturalWidth ? 'ready' : 'fallback');
  }, []);

  function ripple(event: MouseEvent<HTMLElement>) {
    if (status !== 'ready' || !event.detail || event.defaultPrevented || !allowsMotion() || !(event.target instanceof Element)
      || event.target.closest('a, button, input, select, textarea, label, summary, [contenteditable], [role="button"], [role="link"]')) return;
    setWaveOrigin({x: event.clientX, y: event.clientY});
  }

  return (
    <section className="hero hero--intro" onClick={ripple}>
      <div className="hero__content">
        {!signedIn && <p className="hero__label">{t('МАЛЕНЬКИЕ ПОМОЩНИКИ. БОЛЬШИЕ ВОЗМОЖНОСТИ.', 'SMALL ASSISTANTS. BIG POSSIBILITIES.')}</p>}
        <h1 className="hero__title">{t('Меньше рутины.', 'Less routine.')}<br/><span>{t('Больше жизни.', 'More life.')}</span></h1>
        <p className="hero__description">{t('AI-помощники для работы, учёбы и повседневных дел.', 'AI assistants for work, learning, and everyday tasks.')}</p>
        <a className="button button--primary" href={signedIn ? '#/assistants' : '#/login'}
          onPointerEnter={signedIn ? undefined : () => prefetchScreen('login')}
          onFocus={signedIn ? undefined : () => prefetchScreen('login')}>
          {signedIn ? t('Выбрать помощника', 'Choose an assistant') : t('Войти по коду', 'Sign in with a code')}<ArrowRight size={18}/>
        </a>
      </div>
      <div className="hero-mark" aria-hidden="true">
        <svg className="hero-mark__pixels" viewBox="0 0 84 84" shapeRendering="crispEdges" focusable="false">
          <g className="hero-mark__cluster hero-mark__cluster--top-right">
            <rect x="62" y="19" width="5" height="5"/>
            <rect x="68" y="13" width="3" height="3" opacity=".7"/>
            <rect x="61" y="10" width="2" height="2" opacity=".45"/>
          </g>
          <g className="hero-mark__cluster hero-mark__cluster--right">
            <rect x="65" y="50" width="4" height="4" opacity=".8"/>
            <rect x="70" y="55" width="2" height="2" opacity=".5"/>
          </g>
          <g className="hero-mark__cluster hero-mark__cluster--bottom-left">
            <rect x="15" y="59" width="5" height="5"/>
            <rect x="11" y="66" width="3" height="3" opacity=".68"/>
            <rect x="18" y="70" width="2" height="2" opacity=".48"/>
          </g>
        </svg>
        <div className="reveal-media reveal-media--contour" data-status={status}>
          <img
            ref={image}
            className="reveal-media__image"
            src={art}
            alt=""
            width="48"
            height="48"
            decoding="async"
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('fallback')}
          />
          {status === 'loading' && (
            <div className="media-skeleton" style={mediaMask} data-skeleton-level="media" aria-hidden="true">
              <ShaderLayer effect="skeleton" duration={1400}/>
            </div>
          )}
          {status === 'ready' && !waveOrigin && (
            <div className="media-reveal-layer" style={mediaMask} aria-hidden="true">
              <ShaderLayer effect="reveal" duration={690}/>
            </div>
          )}
          {status === 'ready' && waveOrigin && <ShaderLayer effect="ripple" duration={920} origin={waveOrigin} image={image}/>}
          {status === 'fallback' && <div className="reveal-media__fallback">
            <svg className="hero-mark__fallback" viewBox="0 0 48 48" focusable="false"><AgentikMark/></svg>
          </div>}
        </div>
      </div>
    </section>
  );
}
