import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {Coins, LayoutGrid, Smile, Star, History, Users, Plus, Search, Sun, Moon, X, SlidersHorizontal, MessageCircle, ChevronRight, ChevronDown, Check, House, UserRound, WifiOff, FolderOpen} from 'lucide-react';
import {catalog, categories, filterAssistants, type Assistant} from './catalog';
import type {Conversation} from './state';
import {readLocalRooms} from './local-rooms';
import {replyTo} from './services';
import {useProfileState} from './useProfileState';
import {useMessageBalance} from './useMessageBalance';
import {activeProfile, selectProfile, type LocalProfile} from './session';
import {loadPrivateChat, prefetchChat, prefetchScreen, schedulePrefetch} from './prefetch';
import {Scene} from './components/Scene';
import {AgentIcon} from './components/Brand';
import {PersistentBrand} from './components/PersistentBrand';
import {Modal} from './components/Modal';
import {PageState} from './components/PageState';
import {ScreenSkeleton} from './components/ScreenSkeleton';
import {useUi} from './language';
import {type ChatImage, type ChatModel} from './chat-media';
import {createChatDrafts, type ChatDraftAttachment} from './chat-drafts';
import {MAX_CHAT_MESSAGE_LENGTH} from './chat-contract';
import {ChatBoardTabs} from './components/ChatBoardTabs';
import {CategoryIcon} from './components/CategoryIcon';
import {FavoriteButton} from './components/FavoriteButton';
import {ProButton} from './components/ProButton';
import {Paywall} from './components/Paywall';
import {allowsMotion, SendPulse, takeFirstMoment} from './components/ShaderEffects';
import {LandingHero} from './components/LandingHero';
import {readServiceNotices, ServiceNotices} from './components/ServiceNotices';
import {PublicLanding} from './components/PublicLanding';
import type {AccessSession} from './access-contract';
import {accessPreviewHref} from './access-client';
import type {Point} from './motion/shader';
import {useAccess, useOnline} from './useAccess';
import {useRoute, type Route} from './routes';
import {useTheme} from './useTheme';
import {getTelegramWebApp} from './telegram-shell';

const Profile = lazy(() => import('./components/Profile').then(module => ({default: module.Profile})));
const Rooms = lazy(() => import('./components/Rooms').then(module => ({default: module.Rooms})));
const CodeGate = lazy(() => import('./components/CodeGate'));
const Agreement = lazy(() => import('./components/Agreement').then(module => ({default: module.Agreement})));
const PrivateChat = lazy(loadPrivateChat);
const KitPages = lazy(() => import('./components/KitPages'));
const ChatBoard = lazy(() => import('./components/ChatBoard').then(module => ({default:module.ChatBoard})));
const BoardIndex = lazy(() => import('./components/ChatBoard').then(module => ({default:module.BoardIndex})));

