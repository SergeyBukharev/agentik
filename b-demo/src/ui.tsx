import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import {
  ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, BriefcaseBusiness, CalendarDays, Check, ChevronDown,
  Clapperboard, Code2, CookingPot, FileText, GraduationCap, Heart, Languages, Lightbulb, Palette, Paperclip,
  PenLine, Sparkles, Wallet, X,
} from 'lucide-react';
import * as m from 'motion/react-m';
import {useMotionValue, useReducedMotion, useSpring} from 'motion/react';
import {MAX_CHAT_MESSAGE_LENGTH} from '../../src/chat-contract';
import type {Assistant} from '../../src/catalog';
import type {Point} from '../../src/motion/shader';
import {attachmentAccept, readAttachment, type Attachment, type Locale} from './model';

export const LocaleContext = createContext<Locale>('ru');
export function useCopy() {
  const locale = useContext(LocaleContext);
  return (ru: string, en: string) => locale === 'ru' ? ru : en;
}

const icons = {
  PenLine, BriefcaseBusiness, Lightbulb, Languages, CookingPot, CalendarDays, GraduationCap, Code2,
  Wallet, Palette, Sparkles, Clapperboard, BookOpen,
};
const brandIcon = import.meta.env.BASE_URL + 'icon.svg';
const mascot = import.meta.env.BASE_URL + 'mascot.webp';

export function Brand({small = false}: {small?: boolean}) {
  return <a className={`brand${small ? ' brand--small' : ''}`} href="#/" aria-label="Agentik B-demo">
    <img src={brandIcon} alt="" width="40" height="40"/>
    <span>agentik</span>
    <abbr title="B-demo">B</abbr>
  </a>;
}

export function Avatar({agent, className = ''}: {agent: Pick<Assistant, 'icon' | 'color'>; className?: string}) {
  const Icon = Object.hasOwn(icons, agent.icon) ? icons[agent.icon as keyof typeof icons] : Sparkles;
  return <span className={`avatar tone--${agent.color} ${className}`} aria-hidden="true"><Icon size={21} strokeWidth={1.9}/></span>;
}

