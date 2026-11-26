import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {ArrowRight, ArrowUpRight, Bookmark, Compass, Grid2X2, History as HistoryIcon, Moon, Plus, Search, Settings2, Sun} from 'lucide-react';
import * as m from 'motion/react-m';
import {getCatalog, type Assistant} from '../../src/catalog';
import {activeAccount, rememberAccount, signOut, type AuthMode, type Identity} from './accounts';
import {AuthDialog, guestCopy} from './AuthDialog';
import {demoReply, loadState, mergeGuest, persistState, pruneGuest, readRoute, titleFor, type Attachment, type Chat, type Message, type State} from './model';
import {Agents, ChatView, History, Saved, SearchResults} from './screens';
import {AgentCard, Brand, Composer, Empty, Hero, LocaleContext, Modal, QuickStart} from './ui';

type Draft = {text: string; file?: Attachment; assistantId: string; chatId?: string; draftKey: string};
const night = matchMedia('(prefers-color-scheme: dark)');
const menu = [
  {kind: 'home', href: '#/', Icon: Compass, ru: 'Обзор', en: 'Explore'},
  {kind: 'agents', href: '#/agents', Icon: Grid2X2, ru: 'Помощники', en: 'Assistants'},
  {kind: 'history', href: '#/history', Icon: HistoryIcon, ru: 'История', en: 'History'},
  {kind: 'saved', href: '#/saved', Icon: Bookmark, ru: 'Сохранённое', en: 'Saved'},
] as const;
const featured = ['budget', 'writer', 'english'];

