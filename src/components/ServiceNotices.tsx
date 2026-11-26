import {useState} from 'react';
import {Bell, ChevronLeft, ChevronRight, Megaphone} from 'lucide-react';
import {useUi} from '../language';
import {Tooltip} from './Tooltip';
import './service-notices.css';

export type ServiceNotice = {id: string; kind: 'important' | 'promotion'; title: string; description: string; titleEn?: string; descriptionEn?: string};

export function readServiceNotices(raw: string | undefined): ServiceNotice[] {
  if (!raw) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return values.filter((entry): entry is ServiceNotice => !!entry && typeof entry.id === 'string' &&
      (entry.kind === 'important' || entry.kind === 'promotion') && typeof entry.title === 'string' && entry.title.trim() &&
      typeof entry.description === 'string' && entry.description.trim())
      .sort((a, b) => Number(b.kind === 'important') - Number(a.kind === 'important'));
  } catch {
    return [];
  }
}

export function ServiceNotices({items}: {items: ServiceNotice[]}) {
  const {language, t} = useUi();
  const [selected, setSelected] = useState(0);
  if (!items.length) return null;
  const index = selected % items.length;
  const item = items[index];
  const important = item.kind === 'important';
  const Icon = important ? Bell : Megaphone;
  return <section className="service-notices" aria-label={t('Объявления Agentik','Agentik announcements')}>
    <div className="service-notices__body" aria-live="polite">
      <span className={`avatar avatar--${important ? 'lavender' : 'blue'}`}><Icon size={19} aria-hidden="true"/></span>
      <div>
        <h2>{language === 'en' && typeof item.titleEn === 'string' ? item.titleEn : item.title}</h2>
        <p>{language === 'en' && typeof item.descriptionEn === 'string' ? item.descriptionEn : item.description}</p>
      </div>
    </div>
    {items.length > 1 && <div className="service-notices__controls">
      <Tooltip label={t('Предыдущее объявление','Previous announcement')}>
        <button type="button" className="icon-button" aria-label={t('Предыдущее объявление','Previous announcement')}
          onClick={() => setSelected((index - 1 + items.length) % items.length)}><ChevronLeft size={18} aria-hidden="true"/></button>
      </Tooltip>
      <span aria-hidden="true">{index + 1} / {items.length}</span>
      <Tooltip label={t('Следующее объявление','Next announcement')}>
        <button type="button" className="icon-button" aria-label={t('Следующее объявление','Next announcement')}
          onClick={() => setSelected((index + 1) % items.length)}><ChevronRight size={18} aria-hidden="true"/></button>
      </Tooltip>
    </div>}
  </section>;
}
