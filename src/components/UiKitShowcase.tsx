import {useState, type ReactNode} from 'react';
import {Check, ChevronRight, Plus, WifiOff} from 'lucide-react';
import {catalog} from '../catalog';
import {type ChatImage, type ChatModel} from '../chat-media';
import {useUi} from '../language';
import {AgentSelect} from './AgentSelect';
import {AgentIcon} from './Brand';
import {CategoryIcon} from './CategoryIcon';
import {ChatComposer, MessageImages} from './ChatComposer';
import {ChatSuggestions} from './ChatSuggestions';
import {FavoriteButton} from './FavoriteButton';
import {Modal} from './Modal';
import {ProButton} from './ProButton';
import {ScreenSkeleton} from './ScreenSkeleton';

function Example({title, children}: {title:string; children:ReactNode}) {
  return <section className="kit-example"><h3>{title}</h3><div className="kit-example__body">{children}</div></section>;
}

export function UiKitShowcase() {
  const {language, setLanguage, t} = useUi();
  const [dialog, setDialog] = useState<'dialog' | 'pro' | 'group'>();
  const [category, setCategory] = useState('Все');
  const [entry, setEntry] = useState('');
  const [tried, setTried] = useState(false);
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [favorited, setFavorited] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const [chat, setChat] = useState(false);
  const entryError = tried && !entry.trim();

  return <>
    <section className="kit-section" aria-labelledby="kit-controls">
      <h2 id="kit-controls">{t('Действия и ввод','Actions and inputs')}</h2>
      <div className="kit-grid">
        <Example title={t('Кнопки и диалоги','Buttons and dialogs')}>
          <div className="kit-actions">
            <button type="button" className="button button--primary" onClick={() => setDialog('dialog')}>{t('Открыть диалог','Open dialog')}</button>
            <button type="button" className="button button--secondary" onClick={() => setDialog('group')}><Plus size={16} aria-hidden="true"/>{t('Новый чат','New chat')}</button>
            <button type="button" className="button button--secondary" disabled>{t('Недоступно','Disabled')}</button>
            <ProButton label={t('Купить PRO','Get PRO')} onClick={() => setDialog('pro')}/>
          </div>
        </Example>
        <Example title={t('Поля и меню выбора','Fields and selection menus')}>
          <form className="form" noValidate onSubmit={event => {event.preventDefault(); setTried(true);}}>
            <label className="form__label" htmlFor="kit-name-input">{t('Имя помощника','Assistant name')}</label>
            <input id="kit-name-input" className="form__input" value={entry} onChange={event => setEntry(event.target.value)} required
              aria-invalid={entryError || undefined} aria-describedby={entryError ? 'kit-name-error' : undefined}/>
            {entryError && <p className="notice notice--error" id="kit-name-error" role="alert">{t('Введите имя помощника.','Enter an assistant name.')}</p>}
            {tried && !entryError && <p className="kit-status" role="status"><Check size={16} aria-hidden="true"/>{t('Имя принято.','Name accepted.')}</p>}
            <button type="submit" className="button button--secondary">{t('Проверить поле','Validate field')}</button>
          </form>
          <div className="form kit-mode">
            <label className="form__label" htmlFor="kit-response-mode">{t('Режим ответов','Reply mode')}</label>
            <AgentSelect id="kit-response-mode" value={mode} label={t('Режим ответов','Reply mode')} onChange={setMode} fullWidth
              options={[{value:'demo', label:t('Деморежим','Demo mode')}, {value:'live', label:t('Подключённая модель','Connected model')}]}/>
          </div>
        </Example>
      </div>
    </section>
    <section className="kit-section" aria-labelledby="kit-navigation">
      <h2 id="kit-navigation">{t('Навигация и выбор','Navigation and selection')}</h2>
      <div className="kit-grid">
        <Example title={t('Фильтры и переключатели','Filters and toggles')}>
          <div className="kit-chips" role="group" aria-label={t('Категории','Categories')}>
            {[['Все', 'All'], ['Работа', 'Work'], ['Учёба', 'Study']].map(([value, en]) => (
              <button key={value} className={`category-list__item${category === value ? ' category-list__item--active' : ''}`}
                type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>
                <CategoryIcon category={value}/>{t(value, en)}
              </button>
            ))}
          </div>
          <div className="language-choice" role="group" aria-label={t('Язык интерфейса','Interface language')}>
            <button type="button" aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>RU</button>
            <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>ENG</button>
          </div>
        </Example>
        <Example title={t('Карточка и история','Card and history')}>
          <article className="agent-card kit-card">
            <div className="agent-card__top"><span className="avatar avatar--lime" data-category="Работа"><AgentIcon name="PenLine"/></span>
              <FavoriteButton pressed={favorited} label={t('Избранное','Favorite')} onToggle={() => setFavorited(current => !current)}/>
            </div>
            <div className="agent-card__link"><p className="agent-card__title">{t('Редактор','Editor')}</p></div>
          </article>
          <button type="button" className="history-item kit-room" onClick={() => setDialog('group')}><span className="avatar avatar--lime"><AgentIcon name="Users"/></span>
            <span className="history-item__text"><strong>{t('План недели','Weekly plan')}</strong><span>{t('Групповой чат · 2 участника','Group chat · 2 members')}</span></span>
            <ChevronRight size={18} aria-hidden="true"/>
          </button>
        </Example>
      </div>
    </section>
    <section className="kit-section" aria-labelledby="kit-chat">
      <h2 id="kit-chat">{t('Чат и подсказки','Chat and suggestions')}</h2>
      <div className="kit-example">
        {!chat ? <button type="button" className="button button--secondary" onClick={() => setChat(true)}>{t('Открыть пример чата','Open chat example')}</button> : <ComposerDemo/>}
      </div>
    </section>
    <section className="kit-section" aria-labelledby="kit-feedback">
      <h2 id="kit-feedback">{t('Статусы и состояния','Status and feedback')}</h2>
      <div className="kit-grid">
        <Example title={t('Уведомления','Notices')}>
          <span className="mode-label">{t('Демо-версия','Demo mode')}</span>
          <div className="notice kit-status"><WifiOff size={16} aria-hidden="true"/>{t('Нет подключения','Offline')}</div>
          <p className="notice notice--error">{t('Ответ не загрузился. Повторите запрос.','Could not load the reply. Try again.')}</p>
        </Example>
        <Example title={t('Загрузка и пустой экран','Loading and empty screen')}>
          <button className="button button--secondary" type="button" aria-pressed={skeleton} onClick={() => setSkeleton(current => !current)}>
            {skeleton ? t('Показать пустой экран','Show empty screen') : t('Показать загрузку','Show loading')}
          </button>
          {skeleton ? <ScreenSkeleton compact/> : <p className="kit-copy">{t('Здесь появятся сохранённые разговоры.','Saved conversations will appear here.')}</p>}
        </Example>
      </div>
    </section>
    <aside className="kit-references" aria-label={t('Источники паттернов','Pattern references')}>
      <a className="text-link" href="https://design-system.service.gov.uk/components/">GOV.UK Design System</a>
      <a className="text-link" href="https://primer.style/product/getting-started/foundations/color-usage/">GitHub Primer</a>
      <a className="text-link" href="https://www.w3.org/WAI/ARIA/apg/patterns/menubar/">WAI-ARIA APG</a>
    </aside>
    {dialog && <Modal title={dialog === 'pro' ? 'Agentik PRO' : dialog === 'group' ? t('Пример группового чата','Group chat example') : t('Пример диалога','Dialog example')}
      description={dialog === 'group' ? t('План недели · 2 участника','Weekly plan · 2 members') : t('Это интерактивный образец компонента.','This is an interactive component example.')}
      onClose={() => setDialog(undefined)}>
      <button type="button" className="button button--secondary" onClick={() => setDialog(undefined)}>{t('Готово','Done')}</button>
    </Modal>}
  </>;
}

function ComposerDemo() {
  const {t} = useUi();
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState<ChatModel>('auto');
  const [sent, setSent] = useState<{text:string; images:ChatImage[]}>();

  return <div className="kit-chat-preview">
    {sent && <article className="message message--user" aria-live="polite"><span className="message__author">{t('Вы','You')}</span>
      {sent.text && <p className="message__body">{sent.text}</p>}<MessageImages images={sent.images}/>
    </article>}
    <ChatSuggestions assistant={catalog[0]} draft={draft} compact busy={false} onApply={setDraft}/>
    <ChatComposer messageId="kit-message" draft={draft} onDraft={setDraft} model={model} onModel={setModel} price={0}
      onSubmit={images => {setSent({text:draft, images}); setDraft(''); return true;}}/>
  </div>;
}
