import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './fonts.css';
import './viewport.css';
import './styles.css';
import './scrollbars.css';
import './access-motion.css';
import './composer.css';
import './persistent-brand.css';
import './theme-transition.css';
import './telegram.css';
import {UiLanguageProvider} from './language';
import App from './App';
import {ErrorBoundary} from './ErrorBoundary';
import {startPhoneViewport} from './phone-viewport';
import {getTelegramWebApp, readTelegramShareTarget, startTelegramShell, telegramWidgetUrl} from './telegram-shell';

const telegram = import.meta.env.VITE_TELEGRAM_MINI_APP === 'true' ? getTelegramWebApp() : undefined;
const shared = import.meta.env.VITE_TELEGRAM_MINI_APP === 'true'
  ? readTelegramShareTarget(location.search, location.hash, telegram?.initDataUnsafe?.start_param)
  : null;
if (shared) {
  location.replace(telegramWidgetUrl(location.href, shared));
} else {
  if (telegram && location.hash.startsWith('#tgWebApp')) history.replaceState(null, '', '#/');
  startPhoneViewport();
  createRoot(document.getElementById('root')!).render(<StrictMode><UiLanguageProvider><ErrorBoundary><App/></ErrorBoundary></UiLanguageProvider></StrictMode>);
  if (telegram) startTelegramShell();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      }).catch(() => {});
    });
  }
}
