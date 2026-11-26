import {useEffect, useRef} from 'react';
import {useUi} from '../language';
import {allowsMotion} from './ShaderEffects';

export type BrandLock = 'closed' | 'open';

export function PersistentBrand({href, route, onAccess, lock}: {
  href: string;
  route: string;
  onAccess: boolean;
  lock?: BrandLock;
}) {
  const {t} = useUi();
  const mark = useRef<HTMLImageElement>(null);
  const previous = useRef(route);
  useEffect(() => {
    if (route === previous.current) return;
    previous.current = route;
    if (!allowsMotion() || !mark.current?.animate) return;
    const animation = mark.current.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(.90) rotate(-6deg)', offset:.36},
      {transform:'scale(1.035) rotate(2deg)', offset:.76},
      {transform:'scale(1) rotate(0deg)'},
    ], {duration:340,easing:'cubic-bezier(.22,.68,.28,1)'});
    return () => animation.cancel();
  }, [route]);

  return (
    <a className="persistent-brand" href={href} data-tone={onAccess ? 'access' : 'default'}
      aria-label={t('Agentik — главная', 'Agentik home')}>
      <img ref={mark} className="persistent-brand__mark" src={import.meta.env.BASE_URL+'favicon.svg'}
        alt="" width="35" height="35" draggable={false}/>
      <span className="persistent-brand__word">agentik<span>.</span></span>
      {lock && (
        <svg className="persistent-brand__lock" data-lock={lock} viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path className="persistent-brand__shackle" d="M8.25 12V8a3.75 3.75 0 1 1 7.5 0v4"/>
          <rect x="5.5" y="12" width="13" height="8.5" rx="2.2"/>
          <path d="M12 15.6v1.45"/>
        </svg>
      )}
    </a>
  );
}
