import {useEffect, useRef, useState, type CSSProperties, type PointerEvent} from 'react';
import {ArrowRight} from 'lucide-react';
import {ShaderLayer} from './ShaderEffects';
import {prefetchScreen} from '../prefetch';
import {Scene} from './Scene';
import {useUi} from '../language';

const art = import.meta.env.BASE_URL + 'illustrations/ideas.svg';
// Use the same viewBox and silhouette as the exported art while its request is pending.
const placeholderSilhouette = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
  <rect x="70" y="51" width="142" height="123" rx="31" transform="rotate(-9 141 112)"/>
  <rect x="211" y="66" width="63" height="74" rx="9" transform="rotate(12 242 103)"/>
  <circle cx="124" cy="31" r="6"/><path d="m128 52-3-15M80 153c-28 1-29 19-17 24M193 151c20-9 28-1 29 10" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <path d="m253 29 0 24m-12-12h24m-20-8 16 16m-16 0 16-16" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <circle cx="41" cy="87" r="7"/><path d="m45 161 4 9 10 1-8 6 2 10-8-6-9 5 3-10-7-7 10 1 3-9Z"/>
</svg>`;
const pendingMask = { '--media-mask': `url("data:image/svg+xml,${encodeURIComponent(placeholderSilhouette)}")` } as CSSProperties;
const readyMask = { '--media-mask': `url("${art}")` } as CSSProperties;

export function LandingHero({signedIn = false}: {signedIn?: boolean}) {
  const {t} = useUi();
  const image = useRef<HTMLImageElement>(null);
  const aura = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const tracking = useRef<MediaQueryList | null>(null);
  const center = useRef<{x: number; y: number} | null>(null);
  const point = useRef({x: 0, y: 0});
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    tracking.current = window.matchMedia?.('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)') ?? null;
    if (image.current?.complete) setStatus(image.current.naturalWidth ? 'ready' : 'fallback');
    window.addEventListener('resize', stopTracking);
    return () => {
      window.removeEventListener('resize', stopTracking);
      stopTracking();
    };
  }, []);

  function stopTracking() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    center.current = null;
  }

  function followPointer(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch' || !tracking.current?.matches) return;
    if (!center.current) {
      const bounds = event.currentTarget.getBoundingClientRect();
      center.current = {x: window.scrollX + bounds.left + bounds.width / 2, y: window.scrollY + bounds.top + bounds.height / 2};
    }
    point.current.x = event.pageX - center.current.x;
    point.current.y = event.pageY - center.current.y;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (!aura.current) return;
      const {x, y} = point.current;
      aura.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }

  return (
    <section className="hero hero--intro" onPointerEnter={followPointer} onPointerMove={followPointer} onPointerLeave={stopTracking}>
      <div className="hero-aura" aria-hidden="true">
        <div className="hero-aura__point" ref={aura}>
          <span className="hero-aura__wash"/>
          <span className="hero-aura__wave"/>
        </div>
      </div>
      <div className="hero__content">
        <h1 className="hero__title">{t('Меньше рутины.', 'Less routine.')}<br/><span>{t('Больше жизни.', 'More life.')}</span></h1>
        <p className="hero__description">{t('AI-помощники для работы, учёбы и повседневных дел.', 'AI assistants for work, learning, and everyday tasks.')}</p>
        <a className="button button--primary" href={signedIn ? '#/assistants' : '#/login'}
          onPointerEnter={signedIn ? undefined : () => prefetchScreen('login')}
          onFocus={signedIn ? undefined : () => prefetchScreen('login')}>
          {signedIn ? t('Выбрать помощника', 'Choose an assistant') : t('Войти по коду', 'Sign in with a code')}<ArrowRight size={18}/>
        </a>
      </div>
      <div className="hero__illustration">
        <div className="reveal-media reveal-media--contour" data-status={status}>
          <img
            ref={image}
            className="reveal-media__image"
            src={art}
            alt=""
            width="320"
            height="220"
            decoding="async"
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('fallback')}
          />
          {status === 'loading' && (
            <div className="media-skeleton" style={pendingMask} data-skeleton-level="media" aria-hidden="true">
              <ShaderLayer effect="skeleton" duration={1400}/>
            </div>
          )}
          {status === 'ready' && (
            <div className="media-reveal-layer" style={readyMask} aria-hidden="true">
              <ShaderLayer effect="reveal" duration={690}/>
            </div>
          )}
          {status === 'fallback' && <div className="reveal-media__fallback"><Scene/></div>}
        </div>
      </div>
    </section>
  );
}
