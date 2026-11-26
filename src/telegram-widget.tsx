import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {TelegramChatWidget} from './components/TelegramChatWidget';
import {UiLanguageProvider} from './language';
import {getTelegramWebApp, readTelegramShareTarget, startTelegramShell} from './telegram-shell';
import './fonts.css';
import './styles.css';
import './telegram.css';

const app = getTelegramWebApp();
const id = readTelegramShareTarget(location.search, location.hash, app?.initDataUnsafe?.start_param);
document.documentElement.dataset.theme = app?.colorScheme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
createRoot(document.getElementById('root')!).render(<StrictMode><UiLanguageProvider>
  <TelegramChatWidget id={id ?? ''}/>
</UiLanguageProvider></StrictMode>);
startTelegramShell(true);