function initialTheme() {
  const telegram = import.meta.env.VITE_TELEGRAM_MINI_APP === 'true' ? getTelegramWebApp() : undefined;
  return telegram ? telegram.colorScheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export default function App({requestReply = replyTo}: {requestReply?: typeof replyTo}) {
  const route = useRoute();
  const theme = useTheme(initialTheme);
  const {session, persisted, notice, accept, signOut} = useAccess();
  const [unlocked, setUnlocked] = useState(false);
  const gated = !session && (route.kind === 'login' || route.kind === 'workspace');

  useEffect(() => {setUnlocked(false);}, [route.path, session?.accountId]);
  useEffect(() => {
    if (session && route.kind === 'login') location.replace('#/history');
  }, [session, route.kind]);

  let screen;
  if (route.kind === 'not-found') {
    screen = <main className="state-page"><PageState kind="not-found" href={route.homeHref}/></main>;
  } else if (route.kind === 'agreement') {
    screen = <Suspense fallback={<main className="state-page"><ScreenSkeleton/></main>}>
      <Agreement key={session?.accountId ?? 'guest'} accountId={session?.accountId}/>
    </Suspense>;
  } else if (route.kind === 'kit' && route.kit) {
    screen = <Suspense fallback={<main className="state-page"><ScreenSkeleton/></main>}><KitPages page={route.kit} {...theme}/></Suspense>;
  } else if (!session) {
    const previewHref = accessPreviewHref(route.path);
    screen = route.kind === 'home' ? <PublicLanding {...theme}/> : previewHref ? <PreviewAccess href={previewHref}/> : (
      <Suspense fallback={<main className="state-page"><ScreenSkeleton compact/></main>}>
        <CodeGate onUnlock={()=>setUnlocked(true)} notice={notice} onAccept={value => {
          if (route.kind === 'login') location.replace('#/history');
          accept(value);
        }}/>
      </Suspense>
    );
  } else {
    const workspaceRoute = route.kind === 'login' ? {...route, page: 'history', kind: 'workspace' as const} : route;
    screen = <AuthorizedWorkspace key={session.accountId} session={session} route={workspaceRoute} persisted={persisted} {...theme}
      requestReply={requestReply} onSignOut={() => { signOut(); location.replace('#/login'); }}/>;
  }

  return <>
    <PersistentBrand href={route.homeHref} route={route.path} onAccess={gated} lock={gated ? unlocked ? 'open' : 'closed' : undefined}/>
    {screen}
  </>;
}

function PreviewAccess({href}: {href: string}) {
  const {t} = useUi();
  return <main className="code-gate">
    <section className="code-gate__panel" aria-labelledby="access-title">
      <h1 id="access-title" className="code-gate__title">{t('Вход в Agentik', 'Sign in to Agentik')}</h1>
      <p className="code-gate__description">{t(
        'Откройте закрытое превью через свой аккаунт ChatGPT, затем введите email и код Agentik.',
        'Open the private preview with your ChatGPT account, then enter your Agentik email and code.',
      )}</p>
      <a className="button button--primary" href={href}>{t('Войти в превью', 'Open the preview')}</a>
    </section>
  </main>;
}

type WorkspaceContext = {
  requestReply: typeof replyTo;
  route: Route;
  session: AccessSession;
  persisted: boolean;
  onSignOut: () => void;
  dark: boolean;
  toggleTheme: () => void;
};

function AuthorizedWorkspace(context: WorkspaceContext) {
  const account = context.session.accountId;
  const [profile, setProfile] = useState(() => activeProfile(account));
  return <Workspace key={profile.id} {...context} profile={profile} onSwitch={next => {
    selectProfile(next, account);
    setProfile(next);
  }}/>;
}

function Workspace({requestReply, profile, onSwitch, route, session, persisted, onSignOut, dark, toggleTheme}: WorkspaceContext & {
  profile: LocalProfile;
  onSwitch: (profile: LocalProfile) => void;
}) {
  const {language,t,setLanguage}=useUi();
  const {state, saved, update: setState} = useProfileState(profile.id, session.accountId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [localModal, setModal] = useState<'create' | 'profile' | 'pro' | null>(null);
  const modalRoute = route.page === 'create' || route.page === 'profile' || route.page === 'pro' ? route.page : null;
  const modal = localModal ?? modalRoute;
  const wallet = useMessageBalance(session.accountId, session.plan === 'pro');
  const activePath = useRef(route.path);
  activePath.current = route.path;
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [model, setModel] = useState<ChatModel>('auto');
  const [validation,setValidation]=useState('');
  const [drafts] = useState(createChatDrafts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState<Point>();
  const clearPulse = useCallback(() => setPulse(undefined), []);
  const online = useOnline();
  const controllers = useRef(new Map<string, AbortController>());
  const {id} = route;
  const page = modalRoute ? 'assistants' : route.page;
  const home = route.kind === 'home';
  const email = profile.name;
  const all = useMemo(() => [...catalog, ...state.custom], [state.custom]);
  const conversation = page === 'chat' ? state.conversations.find(item => item.id === id) : undefined;
  const assistant = page === 'assistant' || page === 'board' ? all.find(item => item.id === id)
    : all.find(item => item.id === conversation?.assistantId);
  const chatKey = conversation?.id ?? `new:${assistant?.id ?? ''}`;
  const boardChat = page === 'board' && route.boardChatId
    ? state.conversations.find(item => item.id === route.boardChatId && item.assistantId === id) : undefined;
  const boardDraftKey = boardChat?.id ?? `new:${assistant?.id ?? ''}`;
  const boardChatHref = boardChat ? `#/chat/${boardChat.id}` : `#/assistant/${assistant?.id ?? ''}`;

  function takeBoardNotes(text: string) {
    if (!assistant || !text.trim()) return false;
    const combined = [drafts.get(boardDraftKey).trimEnd(), text].filter(Boolean).join('\n\n');
    if (combined.length > MAX_CHAT_MESSAGE_LENGTH) return false;
    drafts.set(boardDraftKey, combined);
    location.hash = boardChatHref;
    return true;
  }

  function takeBoardAttachment(attachment: ChatDraftAttachment) {
    if (!assistant) return;
    drafts.setAttachment(boardDraftKey, attachment);
    location.hash = boardChatHref;
  }

  useEffect(() => { setQuery(''); setCategory('Все'); }, [route.path]);
  useEffect(schedulePrefetch, []);
  useEffect(() => {
    if (!conversation || !assistant) return;
    const key = `new:${assistant.id}`;
    const controller = controllers.current.get(conversation.id);
    if (controller && controllers.current.get(key) === controller) controllers.current.delete(key);
  }, [conversation?.id, assistant?.id]);
  useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
  }, []);

  function favorite(id: string) {
    setState(current => ({...current, favorites: current.favorites.includes(id)
      ? current.favorites.filter(item => item !== id) : [...current.favorites, id]}));
  }

  function closeModal() {
    setModal(null);
    if (!localModal && modalRoute) location.replace('#/assistants');
  }

  async function chargeMessage(commit: () => boolean) {
    const path = route.path;
    const result = await wallet.submit(() => activePath.current === path && commit());
    if (result === 'last' || (result === 'blocked' && activePath.current === path)) setModal('pro');
    return result === 'accepted' || result === 'last';
  }

  function submitChat(retry: boolean, anchor: HTMLElement | null, images: ChatImage[] = []) {
    if (retry) return send(true, anchor, images);
    return chargeMessage(() => send(false, anchor, images));
  }

  function createAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name')).trim();
    const description = String(form.get('description')).trim();
    if (!name || !description) {
      setValidation(t('Укажите название и опишите задачи помощника.','Enter a name and describe what the assistant does.'));
      event.currentTarget.querySelector<HTMLInputElement>(name ? '#agent-description' : '#agent-name')?.focus();
      return;
    }
    setValidation('');
    const custom: Assistant = {
      id: crypto.randomUUID(), name, description, category: 'Мои помощники', kind: 'assistant',
      icon: 'Sparkles', color: 'lavender', prompts: ['Давай начнём. Чем ты можешь помочь?'],
      instruction: `Ты — ${name}. ${description}. Уточняй контекст, отвечай понятно и не выдумывай факты.`,
    };
    setState(current => ({...current, custom: [...current.custom, custom]}));
    setModal(null);
    location.hash = `#/assistant/${custom.id}`;
  }

  function showFirstSend(anchor: HTMLElement | null) {
    if (!takeFirstMoment(profile.id, 'send') || !allowsMotion() || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPulse({x: rect.left + rect.width / 2, y: rect.top + rect.height / 2});
  }

  function send(retry: boolean, anchor: HTMLElement | null, images: ChatImage[]) {
    if (!assistant || controllers.current.has(chatKey) || (mode === 'live' && !online)) return false;
    const input = drafts.get(chatKey).trim();
    const draftAttachment = drafts.getAttachment(chatKey);
    const draftDocument = draftAttachment?.kind === 'document' ? draftAttachment.document : undefined;
    if (!retry && !input && (draftDocument || !images.length)) return false;
    const target = conversation ?? {id: crypto.randomUUID(), assistantId: assistant.id, title: input.slice(0, 70) || images[0]?.name || t('Изображение','Image'), messages: [], updatedAt: Date.now()};
    const id = target.id;
    let turn: {id: string; prompt: string} | undefined;

    const updateConversation = (current: Conversation): Conversation => {
      const last = current.messages.at(-1);
      const attempted = conversation?.messages.at(-1);
      if (retry && (last?.role !== 'user' || last.turnId !== attempted?.turnId
        || last.content !== attempted?.content || last.images?.[0]?.id !== attempted?.images?.[0]?.id
        || last.document?.id !== attempted?.document?.id)) return current;
      turn = {id: (retry ? last?.turnId : undefined) ?? crypto.randomUUID(), prompt: retry ? last!.content : input};
      const messages = retry ? current.messages.slice(0, -1) : current.messages;
      const attachments = retry ? last?.images : images;
      const document = retry ? last?.document : draftDocument;
      return {...current, messages: [...messages, {role:'user',content:turn.prompt,turnId:turn.id,
        ...(attachments?.length ? {images:attachments} : {}), ...(document ? {document} : {})}], updatedAt: Date.now()};
    };

    let requestMessages: Conversation['messages'] = [];
    setState(current => {
      const latest = current.conversations.find(item => item.id === id) ?? target;
      const next = updateConversation(latest);
      requestMessages = next.messages;
      return turn ? {...current, startedChat: true, conversations: [next, ...current.conversations.filter(item => item.id !== id)]} : current;
    });
    if (!turn) return false;
    const sent = turn;
    if (!retry) drafts.setAttachment(chatKey);

    const controller = new AbortController();
    controllers.current.set(id, controller);
    if (chatKey !== id) {
      controllers.current.set(chatKey, controller);
      drafts.set(id, input);
      drafts.set(chatKey, '');
      location.hash = `#/chat/${id}`;
    }
    setErrors(current => ({...current, [id]: ''}));
    setPending(current => ({...current, [id]: true}));
    if (!retry) showFirstSend(anchor);

    void Promise.resolve().then(() =>
      requestReply(assistant, requestMessages, {mode, token: session.token, signal: controller.signal, model, language})
    ).then(reply => {
      if (controller.signal.aborted) return;
      setState(current => ({
        ...current,
        conversations: current.conversations.map(item => {
          if (item.id !== id || item.messages.some(message => message.role === 'assistant' && message.turnId === sent.id)) return item;
          const index = item.messages.findIndex(message => message.role === 'user' && message.turnId === sent.id);
          if (index === -1) return item;
          const messages = item.messages.slice();
          messages.splice(index + 1, 0, {role:'assistant', content:reply, turnId:sent.id});
          return {...item, messages, updatedAt:Date.now()};
        }),
      }));
      if (drafts.get(id).trim() === sent.prompt && !drafts.getAttachment(id)) drafts.set(id, '');
    }).catch(error => {
      if (!controller.signal.aborted) {
        setErrors(current => ({...current,[id]:error instanceof Error ? error.message : 'Не удалось получить ответ.'}));
      }
    }).finally(() => {
      if (controllers.current.get(id) === controller) controllers.current.delete(id);
      if (controllers.current.get(chatKey) === controller) controllers.current.delete(chatKey);
      if (!controller.signal.aborted) setPending(current => ({...current,[id]:false}));
    });
    return true;
  }
 const nav=[{href:'/',label:t('Для вас','For you'),Icon:House},{href:'/assistants',label:t('Помощники','Assistants'),Icon:LayoutGrid},{href:'/characters',label:t('Персонажи','Characters'),Icon:Smile},{href:'/favorites',label:t('Избранное','Favorites'),Icon:Star},{href:'/history',label:t('История','History'),Icon:History},{href:'/rooms',label:t('Групповые чаты','Group chats'),Icon:Users},{href:'/boards',label:t('Доски','Boards'),Icon:FolderOpen}];
 const active=home?'/':page==='board'?'/boards':`/${page}`;
 const isChat=page==='chat'||page==='assistant';const busy=!!pending[chatKey],error=errors[chatKey];
 const isCatalog = home || page === 'assistants' || page === 'characters' || page === 'favorites';
 const visible = useMemo(() => {
   if (!isCatalog) return [];
   const entries = all.filter(a => page === 'characters' ? a.kind === 'character'
     : page === 'favorites' ? state.favorites.includes(a.id) : a.kind === 'assistant');
   return filterAssistants(entries, query, category);
 }, [isCatalog, all, state.favorites, page, query, category]);
 const messageCounts = useMemo(() => {
   const counts = new Map<string, {total: number; hasUserMessage: boolean}>();
   if (!isCatalog) return counts;
   for (const {assistantId, messages} of state.conversations) {
     const count = counts.get(assistantId) ?? {total: 0, hasUserMessage: false};
     count.total += messages.length;
     count.hasUserMessage ||= messages.some(message => message.role === 'user');
     counts.set(assistantId, count);
   }
   return counts;
 }, [isCatalog, state.conversations]);
 const languagePicker=<div className="language-choice" role="group" aria-label={t('Язык интерфейса','Interface language')}>
   <button type="button" aria-pressed={language==='ru'} onClick={()=>setLanguage('ru')}>RU</button>
   <button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>ENG</button>
 </div>;
 const balanceLabel = t('Баланс демотокенов','Demo token balance');
 const preferences=<div className="account-preferences">
   {languagePicker}
   {session.plan === 'pro' ? <div className="account-balance">
     <Coins size={15} aria-hidden="true"/>
     <output aria-label={balanceLabel}>∞</output>
   </div> : <button type="button" className="account-balance"
     aria-label={`${balanceLabel}: ${wallet.remaining}`} aria-haspopup="dialog" onClick={()=>setModal('pro')}>
     <Coins size={15} aria-hidden="true"/>
     <span aria-hidden="true">{wallet.remaining}</span>
   </button>}
 </div>;
 const proButton=session.offerPro && session.plan !== 'pro' ? <ProButton label={t('Купить PRO','Get PRO')} onClick={()=>setModal('pro')}/> : null;
 const categoryLabels:Record<string,string>={'Все':'All','Работа':'Work','Жизнь':'Life','Творчество':'Creative','Обучение':'Learning','Дом':'Home','Дизайн':'Design','Продукт':'Product','Мои помощники':'My assistants'};
 const categoryLabel=(value:string)=>language==='en' ? categoryLabels[value] ?? value : value;
 const notices = useMemo(() => home ? readServiceNotices(import.meta.env.VITE_SERVICE_ANNOUNCEMENTS) : [], [home]);
 const hasRoom = useMemo(() => {
   if (!home || state.startedChat || state.conversations.length) return false;
   try { return readLocalRooms(localStorage, profile.id).some(room => room.ownerId === profile.id); }
   catch { return false; }
 }, [home, state.startedChat, state.conversations.length, profile.id]);
 const showHero = home && !notices.length && !state.startedChat && !state.conversations.length && !hasRoom;
 const TitleTag=showHero?'h2':'h1';
 const title=home?t('Найдите своего помощника','Find your assistant'):page==='characters'?t('С кем поговорим?','Who shall we talk to?'):page==='favorites'?t('Всегда под рукой','Your favorites'):t('Помощники на каждый день','Everyday assistants');
 return <div className="app"><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>{t('К содержимому','Skip to content')}</a>
  <aside className="sidebar">
   <nav className="navigation" aria-label={t('Главная навигация','Main navigation')}>{nav.map(({href,label,Icon})=><a className={`navigation__link${active===href?' navigation__link--active':''}`} aria-current={active===href?'page':undefined} href={`#${href}`} key={href}><Icon size={20} strokeWidth={1.8}/><span>{label}</span>{href==='/assistants'&&<span className="navigation__count">{all.filter(item=>item.kind==='assistant').length}</span>}{href==='/favorites'&&state.favorites.length>0&&<span className="navigation__count">{state.favorites.length}</span>}</a>)}</nav>
   <button className="button button--create" onClick={()=>{setValidation('');setModal('create');}}><Plus size={19}/>{t('Создать помощника','Create assistant')}</button>
   <div className="sidebar__bottom"><button className="profile-button" onClick={()=>setModal('profile')}><span className="profile-button__avatar">{email?email[0].toUpperCase():'В'}</span><span className="profile-button__text"><strong>{profile.name}</strong><span>{mode==='demo'?t('Демонстрационный режим','Demo mode'):t('Режим AI','AI mode')}</span></span><SlidersHorizontal size={17}/></button><div className="sidebar__preferences">{preferences}{proButton}</div></div>
  </aside>
  <div className="app__body">
   <header className="topbar">
    <div className="topbar__left">
     <a className="topbar__breadcrumb" href="#/history">{t('Ваше пространство','Your workspace')}</a>
     <ChevronRight size={14} aria-hidden="true"/>
     <span>{isChat?t('Разговор','Chat'):nav.find(n=>n.href===active)?.label??t('Для вас','For you')}</span>
    </div>
    <div className="topbar__right">
     <span className="mode-label">{mode==='demo'?t('Демо-версия','Demo'):t('AI подключение','AI connected')}</span>
     <button className="icon-button" aria-label={dark?t('Светлая тема','Light mode'):t('Тёмная тема','Dark mode')} onClick={toggleTheme}>{dark?<Sun size={20}/>:<Moon size={20}/>}</button>
     <button onPointerEnter={()=>prefetchScreen('profile')} onFocus={()=>prefetchScreen('profile')} className="topbar__profile" onClick={()=>setModal('profile')} aria-label={t('Открыть профиль','Open profile')}>{email?email[0].toUpperCase():'В'}</button>
    </div>
   </header>
  <main id="main-content" className={`main${isChat?' main--chat':''}`} tabIndex={-1}>
   {!persisted&&<p className="notice" role="status">{t('Браузер ограничил сохранение. Придётся ввести код при следующем открытии.','Browser storage is restricted. Sign in again next time.')}</p>}
   {!online&&!isChat&&<p className="offline-note" role="status"><WifiOff size={16}/> {t('Офлайн. Сохранённые чаты и деморежим доступны.','Offline. Saved chats and demos are available.')}</p>}
   {!saved&&<p role="alert" className="notice notice--error">{t('Не удалось прочитать или сохранить кеш. Новые изменения доступны до закрытия страницы.','Storage is unavailable. New changes will last until this page closes.')}</p>}
   {page==='board' ? (
    assistant && (!route.boardChatId || boardChat) ? <section className="chat">
      <h1 className="section-title">{assistant.name}</h1>
      <ChatBoardTabs assistantId={assistant.id} conversationId={boardChat?.id} active="board"/>
      <Suspense fallback={<ScreenSkeleton/>}>
        <ChatBoard key={profile.id+'/'+assistant.id} profileId={profile.id} boardKey={assistant.id}
          title={assistant.name} onUseText={takeBoardNotes} onUseAttachment={takeBoardAttachment}/>
      </Suspense>
    </section> : <PageState kind="conversation" href="#/boards"/>
   ) : page==='boards' ? <Suspense fallback={<ScreenSkeleton/>}><BoardIndex profileId={profile.id}/></Suspense>
   : isChat?assistant?<Suspense fallback={<ScreenSkeleton/>}><PrivateChat assistant={assistant} conversation={conversation} profile={profile}
    messagePrice={wallet.price} mode={mode} online={online} busy={busy} drafts={drafts} error={error}
    telegramShareToken={session.token}
    onSend={submitChat} model={model} onModel={setModel}/></Suspense>
    :<PageState kind="conversation" href="#/history"/>:
   page==='history'?<section><p className="eyebrow">{t('ПРОДОЛЖИМ С ТОГО ЖЕ МЕСТА','PICK UP WHERE YOU LEFT OFF')}</p><h1 className="section-title">{t('Ваши разговоры','Your chats')}</h1><div className="chat-tabs"><a className="chat-tabs__link chat-tabs__link--active" href="#/history">{t('Личные','Private')}</a><a className="chat-tabs__link" onPointerEnter={()=>prefetchScreen('rooms')} onFocus={()=>prefetchScreen('rooms')} href="#/rooms"><Users size={17}/>{t('Общие комнаты','Groups')}</a><a className="chat-tabs__link" href="#/boards"><FolderOpen size={17}/>{t('Доски','Boards')}</a></div><p className="section-description">{t('Идеи и решения, к которым можно вернуться. Сохранено в этом браузере.','Your saved chats in this browser.')}</p>{state.conversations.length?<div className="history-list">{[...state.conversations].sort((a,b)=>b.updatedAt-a.updatedAt).map(c=>{const a=all.find(a=>a.id===c.assistantId);return <a className="history-item" key={c.id} onFocus={prefetchChat} onPointerEnter={prefetchChat} href={`#/chat/${c.id}`}><span className={`avatar avatar--${a?.color??'lime'}`}><AgentIcon name={a?.icon??'Sparkles'}/></span><span className="history-item__text"><strong>{c.title}</strong><span>{a?.name} · {c.messages.length} {t('сообщений','messages')}</span></span><span className="history-item__date">{new Date(c.updatedAt).toLocaleDateString(language,{day:'numeric',month:'short'})}</span><ChevronRight size={17}/></a>;})}</div>:<Empty title={t('Здесь начнётся ваша история','Your history starts here')} text={t('Первый разговор появится здесь, когда вы отправите сообщение помощнику.','Send your first message to start your history.')}/>}</section>:
   page==='rooms'||page==='join'?<Suspense fallback={<ScreenSkeleton/>}><Rooms key={`${page}/${id??''}/${profile.id}`} roomId={page==='rooms'?id:undefined} joinToken={page==='join'?id:undefined} profile={profile} onSend={showFirstSend} onCreate={()=>setState(current=>({...current, startedChat:true}))} language={language} messagePrice={wallet.price} billMessage={chargeMessage} telegramShareToken={session.token}/></Suspense>:['assistants','characters','favorites',undefined].includes(page)?<>
   {showHero&&<LandingHero signedIn/>}
   {notices.length > 0 && <ServiceNotices items={notices}/>}
   <section className={`catalog${home||page==='assistants'?' catalog--discovery':''}`}><div className="mobile-intro"><p>Рады видеть вас, {profile.name==='Моё пространство'?'друг':profile.name}</p><h1>{t('С чем помочь?','How can we help?')}</h1><button className="icon-button" aria-label={t('Создать своего помощника','Create your own assistant')} onClick={()=>{setValidation('');setModal('create');}}><Plus size={23}/></button></div><div className="mobile-switch"><a className={page!=='characters'?'mobile-switch__link mobile-switch__link--active':'mobile-switch__link'} href="#/assistants">{t('Помощники','Assistants')}</a><a className={page==='characters'?'mobile-switch__link mobile-switch__link--active':'mobile-switch__link'} href="#/characters">{t('Персонажи','Characters')}</a></div><div className="section-heading"><div>{!home&&<p className="eyebrow">{page==='characters'?t('ИСТОРИИ И НОВЫЕ ЗНАКОМСТВА','STORIES AND CHARACTERS'):page==='favorites'?t('ВАША ЛИЧНАЯ КОЛЛЕКЦИЯ','YOUR COLLECTION'):t('НА КАЖДЫЙ СЛУЧАЙ','EVERYDAY HELP')}</p>}<TitleTag className={home?'section-title section-title--secondary':'section-title'}>{title}</TitleTag><p className="section-description">{page==='characters'?t('Вымышленные герои с характером. Для общения, игр и воображения.','Fictional characters for conversations and stories.'):page==='favorites'?t('Любимые помощники и персонажи в одном месте.','Your favorite assistants and characters in one place.'):t('Немного поддержки — и всё получится.','Find an assistant for the task at hand.')}</p></div><label className="search"><Search size={19}/><span className="sr-only">{t('Поиск помощника','Search assistants')}</span><input className="search__input" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Кто вам нужен сегодня?','Who do you need today?')}/>{query&&<button className="search__clear" onClick={()=>setQuery('')} aria-label={t('Очистить поиск','Clear search')}><X size={16}/></button>}</label></div>
   {page!=='characters'&&<div className="catalog__toolbar"><div className="category-list" aria-label={t('Категории','Categories')}>{[...categories,...(state.custom.length?['Мои помощники']:[])].map(c=><button className={`category-list__item${category===c?' category-list__item--active':''}`} aria-pressed={category===c} onClick={()=>setCategory(c)} key={c}><CategoryIcon category={c}/><span>{categoryLabel(c)}</span></button>)}</div><span className="catalog__count">{visible.length} {page==='favorites'?t('в избранном','in favorites'):t('помощников','assistants')}</span></div>}
   {visible.length?<div className="agent-grid">{(home&&!query&&category==='Все'?visible.slice(0,6):visible).map(a=>{
     const messages = messageCounts.get(a.id);
     const count = messages?.hasUserMessage ? messages.total.toLocaleString(language) : undefined;
     const descriptionId = count ? `agent-message-count-${a.id}` : undefined;
     return <article className="agent-card" key={a.id}>
       <div className="agent-card__top">
         <span className={`avatar avatar--${a.color}`} data-category={a.category}><AgentIcon name={a.icon}/></span>
         <FavoriteButton pressed={state.favorites.includes(a.id)} label={`${state.favorites.includes(a.id)?t('Убрать из избранного','Remove favorite'):t('В избранное','Add favorite')}: ${a.name}`} onToggle={()=>favorite(a.id)}/>
       </div>
       <a href={`#/assistant/${a.id}`} className="agent-card__link" onFocus={prefetchChat} onPointerEnter={prefetchChat}
         aria-label={t(`Открыть: ${a.name}`,`Open: ${a.name}`)} aria-describedby={descriptionId}>
         <h2 className="agent-card__title">{a.name}</h2>
         <p className="agent-card__description">{a.description}</p>
         <span className="agent-card__footer">
           <span>{categoryLabel(a.category)}</span>
           <span className="agent-card__messages">
             <MessageCircle size={17} aria-hidden="true"/>
             {count && <><span aria-hidden="true">{count}</span><span id={descriptionId} className="sr-only">{t(`Сообщений: ${count}`, `Messages: ${count}`)}</span></>}
           </span>
         </span>
       </a>
     </article>;
   })}</div>:<Empty title={page==='favorites'&&!query?t('Сохраните тех, кто нравится','Save your favorites'):t('Пока никого не нашли','No assistants found')} text={page==='favorites'&&!query?t('Нажмите на звёздочку на карточке, и помощник останется здесь.','Star an assistant to keep it here.'):t('Попробуйте другое слово или выберите другую категорию.','Try a different search or category.')}/>}
   {home&&!query&&category==='Все'&&<a className="catalog__more" href="#/assistants">{t('Все помощники','All assistants')}<ChevronDown size={18}/></a>}
   </section>
   {home&&<><section className="create-banner"><span className="create-banner__icon"><Plus size={28}/></span><div><h2 className="create-banner__title">{t('Ваши задачи. Ваш помощник.','An assistant for your work')}</h2><p>{t('Задайте ему роль и характер — остальное дело за вами.','Describe a role and the way you want it to work.')}</p></div><button className="button button--secondary" onClick={()=>{setValidation('');setModal('create');}}>{t('Создать своего','Create your own')}</button></section><section className="how-it-works"><div><span className="eyebrow">{t('ПРОЩЕ, ЧЕМ КАЖЕТСЯ','GETTING STARTED')}</span><h2 className="section-title section-title--secondary">{t('От вопроса к результату','From question to result')}</h2></div><div className="how-it-works__grid">{[[t('Найдите своего','Find an assistant'),t('Выберите помощника под задачу или создайте собственного.','Pick one for the job or create your own.')],[t('Расскажите о задаче','Describe your task'),t('Напишите своими словами или начните с готового примера.','Write a message or pick a starter prompt.')],[t('Вернитесь, когда нужно','Return when you need to'),t('Разговоры останутся в истории этого браузера.','Your browser keeps your chat history.')]].map(([t,d])=><div className="how-it-works__step" key={t}><span className="how-it-works__check"><Check size={18}/></span><h3>{t}</h3><p>{d}</p></div>)}</div></section></>}
   <footer className="footer"><a className="text-link" href="#/agreement">{t('Пользовательское соглашение','User agreement')}</a><span>{t('Немного AI. Больше возможностей.','AI for everyday work.')}</span><span>{t('Демо · 2026 · (c) Sergey Buharev','Demo · 2026 · (c) Sergey Buharev')}</span></footer>
   </>:<Empty title="Такой страницы нет" text="Вернитесь к помощникам и выберите, с чего начать."/>}
  </main></div>
  <nav className="bottom-nav" aria-label={t('Нижняя навигация','Bottom navigation')}><a className={`bottom-nav__item${['assistants','characters',undefined].includes(page)?' bottom-nav__item--active':''}`} href="#/assistants"><LayoutGrid size={22}/><span>{t('Каталог','Catalog')}</span></a><a className={`bottom-nav__item${['history','chat','rooms','join'].includes(page??'')?' bottom-nav__item--active':''}`} onPointerEnter={()=>prefetchScreen('rooms')} href="#/history"><MessageCircle size={22}/><span>{t('Чаты','Chats')}</span></a><button className="bottom-nav__create" aria-label={t('Создать помощника','Create assistant')} onClick={()=>{setValidation('');setModal('create');}}><Plus size={25}/></button><a className={`bottom-nav__item${page==='favorites'?' bottom-nav__item--active':''}`} href="#/favorites"><Star size={22}/><span>{t('Избранное','Favorites')}</span></a><button className="bottom-nav__item" onPointerEnter={()=>prefetchScreen('profile')} onClick={()=>setModal('profile')}><UserRound size={22}/><span>{t('Профиль','Profile')}</span></button></nav>
  {modal==='create'&&<Modal title={t('Помощник по вашим правилам','Create an assistant')} description={t('Расскажите, как его зовут и с чем он будет помогать.','Name your assistant and describe its job.')} onClose={closeModal}><form className="form" onSubmit={createAssistant} onChange={()=>setValidation('')} noValidate>{validation&&<p className="notice notice--error" role="alert">{validation}</p>}<label className="form__label" htmlFor="agent-name">{t('Название','Name')}</label><input className="form__input" id="agent-name" name="name" maxLength={60} required placeholder={t('Например, мой исследователь','For example, my researcher')}/><label className="form__label" htmlFor="agent-description">{t('Что он умеет','What does it do?')}</label><textarea className="form__input form__input--textarea" id="agent-description" name="description" maxLength={1000} required placeholder={t('Роль, задачи, стиль общения…','Role, tasks, tone…')}/><p className="form__hint">{t('Помощник сохранится в этом браузере. Ответы зависят от выбранного режима.','This assistant is saved in your browser. Replies depend on the selected mode.')}</p><button className="button button--primary">{t('Сохранить помощника','Save assistant')}</button></form></Modal>}
  {modal==='profile'&&<Suspense fallback={<ScreenSkeleton compact/>}>
   <Profile onClose={closeModal} mode={mode} setMode={setMode} profile={profile} accountId={session.accountId} preferences={<div className="mobile__preferences">{preferences}{proButton}</div>} onSwitch={onSwitch} onSignOut={onSignOut}/>
  </Suspense>}
  {modal==='pro'&&<Paywall active={session.plan==='pro'} exhausted={wallet.remaining===0} onClose={closeModal} onContinue={()=>{
    setModal(null);
    if (conversation || (page==='rooms' && id)) return;
    const existing=[...state.conversations].sort((a,b)=>b.updatedAt-a.updatedAt)[0];
    if (existing) { location.hash='#/chat/'+existing.id; return; }
    try {
      const group=readLocalRooms(localStorage,profile.id).find(room=>room.ownerId===profile.id);
      if (group) {location.hash='#/rooms/'+group.id;return;}
    } catch {}
    location.hash='#/history';
  }}/>}
  {pulse&&<SendPulse point={pulse} onEnd={clearPulse}/>}
 </div>;
}
function Empty({title,text}:{title:string;text:string}){const {t}=useUi();return <div className="empty-state"><Scene kind={title.includes('истори')?'history':'search'}/><h2 className="empty-state__title">{title}</h2><p className="empty-state__text">{text}</p><a className="button button--secondary" href="#/assistants">{t('К помощникам','Browse assistants')}</a></div>;}
