import {useEffect, useId, useRef, useState, type CSSProperties} from 'react';
import {ArrowRight} from 'lucide-react';
import {ShaderLayer} from './ShaderEffects';
import {prefetchScreen} from '../prefetch';
import {Scene} from './Scene';
import {useUi} from '../language';

const art = import.meta.env.BASE_URL + 'illustrations/ideas.svg';
// Keep the shader mask static, independently of the animation inside the exported illustration.
const silhouette = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
  <rect width="48" height="48" rx="14" transform="translate(76 45) rotate(-9 66 66) scale(2.75)"/>
  <rect x="211" y="66" width="63" height="74" rx="9" transform="rotate(12 242 103)"/>
  <path d="M80 153c-28 1-29 19-17 24M193 151c20-9 28-1 29 10" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <path d="m253 29 0 24m-12-12h24m-20-8 16 16m-16 0 16-16" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <circle cx="41" cy="87" r="7"/><path d="m45 161 4 9 10 1-8 6 2 10-8-6-9 5 3-10-7-7 10 1 3-9Z"/>
</svg>`;
const mediaMask = { '--media-mask': `url("data:image/svg+xml,${encodeURIComponent(silhouette)}")` } as CSSProperties;

const streamRays = [-237, -182, -131, -84, -45, -18, 0, 18, 45, 84, 131, 182, 237].map(offset => {
  const edge = 250 + offset;
  const inner = 250 + offset * .09;
  return `M0 ${edge} C240 ${edge}, 365 ${inner}, 600 250 C835 ${inner}, 960 ${edge}, 1200 ${edge}`;
});
const glyphTracks = [1, 4, 6, 8, 11];
const glyphs = '01 A7 T4 9K 0X E8 13 S6 3Q M2 · 01 A7 T4 9K 0X E8 13 S6 3Q M2';

function HeroStream() {
  const id = useId();
  const gradient = `url(#${id}-ribbon)`;
  return <div className="hero-stream" aria-hidden="true">
    <svg viewBox="0 0 1200 500" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={id+'-ribbon'}>
          <stop stopColor="var(--hero-stream-accent)" stopOpacity=".55"/>
          <stop offset="32%" stopColor="var(--hero-stream-main)"/>
          <stop offset="50%" stopColor="var(--hero-stream-accent)" stopOpacity=".38"/>
          <stop offset="74%" stopColor="var(--hero-stream-main)"/>
          <stop offset="100%" stopColor="var(--hero-stream-accent)" stopOpacity=".55"/>
        </linearGradient>
      </defs>
      <g fill="none" stroke={gradient}>
        {streamRays.map((path, index) => <path key={path} id={id+'-ray-'+index} d={path} vectorEffect="non-scaling-stroke"/>) }
        {[3, 6, 9].map(index => <path key={index} d={streamRays[index]} strokeWidth="11" opacity=".13" vectorEffect="non-scaling-stroke"/>) }
      </g>
      <g className="hero-stream__glyphs" fill={gradient}>
        {glyphTracks.map(index => <text key={index} dy={index%2 ? 14 : -5}>
          <textPath href={`#${id}-ray-${index}`} startOffset={index%2 ? '8%' : '4%'}>{glyphs}</textPath>
        </text>)}
      </g>
    </svg>
    <span className="hero-stream__signal"/>
  </div>;
}

export function LandingHero({signedIn = false}: {signedIn?: boolean}) {
  const {t} = useUi();
  const image = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    if (image.current?.complete) setStatus(image.current.naturalWidth ? 'ready' : 'fallback');
  }, []);

  return (
    <section className="hero hero--intro">
      <HeroStream/>
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
            <div className="media-skeleton" style={mediaMask} data-skeleton-level="media" aria-hidden="true">
              <ShaderLayer effect="skeleton" duration={1400}/>
            </div>
          )}
          {status === 'ready' && (
            <div className="media-reveal-layer" style={mediaMask} aria-hidden="true">
              <ShaderLayer effect="reveal" duration={690}/>
            </div>
          )}
          {status === 'fallback' && <div className="reveal-media__fallback"><Scene/></div>}
        </div>
      </div>
    </section>
  );
}
