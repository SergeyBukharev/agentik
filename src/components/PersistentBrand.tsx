import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {LayoutGrid, Palette, FileText} from 'lucide-react';
import {useUi} from '../language';
import {kitPages, kitPaths} from '../kits';
import {allowsMotion} from './ShaderEffects';
import {AgentikMark} from './AgentikMark';

export type BrandLock = 'closed' | 'open';
const kitIcons = {'ui-kit': LayoutGrid, 'brand-kit': Palette, 'press-kit': FileText};

export function PersistentBrand({href, route, onAccess, lock}: {
  href: string;
  route: string;
  onAccess: boolean;
  lock?: BrandLock;
}) {
  const {t} = useUi();
  const mark = useRef<SVGSVGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const anchor = useRef<HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const previousRoute = useRef(route);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => () => animation.current?.cancel(), []);

  useEffect(() => {
    if (previousRoute.current === route) return;
    previousRoute.current = route;
    if (!allowsMotion() || !eyes.current?.animate) return;
    const blink = eyes.current.animate([
      {transform:'scaleY(1)'},
      {transform:'scaleY(.14)', offset:.44},
      {transform:'scaleY(.14)', offset:.52},
      {transform:'scaleY(1)'},
    ], {duration:270, easing:'ease-in-out'});
    return () => blink.cancel();
  }, [route]);

  function playSpring() {
    animation.current?.cancel();
    animation.current = null;
    if (!allowsMotion() || !mark.current?.animate) return;
    animation.current = mark.current.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(.90) rotate(-6deg)', offset:.36},
      {transform:'scale(1.035) rotate(2deg)', offset:.76},
      {transform:'scale(1) rotate(0deg)'},
    ], {duration:340,easing:'cubic-bezier(.22,.68,.28,1)'});
  }

  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector('a')?.focus({preventScroll:true});
    const closeOutside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !menu.current?.contains(target) && !anchor.current?.contains(target)) setMenuOpen(false);
    };
    const close = () => setMenuOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('hashchange', close);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('hashchange', close);
    };
  }, [menuOpen]);

  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const links = Array.from(event.currentTarget.querySelectorAll('a'));
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setMenuOpen(false);
      anchor.current?.focus({preventScroll:true});
      return;
    }
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % links.length
      : event.key === 'ArrowUp' ? (current - 1 + links.length) % links.length : -1;
    if (next < 0) return;
    event.preventDefault();
    links[next]?.focus({preventScroll:true});
  }

  return (
    <>
    <div className="persistent-brand-bar">
    <a className="persistent-brand" href={href} data-tone={onAccess ? 'access' : 'default'} ref={anchor}
      aria-label={t('Agentik — главная', 'Agentik home')} aria-haspopup="menu" aria-expanded={menuOpen}
      aria-keyshortcuts="Shift+F10" onClick={event => {
        setMenuOpen(false);
        if (event.button === 0) playSpring();
      }}
      onContextMenu={event => {event.preventDefault(); setMenuOpen(true);}}
      onKeyDown={event => {
        if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
        event.preventDefault();
        setMenuOpen(true);
      }}>
      <svg ref={mark} className="persistent-brand__mark" viewBox="0 0 48 48"
        width="35" height="35" aria-hidden="true" focusable="false">
        <AgentikMark eyesClassName="persistent-brand__eyes" eyesRef={eyes}/>
      </svg>
      <span className="persistent-brand__word">agentik</span>
    </a>
    {lock && (
      <span className="persistent-brand__access" role="img" aria-label={t('Страница входа','Sign-in page')} aria-current="page">
        <svg className="persistent-brand__lock" data-lock={lock} viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path className="persistent-brand__shackle" d="M8.25 12V8a3.75 3.75 0 1 1 7.5 0v4"/>
          <rect x="5.5" y="12" width="13" height="8.5" rx="2.2"/>
          <path d="M12 15.6v1.45"/>
        </svg>
      </span>
    )}
    </div>
    {menuOpen && <div className="persistent-brand-menu" role="menu" aria-label={t('Материалы Agentik','Agentik kits')}
      ref={menu} onKeyDown={menuKeys}>
      {kitPaths.map(kit => {
        const Icon = kitIcons[kit];
        return <a key={kit} href={import.meta.env.BASE_URL + '#/' + kit} role="menuitem" tabIndex={-1} onClick={() => setMenuOpen(false)}>
          <Icon size={17} aria-hidden="true"/>{t(...kitPages[kit])}
        </a>;
      })}
    </div>}
    </>
  );
}
