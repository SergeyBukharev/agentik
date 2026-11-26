import {useEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, Copy, FileText, Heart, MessageCircle, Search, Sparkles, X} from 'lucide-react';
import {AnimatePresence} from 'motion/react';
import * as m from 'motion/react-m';
import {categories, filterAssistants, getCategoryLabel, type Assistant} from '../../src/catalog';
import {AgentCard, AttachmentChip, Avatar, Composer, Empty, useCopy} from './ui';
import type {Attachment, Chat, Locale, Message, State} from './model';

export function Agents({agents, locale, favorites, onFavorite}: {
  agents: Assistant[]; locale: Locale; favorites: string[]; onFavorite: (id: string) => void;
}) {
  const t = useCopy();
  const [category, setCategory] = useState('Все');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'assistant' | 'character'>('assistant');
  const visible = useMemo(() => filterAssistants(agents.filter(agent => agent.kind === kind), query, kind === 'character' ? 'Все' : category), [agents, query, category, kind]);
  return <div className="page stack page--catalog">
    <header className="page-heading">
      <div><h1>{t('Помощники', 'Assistants')}</h1><p>{t('Найди собеседника под свою задачу.', 'Find someone for the task at hand.')}</p></div>
      <label className="search-field"><Search size={20}/><input type="search" value={query} onChange={event => setQuery(event.target.value)}
        aria-label={t('Найти помощника', 'Find an assistant')} placeholder={t('Найти помощника…', 'Find an assistant…')}/></label>
    </header>
    <div className="segmented" role="group" aria-label={t('Тип собеседника', 'Who to talk to')}>
      <button type="button" aria-pressed={kind === 'assistant'} onClick={() => setKind('assistant')}>{t('Помощники', 'Assistants')}</button>
      <button type="button" aria-pressed={kind === 'character'} onClick={() => setKind('character')}>{t('Персонажи', 'Characters')}</button>
    </div>
    {kind === 'assistant' && <div className="filters" role="group" aria-label={t('Категории', 'Categories')}>
      {categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>
        {getCategoryLabel(item, locale)}
      </button>)}
    </div>}
    {visible.length ? <div className="agent-grid">
      {visible.map(agent => <AgentCard key={agent.id} agent={agent} favorite={favorites.includes(agent.id)} onFavorite={onFavorite}/>)}
    </div> : <Empty title={t('Ничего не нашли', 'No results')} description={t('Попробуй другой запрос или категорию.', 'Try another query or category.')}/>}
  </div>;
}

export function History({chats, agents, locale}: {chats: Chat[]; agents: Assistant[]; locale: Locale}) {
  const t = useCopy();
  const date = new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric'});
  return <div className="page stack">
    <header className="page-heading"><div><h1>{t('История', 'History')}</h1><p>{t('Продолжи разговор с того же места.', 'Pick up where you left off.')}</p></div></header>
    {chats.length ? <div className="history">
      {chats.map(chat => {
        const agent = agents.find(item => item.id === chat.assistantId);
        return <a key={chat.id} className="history__item" href={`#/chat/${chat.id}`}>
          {agent ? <Avatar agent={agent}/> : <Avatar agent={{icon: 'Sparkles', color: 'lavender'}}/>}
          <span className="history__copy"><strong>{chat.title}</strong><span>{agent?.name ?? 'Agentik'}</span></span>
          <time dateTime={new Date(chat.updatedAt).toISOString()}>{date.format(chat.updatedAt)}</time>
          <ArrowUpRight size={18} aria-hidden="true"/>
        </a>;
      })}
    </div> : <Empty title={t('Пока без чатов', 'No chats yet')} description={t('Здесь появится первый разговор.', 'Your first conversation will show up here.')}
      action={{href: '#/new', label: t('Начать чат', 'Start a chat')}}/>}
  </div>;
}

