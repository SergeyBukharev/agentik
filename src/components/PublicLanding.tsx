import {useUi} from '../language';
import {lazy, Suspense} from 'react';
import {LandingHero} from './LandingHero';
import {ScreenSkeleton} from './ScreenSkeleton';
import {prefetchScreen} from '../prefetch';

const Showcase = lazy(() => import('./LandingShowcase'));

export function PublicLanding() {
  const {t} = useUi();
  return (
    <main className="public-landing">
      <header className="public-landing__header">
        <a className="button button--secondary" href="#/login" onFocus={() => prefetchScreen('login')}
          onPointerEnter={() => prefetchScreen('login')}>{t('Войти','Sign in')}</a>
      </header>
      <LandingHero/>
      <Suspense fallback={<ScreenSkeleton/>}><Showcase/></Suspense>
      <footer className="public-landing__footer">
        <a className="text-link" href="#/agreement">{t('Пользовательское соглашение','User agreement')}</a>
      </footer>
    </main>
  );
}
