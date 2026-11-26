import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {domAnimation, LazyMotion, MotionConfig} from 'motion/react';
import {getPhoneZoom, startPhoneViewport} from '../../src/phone-viewport';
import '../../src/fonts.css';
import '../../src/viewport.css';
import './styles.css';
import App, {initialPreferences} from './App';

startPhoneViewport();
const visualViewport = window.visualViewport;
if (visualViewport) {
  let frame = 0;
  const root = document.documentElement;
  let baseline = {width: innerWidth, height: innerHeight};
  const update = () => {
    const active = document.activeElement;
    const editing = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
    const wasKeyboard = root.hasAttribute('data-keyboard');
    if (baseline.width !== innerWidth || (!editing && !wasKeyboard)) baseline = {width: innerWidth, height: innerHeight};
    const zoom = getPhoneZoom();
    const height = Math.min(innerHeight, visualViewport.height) / zoom;
    const keyboard = (editing || wasKeyboard) && Math.abs(visualViewport.scale * zoom - 1) < .02
      && baseline.height / zoom - height > 88;
    root.toggleAttribute('data-keyboard', keyboard);
    if (keyboard) root.style.setProperty('--usable-height', `${height}px`);
    else root.style.removeProperty('--usable-height');
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  visualViewport.addEventListener('resize', schedule, {passive: true});
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
}

const initial = initialPreferences();
createRoot(document.getElementById('root')!).render(<StrictMode>
  <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict><App {...initial}/></LazyMotion></MotionConfig>
</StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).catch(() => {});
  });
}
