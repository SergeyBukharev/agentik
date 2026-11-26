import {useUi} from '../language';
import {lazy, Suspense} from 'react';
import {Moon, Sun} from 'lucide-react';
import {LandingHero} from './LandingHero';
import {ScreenSkeleton} from './ScreenSkeleton';
import {prefetchScreen} from '../prefetch';
import './public-landing.css';

const Showcase = lazy(() => import('./LandingShowcase'));

export function PublicLanding({dark, toggleTheme}: {dark: boolean; toggleTheme: () => void}) {
  const {language, setLanguage, t} = useUi();
  const themeLabel = dark ? t('Светлая тема', 'Light theme') : t('Тёмная тема', 'Dark theme');
  return (
    <main className="public-landing">
      <header className="public-landing__header">
        <div className="public-landing__actions">
          <a className="button button--secondary public-landing__sign-in" href="#/login" onFocus={() => prefetchScreen('login')}
            onPointerEnter={() => prefetchScreen('login')}>{t('Войти','Sign in')}</a>
          <div className="public-landing__preferences">
            <button type="button" className="icon-button public-landing__theme" aria-label={themeLabel} title={themeLabel} onClick={toggleTheme}>
              {dark ? <Sun size={19} aria-hidden="true"/> : <Moon size={19} aria-hidden="true"/>}
            </button>
            <div className="language-choice" role="group" aria-label={t('Язык интерфейса', 'Interface language')}>
              <button type="button" lang="ru" aria-label="RU — Русский" aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>RU</button>
              <button type="button" lang="en" aria-label="ENG — English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>ENG</button>
            </div>
          </div>
        </div>
      </header>
      <LandingHero/>
      <Suspense fallback={<ScreenSkeleton/>}><Showcase/></Suspense>
      <footer className="public-landing__footer">
        <a className="text-link" href="#/agreement">{t('Пользовательское соглашение','User agreement')}</a>
      </footer>
    </main>
  );
}