export function Saved({state, agents, onFavorite, onRemove}: {
  state: State; agents: Assistant[]; onFavorite: (id: string) => void; onRemove: (id: string) => void;
}) {
  const t = useCopy();
  const favorites = agents.filter(agent => state.favorites.includes(agent.id));
  return <div className="page stack">
    <header className="page-heading"><div><h1>{t('Сохранённое', 'Saved')}</h1><p>{t('Любимые помощники и ответы, к которым хочется вернуться.', 'Favorite assistants and replies to return to.')}</p></div></header>
    {!favorites.length && !state.notes.length && <Empty title={t('Здесь пока пусто', 'Nothing saved yet')} description={t('Отметь помощника сердечком или сохрани ответ из чата.', 'Favorite an assistant or save a reply from a chat.')}
      action={{href: '#/agents', label: t('Посмотреть помощников', 'Browse assistants')}}/>}
    {!!favorites.length && <section className="stack">
      <div className="section-row"><h2>{t('Помощники', 'Assistants')}</h2></div>
      <div className="agent-grid">{favorites.map(agent => <AgentCard key={agent.id} agent={agent} favorite onFavorite={onFavorite}/>)}</div>
    </section>}
    {!!state.notes.length && <section className="stack">
      <div className="section-row"><h2>{t('Ответы', 'Replies')}</h2></div>
      <div className="note-grid">{state.notes.map(note => <article className="note" key={note.id}>
        <div className="note__header"><Bookmark size={19}/><button className="icon-button" type="button" aria-label={t('Убрать ответ', 'Remove saved reply')}
          onClick={() => onRemove(note.id)}><X size={18}/></button></div>
        <h3>{note.title}</h3><p>{note.text}</p>
        <a className="button button--link" href={`#/chat/${note.chatId}`}>{t('Открыть чат', 'Open chat')}<ArrowUpRight size={17}/></a>
      </article>)}</div>
    </section>}
  </div>;
}

function ChatBubble({message, agent, saved, onSave}: {
  message: Message; agent: Assistant; saved: boolean; onSave: () => void;
}) {
  const t = useCopy();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const assistant = message.role === 'assistant';
  const [title, ...sections] = message.text.split('\n\n');
  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setFailed(false);
    } catch { setFailed(true); }
  }
  return <m.article className={`chat-message chat-message--${message.role}`}
    initial={{opacity: 0, y: 7}} animate={{opacity: 1, y: 0}} transition={{duration: .19}}>
    {assistant && <Avatar agent={agent}/>}
    <div className="chat-message__body">
      {!assistant && <span className="sr-only">{t('Ты', 'You')}</span>}
      {message.attachment && <AttachmentChip attachment={message.attachment}/>}
      {message.attachment?.kind === 'image' && <img className="chat-message__image" src={message.attachment.value.url}
        alt={message.attachment.value.name} loading="lazy"/>}
      {assistant ? <>
        <strong>{title}</strong>{sections.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <div className="message-actions">
          <button className="icon-button" type="button" aria-label={copied ? t('Скопировано', 'Copied') : t('Скопировать ответ', 'Copy reply')}
            title={t('Скопировать', 'Copy')} onClick={() => {void copy();}}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button>
          <button className="icon-button favorite" type="button" aria-label={saved ? t('Убрать ответ', 'Unsave reply') : t('Сохранить ответ', 'Save reply')}
            aria-pressed={saved} onClick={onSave}><Bookmark size={18}/></button>
          {failed && <small role="status">{t('Буфер обмена недоступен.', 'Clipboard unavailable.')}</small>}
        </div>
      </> : message.text && <p>{message.text}</p>}
    </div>
  </m.article>;
}

