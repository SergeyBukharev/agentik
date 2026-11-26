import {MessageCircle} from 'lucide-react';
import {catalog} from '../catalog';
import {AgentIcon} from './Brand';
import {ShaderLayer} from './ShaderEffects';
import {useUi} from '../language';
import {prefetchScreen} from '../prefetch';

const showcaseEnglish: Record<string, {name: string; description: string; category: string}> = {
  budget: {name: 'Family finance assistant', description: 'See what you have left to spend, what bills are due, and where your money went.', category: 'Life'},
  writer: {name: 'Editor', description: 'Turn your thoughts into something people want to read.', category: 'Work'},
  career: {name: 'Career guide', description: 'Get help with résumés, interviews, and your next career move.', category: 'Work'},
};

export default function LandingShowcase() {
  const {language, t} = useUi();
  return (
    <section className="landing-showcase" aria-label={t('Помощники', 'Assistants')}>
      <h2 className="section-title section-title--secondary">{t('Начните со знакомой задачи', 'Start with a familiar task')}</h2>
      <div className="agent-grid landing-showcase__cards">
        {catalog.slice(0, 3).map(assistant => {
          const {name, description, category} = (language === 'en' && showcaseEnglish[assistant.id]) || assistant;
          return (
            <article className="agent-card" key={assistant.id}>
              <div className="agent-card__top">
                <span className={`avatar avatar--${assistant.color}`} data-category={assistant.category}><AgentIcon name={assistant.icon}/></span>
              </div>
              <a href={`#/assistant/${assistant.id}`} className="agent-card__link" onFocus={()=>prefetchScreen('login')} onPointerEnter={()=>prefetchScreen('login')}>
                <h3 className="agent-card__title">{name}</h3>
                <p className="agent-card__description">{description}</p>
                <span className="agent-card__footer"><span>{category}</span><MessageCircle size={17} aria-hidden="true"/></span>
              </a>
            </article>
          );
        })}
        <ShaderLayer effect="reveal" duration={560}/>
      </div>
    </section>
  );
}
