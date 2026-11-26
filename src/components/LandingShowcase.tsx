import {MessageCircle} from 'lucide-react';
import {catalog} from '../catalog';
import {AgentIcon} from './Brand';
import {ShaderLayer} from './ShaderEffects';
import {useUi} from '../language';
import {prefetchScreen} from '../prefetch';

export default function LandingShowcase() {
  const {t} = useUi();
  return (
    <section className="landing-showcase" aria-label={t('Помощники', 'Assistants')}>
      <h2 className="section-title section-title--secondary">{t('Начните со знакомой задачи', 'Start with a familiar task')}</h2>
      <div className="agent-grid landing-showcase__cards">
        {catalog.slice(0, 3).map(assistant => (
          <article className="agent-card" key={assistant.id}>
            <div className="agent-card__top">
              <span className={`avatar avatar--${assistant.color}`}><AgentIcon name={assistant.icon}/></span>
            </div>
            <a href={`#/assistant/${assistant.id}`} className="agent-card__link" onFocus={()=>prefetchScreen('login')} onPointerEnter={()=>prefetchScreen('login')}>
              <h3 className="agent-card__title">{assistant.name}</h3>
              <p className="agent-card__description">{assistant.description}</p>
              <span className="agent-card__footer"><span>{assistant.category}</span><MessageCircle size={17}/></span>
            </a>
          </article>
        ))}
        <ShaderLayer effect="reveal" duration={560}/>
      </div>
    </section>
  );
}