export function Hero() {
  const t = useCopy();
  const noMotion = useReducedMotion();
  const horizontal = useMotionValue(0);
  const vertical = useMotionValue(0);
  const x = useSpring(horizontal, {stiffness: 180, damping: 23});
  const y = useSpring(vertical, {stiffness: 180, damping: 23});
  const bounds = useRef<DOMRect | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const ripple = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState<Point>();
  useEffect(() => {
    if (!origin || !ready || failed || noMotion) return;
    let active = true;
    let stop: (() => void) | undefined;
    void import('../../src/motion/shader').then(({playShader}) => {
      if (active && ripple.current && image.current) {
        stop = playShader(ripple.current, {effect: 'ripple', origin, duration: 920, image: image.current});
      }
    }).catch(() => {});
    return () => {active = false; stop?.();};
  }, [origin, ready, failed, noMotion]);

  return <section className="hero"
    onPointerEnter={event => {
      if (event.pointerType !== 'mouse' || noMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      bounds.current = event.currentTarget.getBoundingClientRect();
      setOrigin({x: event.clientX, y: event.clientY});
    }}
    onPointerMove={event => {
      const rect = bounds.current;
      if (!rect || noMotion || event.pointerType !== 'mouse') return;
      horizontal.set((2 * (event.clientX - rect.left) / rect.width - 1) * 15);
      vertical.set((2 * (event.clientY - rect.top) / rect.height - 1) * 11);
    }}
    onPointerLeave={() => {bounds.current = null; horizontal.set(0); vertical.set(0);}}>
    <div className="hero__copy">
      <h1>{t('Что сегодня', 'What are we')}<br/>{t('придумаем?', 'making today?')}</h1>
      <p>{t('Обсуди идею, набросай текст или разложи сложную задачу по шагам.', 'Talk through an idea, draft a text or break down a tricky task.')}</p>
      <a className="button hero__action" href="#/new">{t('Открыть чат', 'Open chat')}<ArrowUpRight size={18}/></a>
    </div>
    <div className="hero__image-frame">
      <span className="hero__orbit" aria-hidden="true"/>
      <m.a className="hero__artwork" href="#/new" aria-label={t('Войти в студию через иллюстрацию', 'Enter the studio from the illustration')}
        style={noMotion ? undefined : {x, y}} whileTap={{scale: .98}}>
        <img ref={image} className={failed ? 'hero__art hero__art--mark' : 'hero__art'} src={failed ? brandIcon : mascot}
          alt="" width="800" height="600" fetchPriority="high" draggable={false}
          onLoad={() => setReady(true)} onError={failed ? undefined : () => setFailed(true)}/>
        {origin && <canvas ref={ripple} className="hero__ripple" width="1" height="1" data-effect="ripple" aria-hidden="true"/>}
        <span className="hero__enter" aria-hidden="true"><ArrowUpRight size={21}/></span>
      </m.a>
    </div>
  </section>;
}

const choices = [
  {id: 'ideas', Icon: Sparkles, tone: 'lavender', ru: ['Придумать', 'Идеи для проекта или поста', 'Помоги придумать идеи для проекта'], en: ['Brainstorm', 'Ideas for a project or post', 'Help me brainstorm ideas for a project']},
  {id: 'writer', Icon: PenLine, tone: 'peach', ru: ['Написать', 'Письмо, пост или сценарий', 'Помоги написать первый черновик'], en: ['Write', 'A letter, post or script', 'Help me write a first draft']},
  {id: 'planner', Icon: CalendarDays, tone: 'lime', ru: ['Спланировать', 'Разложить дела по шагам', 'Помоги составить план на завтра'], en: ['Make a plan', 'Break a task into steps', 'Help me make a plan for tomorrow']},
  {id: 'code', Icon: Code2, tone: 'blue', ru: ['Разобрать код', 'Понять ошибку или решение', 'Помоги разобраться, почему мой код не работает'], en: ['Work on code', 'Understand a bug or solution', 'Help me figure out why my code isn’t working']},
] as const;
const press = {scale: .96};
const spring = {type: 'spring', stiffness: 360, damping: 26} as const;

export function QuickStart({onChoose}: {onChoose: (id: string, prompt: string) => void}) {
  const locale = useContext(LocaleContext);
  const t = useCopy();
  return <section className="stack">
    <div className="section-row"><h2>{t('Быстрый старт', 'Quick start')}</h2></div>
    <div className="choices">
      {choices.map(({id, Icon, tone, ...labels}) => {
        const [title, description, prompt] = labels[locale];
        return <m.button key={id} type="button" className={`choice tone--${tone}`} whileHover={{y: -4}} whileTap={press}
          transition={spring} onClick={() => onChoose(id, prompt)}>
          <span className="choice__top"><span className="choice__icon"><Icon size={23}/></span><ArrowUpRight className="choice__arrow" size={18}/></span>
          <strong>{title}</strong><span className="choice__description">{description}</span>
        </m.button>;
      })}
    </div>
  </section>;
}

export function AgentCard({agent, favorite, onFavorite}: {agent: Assistant; favorite: boolean; onFavorite: (id: string) => void}) {
  const t = useCopy();
  return <article className="agent">
    <div className="agent__top">
      <Avatar agent={agent}/>
      <m.button type="button" className="icon-button favorite" whileTap={press} transition={spring}
        aria-label={t(favorite ? `Убрать из избранного: ${agent.name}` : `В избранное: ${agent.name}`,
          favorite ? `Remove favorite: ${agent.name}` : `Favorite: ${agent.name}`)}
        aria-pressed={favorite} onClick={() => onFavorite(agent.id)}><Heart size={19}/></m.button>
    </div>
    <a className="agent__link" href={`#/assistant/${agent.id}`}>
      <strong>{agent.name}</strong><p>{agent.description}</p><ArrowUpRight size={18} aria-hidden="true"/>
    </a>
  </article>;
}

export function AttachmentChip({attachment, onRemove}: {attachment: Attachment; onRemove?: () => void}) {
  const t = useCopy();
  return <div className="attachment">
    {attachment.kind === 'image' ? <img src={attachment.value.url} alt="" width="30" height="30"/> : <FileText size={18}/>}
    <span>{attachment.value.name}</span>
    {onRemove && <button className="icon-button" type="button" onClick={onRemove} aria-label={t('Убрать вложение', 'Remove attachment')}><X size={15}/></button>}
  </div>;
}

function Picker({agents, agent, onAgent}: {agents: Assistant[]; agent: Assistant; onAgent: (id: string) => void}) {
  const t = useCopy();
  return <Select.Root value={agent.id} onValueChange={onAgent}>
    <Select.Trigger className="picker" aria-label={t('Выбрать помощника', 'Choose an assistant')}>
      <Avatar agent={agent}/><Select.Value/><Select.Icon asChild><ChevronDown size={15}/></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="select-menu" position="popper" sideOffset={7} collisionPadding={12}>
        <Select.ScrollUpButton className="select-menu__scroll"><ChevronDown size={16} style={{rotate: '180deg'}}/></Select.ScrollUpButton>
        <Select.Viewport>
          {agents.map(item => <Select.Item className="select-menu__item" value={item.id} key={item.id}>
            <Avatar agent={item}/><Select.ItemText>{item.name}</Select.ItemText>
            <Select.ItemIndicator><Check size={17}/></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
        <Select.ScrollDownButton className="select-menu__scroll"><ArrowDown size={16}/></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}

export function Composer({draft, onDraft, onSend, agent, agents, onAgent, input, waiting = false, floating = false}: {
  draft: string; onDraft: (value: string) => void; onSend: (value: string, attachment?: Attachment) => boolean;
  agent: Assistant; agents: Assistant[]; onAgent?: (id: string) => void;
  input: RefObject<HTMLTextAreaElement | null>; waiting?: boolean; floating?: boolean;
}) {
  const t = useCopy();
  const file = useRef<HTMLInputElement>(null);
  const reading = useRef(false);
  const [attachment, setAttachment] = useState<Attachment>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field || CSS.supports('field-sizing', 'content')) return;
    field.style.height = '0px';
    field.style.height = field.scrollHeight + 'px';
  }, [draft, input]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (waiting || reading.current) return;
    const clean = draft.trim();
    if (!clean && !attachment) {
      setError(t('Напиши сообщение или прикрепи файл.', 'Write a message or attach a file.'));
      input.current?.focus();
      return;
    }
    setError('');
    if (onSend(clean, attachment)) setAttachment(undefined);
  }

  async function attach(picked?: File) {
    if (!picked || reading.current) return;
    setError('');
    setLoading(true);
    reading.current = true;
    try { setAttachment(await readAttachment(picked)); }
    catch { setError(t('Выбери изображение или непустой текстовый файл до 1 МБ.', 'Choose an image or a non-empty text file up to 1 MB.')); }
    finally { reading.current = false; setLoading(false); }
  }

  return <form className={`composer${floating ? ' composer--float' : ''}`} onSubmit={submit}>
    {attachment && <AttachmentChip attachment={attachment} onRemove={() => setAttachment(undefined)}/>}
    <textarea ref={input} aria-label={t('Сообщение', 'Message')} placeholder={t('Напиши, что нужно…', 'Tell me what you need…')}
      rows={1} maxLength={MAX_CHAT_MESSAGE_LENGTH} value={draft} enterKeyHint="send"
      aria-invalid={error ? true : undefined}
      onChange={event => {onDraft(event.target.value); if (error) setError('');}}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) submit(event);
      }}/>
    {error && <p className="composer__error" role="alert">{error}</p>}
    <div className="composer__actions">
      <input ref={file} type="file" hidden accept={attachmentAccept} onChange={event => {
        const selected = event.target.files?.[0];
        event.target.value = '';
        void attach(selected);
      }}/>
      <button className="icon-button composer__attach" type="button" onClick={() => file.current?.click()} disabled={loading}
        aria-label={t('Прикрепить файл', 'Attach a file')} title={t('Прикрепить файл', 'Attach a file')}><Paperclip size={20}/></button>
      {onAgent && <Picker agents={agents} agent={agent} onAgent={onAgent}/>}
      <span className="composer__placeholder" aria-hidden="true"/>
      <m.button className="composer__send" type="submit" whileTap={press} transition={spring}
        aria-label={t('Отправить', 'Send')} title={t('Отправить', 'Send')} disabled={waiting || loading}>
        <ArrowUp size={22} strokeWidth={2.5}/>
      </m.button>
    </div>
  </form>;
}

export function Modal({open, onOpenChange, title, children, extra = ''}: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; extra?: string;
}) {
  const t = useCopy();
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-scrim"/>
      <Dialog.Content className={`dialog ${extra}`} aria-describedby={undefined}
        onOpenAutoFocus={() => {opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;}}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus({preventScroll: true});
        }}>
        <header className="dialog__head"><Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className="icon-button" aria-label={t('Закрыть', 'Close')}><X size={22}/></Dialog.Close>
        </header>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function Empty({title, description, action}: {title: string; description: string; action?: {href: string; label: string}}) {
  return <div className="empty">
    <span className="empty__icon"><Sparkles size={27}/></span>
    <h2>{title}</h2><p>{description}</p>
    {action && <a className="button button--link" href={action.href}>{action.label}<ArrowRight size={16}/></a>}
  </div>;
}
