import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './fonts.css';
import './styles.css';
import './access-motion.css';
import './composer.css';
import './persistent-brand.css';
import {UiLanguageProvider} from './language';
import App from './App';
import {ErrorBoundary} from './ErrorBoundary';
createRoot(document.getElementById('root')!).render(<StrictMode><UiLanguageProvider><ErrorBoundary><App/></ErrorBoundary></UiLanguageProvider></StrictMode>);

if(import.meta.env.PROD&&'serviceWorker'in navigator){window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(()=>{});});}
