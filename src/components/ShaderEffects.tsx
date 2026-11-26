import {useUi} from '../language';
import {useEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';
import type {Point, ShaderEffect} from '../motion/shader';

export function allowsMotion() {
  return typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ShaderLayer({effect, duration, origin, text, image}: {
  effect: ShaderEffect;
  duration: number;
  origin?: Point;
  text?: RefObject<HTMLElement | null>;
  image?: RefObject<HTMLImageElement | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !allowsMotion() || document.hidden || typeof WebGLRenderingContext === 'undefined') return;
    let cleanup: (() => void) | undefined;
    let active = true;
    let observer: IntersectionObserver | undefined;

    function start(target: HTMLCanvasElement) {
      void import('../motion/shader').then(({playShader}) => {
        if (active && allowsMotion()) cleanup = playShader(target, {effect, duration, origin, text: text?.current, image: image?.current});
      }).catch(() => { /* The DOM and CSS fallbacks remain visible. */ });
    }

    if (effect === 'reveal' && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer?.disconnect();
        if (active) start(node);
      });
      observer.observe(node);
    } else start(node);

    return () => { active = false; observer?.disconnect(); cleanup?.(); };
  }, [effect, duration, origin, text, image]);

  return <canvas className={`shader-layer shader-layer--${effect}`} data-effect={effect} width={1} height={1} ref={canvas} aria-hidden="true"/>;
}

const inMemory = new Set<string>();
export function takeFirstMoment(profileId: string, name: 'send') {
  const key = `agentik:motion:${profileId}:${name}`;
  if (inMemory.has(key)) return false;
  inMemory.add(key);
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch { /* Play once in this page if storage is unavailable. */ }
  return true;
}

export function WelcomeTitle({text}: {text?:string} = {}) {
  const {t} = useUi();
  const heading = useRef<HTMLHeadingElement>(null);
  const [play] = useState(allowsMotion);
  return (
    <h2 ref={heading} className={`chat-welcome__title${play ? ' chat-welcome__title--glint' : ''}`}>
      <span className="chat-welcome__words">{text ?? t('Привет! С чем помочь?','Hello! How can I help?')}</span>
      {play && <ShaderLayer effect="welcome" duration={1120} text={heading}/>}
    </h2>
  );
}

export function SendPulse({point, onEnd}: {point: Point; onEnd: () => void}) {
  useEffect(() => {
    const timer = setTimeout(onEnd, 1000);
    return () => clearTimeout(timer);
  }, [onEnd]);
  return (
    <div className="send-pulse" aria-hidden="true" style={{'--pulse-x': `${point.x}px`, '--pulse-y': `${point.y}px`} as CSSProperties}>
      <div className="send-pulse__field">
        <div className="send-pulse__fallback"><span className="send-pulse__glow"/></div>
        <ShaderLayer effect="pulse" duration={860} origin={point}/>
      </div>
    </div>
  );
}