function useRoute() {
  const [route, setRoute] = useState(() => readRoute());
  useEffect(() => {
    const change = () => {setRoute(readRoute()); window.scrollTo(0, 0);};
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}

export function applyPreferences(state: State) {
  const palette = state.theme === 'system' ? night.matches ? 'dark' : 'light' : state.theme;
  document.documentElement.dataset.theme = palette;
  document.documentElement.lang = state.locale;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette === 'dark' ? '#17131f' : '#f7f5fb');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', 'only ' + palette);
}

export default function App({initialState, initialAccount}: {initialState: State; initialAccount?: Identity}) {
  const route = useRoute();
  const [identity, setIdentity] = useState(initialAccount);
  const [state, setState] = useState(initialState);
  const [persisted, setPersisted] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState('agentik');
  const [guestNotice, setGuestNotice] = useState(false);
  const [guestAccepted, setGuestAccepted] = useState(false);
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [pending, setPending] = useState<Draft>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [systemDark, setSystemDark] = useState(night.matches);
  const input = useRef<HTMLTextAreaElement>(null);
  const t = (ru: string, en: string) => state.locale === 'ru' ? ru : en;
  const agents = useMemo(() => getCatalog(state.locale), [state.locale]);
  const general: Assistant = {
    id: 'agentik', name: 'Agentik', icon: 'Sparkles', color: 'lavender', kind: 'assistant', category: 'Все', instruction: '',
    description: t('Идеи, тексты и задачи на каждый день.', 'Ideas, writing and everyday tasks.'),
    prompts: [
      t('Помоги разложить задачу по шагам', 'Help me break a task into steps'),
      t('Давай придумаем идею для проекта', 'Let’s brainstorm a project idea'),
      t('Помоги начать текст', 'Help me start writing'),
    ],
  };
  const choices = [general, ...agents];
  const current = route.kind === 'chat' ? state.chats.find(chat => chat.id === route.id) : undefined;
  const activeId = route.kind === 'assistant' ? route.id : current?.assistantId ?? selection;
  const agent = choices.find(item => item.id === activeId) ?? general;
  const missing = route.kind === 'missing' || (route.kind === 'chat' && !current) || (route.kind === 'assistant' && agent.id !== route.id);
  const thread = !missing && ['new', 'chat', 'assistant'].includes(route.kind);
  const home = route.kind === 'home';
  const routeKey = 'id' in route ? `${route.kind}/${route.id}` : route.kind;
  const draftKey = 'id' in route ? routeKey : 'new';
  const draft = drafts[draftKey] ?? '';
  const title = menu.find(item => item.kind === route.kind);

  useEffect(() => {
    setPersisted(persistState(state, identity?.id));
  }, [state, identity?.id]);
  useEffect(() => {
    const update = () => {applyPreferences(state); setSystemDark(night.matches);};
    update();
    if (state.theme !== 'system') return;
    night.addEventListener('change', update);
    return () => night.removeEventListener('change', update);
  }, [state.theme, state.locale]);
  useEffect(() => {
    function setNetwork() {setOnline(navigator.onLine);}
    window.addEventListener('online', setNetwork);
    window.addEventListener('offline', setNetwork);
    return () => {window.removeEventListener('online', setNetwork); window.removeEventListener('offline', setNetwork);};
  }, []);
  useEffect(() => {
    if (identity) return;
    const purge = () => setState(previous => pruneGuest(previous));
    const timer = window.setInterval(purge, 60_000);
    document.addEventListener('visibilitychange', purge);
    return () => {window.clearInterval(timer); document.removeEventListener('visibilitychange', purge);};
  }, [identity]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k' || auth || settingsOpen) return;
      event.preventDefault();
      setSearchOpen(open => !open);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [auth, settingsOpen]);

  function saveDraft(key: string, text: string) {
    setDrafts(previous => {
      if (text) return {...previous, [key]: text};
      const next = {...previous};
      delete next[key];
      return next;
    });
  }
  function choosePrompt(prompt: string, id?: string) {
    if (id) setSelection(id);
    saveDraft(draftKey, prompt);
    input.current?.focus();
  }
  function changeDraft(text: string) {
    saveDraft(draftKey, text);
    if (!identity && !guestAccepted && !state.chats.length && text.trim()) setGuestNotice(true);
  }
  function toggleFavorite(id: string) {
    setState(previous => ({...previous, favorites: previous.favorites.includes(id)
      ? previous.favorites.filter(item => item !== id) : [...previous.favorites, id]}));
  }
  function toggleNote(message: Message) {
    if (!current) return;
    setState(previous => ({...previous, notes: previous.notes.some(note => note.id === message.id)
      ? previous.notes.filter(note => note.id !== message.id)
      : [{id: message.id, chatId: current.id, title: message.text.split('\n\n')[0], text: message.text.split('\n\n').slice(1).join('\n\n')}, ...previous.notes]}));
  }
  function deliver(request: Draft, locale = state.locale) {
    const now = Date.now();
    const id = request.chatId ?? crypto.randomUUID();
    const messages: Message[] = [
      {id: crypto.randomUUID(), role: 'user', text: request.text, at: now, ...(request.file ? {attachment: request.file} : {})},
      {id: crypto.randomUUID(), role: 'assistant', text: demoReply(request.assistantId, request.text, locale, request.file), at: now + 450},
    ];
    setState(previous => {
      const existing = previous.chats.find(chat => chat.id === id);
      const chat: Chat = {
        id, assistantId: request.assistantId, title: existing?.title ?? titleFor(request.text, request.file),
        messages: [...(existing?.messages ?? []), ...messages], updatedAt: now,
      };
      return {...previous, chats: [chat, ...previous.chats.filter(item => item.id !== id)]};
    });
    saveDraft(request.draftKey, '');
    if (!request.chatId) location.hash = `/chat/${id}`;
  }
  function send(text: string, file?: Attachment) {
    const request = {text, file, assistantId: agent.id, chatId: current?.id, draftKey};
    if (!identity && !guestAccepted && !state.chats.length) {
      setGuestNotice(true);
      setPending(request);
      setAuth('choose');
      return false;
    }
    deliver(request);
    return true;
  }
  function closeAuth(mode: AuthMode | null) {
    setAuth(mode);
    if (mode === null) setPending(undefined);
  }
  function continueGuest() {
    setGuestAccepted(true);
    if (pending) deliver(pending);
    closeAuth(null);
  }
  function enter(account: Identity) {
    const guest = pruneGuest(state);
    const accountState = loadState(account.id);
    const next = mergeGuest(auth === 'create' ? guest : accountState, guest);
    if (!persistState(next, account.id)) throw new Error('storage');
    rememberAccount(account);
    persistState({...guest, chats: [], notes: [], favorites: []});
    setIdentity(account);
    setState(next);
    if (pending) deliver(pending, next.locale);
    closeAuth(null);
  }
  function leave() {
    try {signOut();}
    catch {setPersisted(false); return;}
    setIdentity(undefined);
    setState(loadState());
    setGuestNotice(false);
    setGuestAccepted(false);
    setSettingsOpen(false);
    setDrafts({});
    location.hash = '/';
  }
  const notice = !identity && !guestAccepted && !state.chats.length && guestNotice && <div className="guest-note">
    <Bookmark size={19} aria-hidden="true"/>
    <p role="status">{t(...guestCopy)}</p>
    <button className="button button--primary" type="button" onClick={() => setAuth('create')}>{t('Создать аккаунт', 'Create account')}<ArrowRight size={16}/></button>
  </div>;

  let screen: ReactNode;
  if (home) {
    screen = <div className="page dashboard">
      <Hero/>
      <div className="first-composer">
        <Composer draft={draft} onDraft={changeDraft} onSend={send} agent={agent} agents={choices} onAgent={setSelection} input={input} floating/>
        {notice}
      </div>
      <QuickStart onChoose={(id, prompt) => choosePrompt(prompt, id)}/>
      <section className="stack dashboard__agents">
        <div className="section-row"><h2>{t('Помощники', 'Assistants')}</h2><a className="button button--link" href="#/agents">{t('Все помощники', 'All assistants')}<ArrowRight size={18}/></a></div>
        <div className="agent-grid">{featured.map(id => agents.find(item => item.id === id)).filter(item => item !== undefined).map(item =>
          <AgentCard key={item.id} agent={item} favorite={state.favorites.includes(item.id)} onFavorite={toggleFavorite}/>)}</div>
      </section>
    </div>;
  } else if (route.kind === 'agents') screen = <Agents agents={agents} locale={state.locale} favorites={state.favorites} onFavorite={toggleFavorite}/>;
  else if (route.kind === 'history') screen = <History chats={state.chats} agents={choices} locale={state.locale}/>;
  else if (route.kind === 'saved') screen = <Saved agents={choices} state={state} onFavorite={toggleFavorite}
    onRemove={id => setState(previous => ({...previous, notes: previous.notes.filter(note => note.id !== id)}))}/>;
  else if (thread) screen = <ChatView chat={current} agent={agent} agents={choices} draft={draft} onDraft={changeDraft} onSend={send}
    input={input} onChoose={choosePrompt} onAgent={route.kind === 'new' ? setSelection : undefined}
    favorite={state.favorites.includes(agent.id)} onFavorite={toggleFavorite} notes={state.notes.map(note => note.id)} onSave={toggleNote} notice={notice}/>;
  else screen = <div className="page">
    <Empty title={t('Эта страница недоступна', 'This page is unavailable')}
      description={t('Возможно, чат истёк или хранится в другом браузере.', 'The chat may have expired or be saved in another browser.')}
      action={{href: '#/', label: t('Вернуться к обзору', 'Back to Explore')}}/>
  </div>;

  const dark = state.theme === 'system' ? systemDark : state.theme === 'dark';
  const ThemeIcon = dark ? Sun : Moon;
  const themeLabel = dark ? t('Светлая тема', 'Light theme') : t('Тёмная тема', 'Dark theme');
  const newLabel = t('Новый чат', 'New chat');
  const displayName = identity?.name ?? t('Гость', 'Guest');
  const nav = (isMobile: boolean) => menu.map(({Icon, kind, href, ru, en}) => <a key={kind} href={href}
    aria-current={route.kind === kind ? 'page' : undefined}
    className={`nav__item${isMobile ? ` nav__item--${kind}` : ''}`}>
    <Icon size={isMobile ? 21 : 19}/><span>{t(ru, en)}</span>
  </a>);
  return <LocaleContext.Provider value={state.locale}>
    <div className={`studio${thread ? ' studio--thread' : ''}`}>
      <a className="skip-link" href="#main" onClick={event => {event.preventDefault(); document.getElementById('main')?.focus();}}>
        {t('К содержимому', 'Skip to content')}
      </a>
      <aside className="sidebar">
        <Brand/>
        <a className="button button--primary sidebar__new" href="#/new" aria-label={newLabel}><Plus size={21}/>{newLabel}<ArrowUpRight size={17}/></a>
        <nav className="nav" aria-label={t('Главная навигация', 'Main navigation')}>{nav(false)}</nav>
        {!!state.chats.length && <div className="recent">
          <h2>{t('Недавние', 'Recent')}</h2>
          {state.chats.slice(0, 5).map(item => <a href={`#/chat/${item.id}`} key={item.id} aria-current={current?.id === item.id ? 'page' : undefined}>{item.title}</a>)}
        </div>}
        <button className="sidebar__profile" type="button" onClick={() => setSettingsOpen(true)}>
          <span className="profile-mark" aria-hidden="true">{displayName[0].toLocaleUpperCase(state.locale)}</span>
          <span className="sidebar__profile-copy"><strong>{displayName}</strong><small>{t('Настройки', 'Settings')}</small></span><Settings2 size={17}/>
        </button>
      </aside>
      <div className="studio__body">
        <header className="topbar">
          <div className="topbar__brand"><Brand small/></div>
          <div className="topbar__title">{title ? t(title.ru, title.en) : t('Чат', 'Chat')}</div>
          <div className="topbar__actions">
            <button className="topbar__search" type="button" aria-label={t('Поиск', 'Search')} onClick={() => {setQuery(''); setSearchOpen(true);}}>
              <Search size={19}/><span>{t('Поиск', 'Search')}</span><kbd>Ctrl K</kbd>
            </button>
            <button className="icon-button theme-button" type="button" aria-label={themeLabel} title={themeLabel}
              onClick={() => setState(previous => ({...previous, theme: dark ? 'light' : 'dark'}))}><ThemeIcon size={20}/></button>
            <button type="button" className="profile-mark profile-mark--button" aria-label={t('Настройки', 'Settings')} onClick={() => setSettingsOpen(true)}>
              {displayName[0].toLocaleUpperCase(state.locale)}
            </button>
          </div>
        </header>
        <main tabIndex={-1} id="main" className={`content${thread ? ' content--thread' : ''}`}>
          {!persisted && <p className="storage-note" role="status">{t('Хранилище браузера недоступно. Изменения сохранятся до закрытия страницы.', 'Browser storage is unavailable. Changes will last until this page closes.')}</p>}
          <m.div key={routeKey} className="route-screen"
            initial={home ? false : {opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} transition={{duration: .17}}>
            {screen}
          </m.div>
          {!thread && <footer className="footer"><span><i/>{online ? t('Демо · локальные ответы', 'Demo · local replies') : t('Демо · офлайн', 'Demo · offline')}</span>
            <span>© Sergey Buharev</span></footer>}
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t('Нижняя навигация', 'Bottom navigation')}>
        {nav(true)}<a href="#/new" className="bottom-nav__new" aria-label={newLabel}><Plus size={27}/></a>
      </nav>
    </div>
    <Modal open={searchOpen} onOpenChange={setSearchOpen} title={t('Поиск', 'Search')} extra="dialog--search">
      <label className="search-field search-field--dialog"><Search size={21}/><input autoFocus type="search" value={query}
        onChange={event => setQuery(event.target.value)} aria-label={t('Поиск помощников и чатов', 'Search assistants and chats')}
        placeholder={t('Найти помощника или чат…', 'Find an assistant or chat…')}/></label>
      <SearchResults agents={agents} chats={state.chats} query={query} onChoose={() => setSearchOpen(false)}/>
    </Modal>
    <Modal open={settingsOpen} onOpenChange={setSettingsOpen} title={t('Настройки', 'Settings')} extra="dialog--settings">
      <div className="settings">
        <div className="settings__user"><span className="profile-mark" aria-hidden="true">{displayName[0].toLocaleUpperCase(state.locale)}</span>
          <div><strong>{displayName}</strong><p>{identity?.email ?? t('Гостевой режим B-demo', 'B-demo guest mode')}</p></div>
        </div>
        <div className="settings__block"><h3>{t('Тема', 'Appearance')}</h3>
          <div className="segmented" role="group" aria-label={t('Цветовая тема', 'Color theme')}>
            {(['system', 'light', 'dark'] as const).map(item => <button type="button" aria-pressed={state.theme === item} key={item}
              onClick={() => setState(previous => ({...previous, theme: item}))}>
              {item === 'system' ? t('Системная', 'System') : item === 'light' ? t('Светлая', 'Light') : t('Тёмная', 'Dark')}
            </button>)}
          </div>
        </div>
        <div className="settings__block"><h3>{t('Язык', 'Language')}</h3><div className="segmented" role="group" aria-label={t('Язык', 'Language')}>
          <button type="button" lang="ru" aria-pressed={state.locale === 'ru'} onClick={() => setState(previous => ({...previous, locale: 'ru'}))}>Русский</button>
          <button type="button" lang="en" aria-pressed={state.locale === 'en'} onClick={() => setState(previous => ({...previous, locale: 'en'}))}>English</button>
        </div></div>
        {identity ? <button type="button" className="button button--secondary" onClick={leave}>{t('Выйти', 'Sign out')}</button>
          : <button type="button" className="button button--secondary" onClick={() => {setSettingsOpen(false); setAuth('choose');}}>{t('Аккаунт', 'Account')}<ArrowRight size={17}/></button>}
      </div>
    </Modal>
    <AuthDialog mode={auth} onMode={closeAuth} onContinue={pending ? continueGuest : undefined} onSuccess={enter}/>
  </LocaleContext.Provider>;
}

export function initialPreferences() {
  const identity = activeAccount();
  const state = loadState(identity?.id);
  applyPreferences(state);
  return {initialAccount: identity, initialState: state};
}