export function ChatView({chat, agent, agents, draft, onDraft, onChoose, onSend, input, onAgent, onFavorite, favorite, notes, onSave, notice}: {
  chat?: Chat; agent: Assistant; agents: Assistant[]; draft: string; onDraft: (text: string) => void; onChoose: (text: string) => void;
  onSend: (text: string, attachment?: Attachment) => boolean; input: RefObject<HTMLTextAreaElement | null>; onAgent?: (id: string) => void;
  onFavorite: (id: string) => void; favorite: boolean; notes: string[]; onSave: (message: Message) => void; notice?: ReactNode;
}) {
  const t = useCopy();
  const list = useRef<HTMLDivElement>(null);
  const [readyAt, setReadyAt] = useState(Date.now);
  const newest = chat?.messages.at(-1);
  const waiting = newest?.role === 'assistant' && newest.at > readyAt;
  useEffect(() => {
    if (!newest) return;
    const timer = window.setTimeout(() => setReadyAt(Date.now()), Math.max(8, newest.at - Date.now() + 12));
    return () => window.clearTimeout(timer);
  }, [newest]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [chat?.id, chat?.messages.length, waiting]);
  return <div className="page thread">
    <header className="thread__header">
      <a className="icon-button thread__back" href="#/history" aria-label={t('К истории', 'Back to history')}><ArrowLeft size={20}/></a>
      <Avatar agent={agent}/>
      <div className="thread__identity"><h1>{agent.name}</h1><p>{chat?.title ?? agent.description}</p></div>
      <button type="button" className="icon-button favorite" aria-pressed={favorite}
        aria-label={favorite ? t('Убрать из избранного', 'Remove favorite') : t('В избранное', 'Favorite')} onClick={() => onFavorite(agent.id)}>
        <Heart size={21}/></button>
    </header>
    <div className="thread__scroller" ref={list} role="region" aria-label={t('Переписка', 'Conversation')}>
      {chat ? <div className="thread__messages" role="log" aria-live="polite">
        {chat.messages.filter(message => !waiting || message.id !== newest?.id).map(message => <ChatBubble key={message.id} message={message} agent={agent}
          saved={notes.includes(message.id)} onSave={() => onSave(message)}/>)}
        <AnimatePresence>{waiting && <m.div className="typing" role="status" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
          <Avatar agent={agent}/><div className="typing__dots" aria-hidden="true"><i/><i/><i/></div>
          <span className="sr-only">{t('Готовит ответ', 'Preparing reply')}</span>
        </m.div>}</AnimatePresence>
      </div> : <div className="thread__welcome">
        <span className="thread__sticker"><Sparkles size={37} strokeWidth={1.65}/></span>
        <h2>{t('С чего начнём?', 'Where should we start?')}</h2>
        <div className="thread__suggestions">{agent.prompts.slice(0, 3).map(prompt => <button type="button" key={prompt}
          onClick={() => onChoose(prompt)}><span>{prompt}</span><ArrowUpRight size={17}/></button>)}</div>
      </div>}
    </div>
    <div className="thread__write">
      <Composer draft={draft} onDraft={onDraft} onSend={onSend} input={input} waiting={waiting} agent={agent} agents={agents} onAgent={onAgent}/>
      {notice}
    </div>
  </div>;
}

export function SearchResults({query, agents, chats, onChoose}: {query: string; agents: Assistant[]; chats: Chat[]; onChoose: () => void}) {
  const t = useCopy();
  const term = query.trim().toLocaleLowerCase();
  const people = agents.filter(agent => !term || `${agent.name} ${agent.description}`.toLocaleLowerCase().includes(term)).slice(0, 8);
  const conversations = chats.filter(chat => !term || chat.title.toLocaleLowerCase().includes(term)).slice(0, 5);
  return <div className="search-results">
    {!!conversations.length && <div className="search-results__group">
      <h3>{t('Чаты', 'Chats')}</h3>
      {conversations.map(chat => <a key={chat.id} href={`#/chat/${chat.id}`} onClick={onChoose}><MessageCircle size={20}/><span>{chat.title}</span><ArrowRight size={16}/></a>)}
    </div>}
    {!!people.length && <div className="search-results__group">
      <h3>{t('Помощники', 'Assistants')}</h3>
      {people.map(agent => <a key={agent.id} href={`#/assistant/${agent.id}`} onClick={onChoose}><Avatar agent={agent}/><span>{agent.name}</span><ArrowRight size={16}/></a>)}
    </div>}
    {!people.length && !conversations.length && <p className="search-results__empty">{t('По этому запросу ничего нет.', 'No matches for this search.')}</p>}
  </div>;
}
