import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';
import {ArrowDownLeft, ArrowUpRight, Bot, FileText, ImagePlus, Mic, Send, UserRound, X} from 'lucide-react';
import {MAX_CHAT_MESSAGE_LENGTH, type ChatDocument} from '../chat-contract';
import type {ChatDraftAttachment} from '../chat-drafts';
import {CHAT_MODELS, prepareChatImage, type ChatImage, type ChatModel} from '../chat-media';
import {useUi, type Language} from '../language';
import {normalizeRoomMentionHandle, type RoomMention} from '../local-rooms';
import {useDictation} from '../useDictation';
import {AgentSelect} from './AgentSelect';
import {Tooltip} from './Tooltip';
import {ModelIcon} from './ModelIcon';

const modelLabels: Record<ChatModel, [string, string]> = {
  auto: ['Авто', 'Auto'],
  chatgpt: ['ChatGPT', 'ChatGPT'],
  deepseek: ['DeepSeek', 'DeepSeek'],
  alice: ['Алиса AI', 'Alice AI'],
};

export function MessageImages({images}: {images?: ChatImage[]}) {
  if (!images?.length) return null;
  return <div className="chat-images">{images.map(image =>
    <a key={image.id} href={image.url} download={image.name} className="chat-images__item">
      <img src={image.url} alt={image.name} loading="lazy" decoding="async"/>
    </a>
  )}</div>;
}

export function DocumentLabel({file}: {file: ChatDocument}) {
  const {t} = useUi();
  return <span className="chat-document">
    <FileText size={16} aria-hidden="true"/>
    <span className="chat-document__name" title={file.name}>{file.name}</span>
    {file.truncated && <small>{t('Фрагмент', 'Excerpt')}</small>}
  </span>;
}

function DictationLetters({text}: {text: string}) {
  // Bound the number of animated glyphs even for a full-length draft.
  if (text.length > 96) return <span className="composer__dictation-passage">{text}</span>;
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity:'grapheme'}) : undefined;
  const words = text.split(/(\s+)/u);
  const graphemes = words.map(word => segmenter ? Array.from(segmenter.segment(word), part => part.segment) : Array.from(word));
  if (graphemes.flat().length > 32 || graphemes.some(word => word.length > 14)) {
    return <span className="composer__dictation-passage">{text}</span>;
  }

  let index = 0;
  return graphemes.map((letters, wordIndex) => {
    const word = words[wordIndex];
    if (/^\s*$/u.test(word)) return word;
    return <span className="composer__dictation-word" key={wordIndex}>{letters.map((letter, letterIndex) => (
      <span className="composer__dictation-letter" key={letterIndex}
        style={{'--letter-delay': `${index++ * 15}ms`} as CSSProperties}>{letter}</span>
    ))}</span>;
  });
}

function mentionAt(text: string, caret: number) {
  const match = /(?:^|[^\p{L}\p{M}\p{N}_@.+%\/-])@([\p{L}\p{M}\p{N}_-]*)$/u.exec(text.slice(0, caret));
  if (!match) return undefined;
  const remainder = /^[\p{L}\p{M}\p{N}_-]*/u.exec(text.slice(caret))?.[0] ?? '';
  return {start:caret - match[1].length - 1,end:caret + remainder.length,query:normalizeRoomMentionHandle(match[1])};
}

export function ChatComposer({draft, onDraft, onSubmit, onValidate, messageId = 'message', language, busy = false, disabled = false,
  model, onModel, fieldRef, price, retryDraft = false, attachment, onRemoveAttachment, mentions}: {
    draft: string;
    onDraft: (text: string) => void;
    onSubmit: (images: ChatImage[], anchor: HTMLElement | null) => boolean | Promise<boolean>;
    onValidate?: (message: string) => void;
    messageId?: string;
    language?: Language;
    busy?: boolean;
    disabled?: boolean;
    model?: ChatModel;
    onModel?: (model: ChatModel) => void;
    fieldRef?: RefObject<HTMLTextAreaElement | null>;
    price?:number;
    retryDraft?:boolean;
    attachment?: ChatDraftAttachment;
    onRemoveAttachment?: () => void;
    mentions?: readonly RoomMention[];
}) {
  const ui = useUi();
  const lang = language ?? ui.language;
  const t = (ru: string, en: string) => lang === 'en' ? en : ru;
  const input = useRef<HTMLInputElement>(null);
  const fallbackField = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? fallbackField;
  const sendButton = useRef<HTMLButtonElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const recordingPointer = useRef<number | null>(null);
  const recordingSpace = useRef(false);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const locked = busy || sending;
  const [uploadedImage, setImage] = useState<ChatImage>();
  const image = uploadedImage ?? (attachment?.kind === 'image' ? attachment.image : undefined);
  const attachedDocument = attachment?.kind === 'document' ? attachment.document : undefined;
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('');
  const [required, setRequired] = useState(false);
  const [mentionCaret, setMentionCaret] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const insertedCaret = useRef<number | null>(null);
  const chosenMention = useRef<{text:string; caret:number} | undefined>(undefined);
  const mentionMenu = useRef<HTMLDivElement>(null);
  const mention = !locked && !disabled && mentions?.length && mentionCaret !== null ? mentionAt(draft, mentionCaret) : undefined;
  const mentionsOpen = Boolean(mention);
  const matchingMentions = mention && mentions
    ? mentions.filter(item => item.handle.includes(mention.query) || normalizeRoomMentionHandle(item.name).includes(mention.query))
    : [];
  const selectedMention = Math.min(mentionIndex, matchingMentions.length - 1);
  const mentionListId = messageId + '-mentions';
  const [transcript, setTranscript] = useState<{prefix:string; text:string; animate:boolean; plain?:boolean}>();
  const inserted = transcript && transcript.prefix + transcript.text === draft ? transcript : undefined;
  const reveal = inserted?.animate;
  const microphone = useDictation(lang, text => {
    const prefix = draft.trimEnd();
    const next = [prefix, text].filter(Boolean).join(' ').slice(0, MAX_CHAT_MESSAGE_LENGTH);
    onDraft(next);
    setHint('');
    setRequired(false);
    if (next.length > prefix.length) {
      setTranscript({prefix,text:next.slice(prefix.length),animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});
    }
  }, issue => setHint({
    unsupported: t('Этот браузер не поддерживает диктовку.', 'Dictation is unavailable in this browser.'),
    permission: t('Разрешите доступ к микрофону в браузере.', 'Allow microphone access in the browser.'),
    offline: t('Для распознавания речи нужен интернет.', 'Speech recognition needs an internet connection.'),
    'no-speech': t('Речь не распознана. Попробуйте ещё раз.', 'No speech was recognised. Try again.'),
    failed: t('Не удалось распознать речь. Попробуйте ещё раз.', 'Dictation failed. Try again.'),
  }[issue]), locked || disabled);
  const recording = microphone.phase === 'listening';
  const microphoneLabel = t('Удерживайте для диктовки', 'Hold to dictate');
  const expandLabel = expanded ? t('Уменьшить поле сообщения', 'Shrink message field') : t('Увеличить поле сообщения', 'Expand message field');
  const placeholder = attachedDocument ? t('Что нужно изменить?', 'What should change?')
    : mentions?.length ? t('Сообщение или @ для упоминания…', 'Write a message or type @ to mention…')
    : t('Напишите сообщение…', 'Write a message…');

  function chooseMention(target: RoomMention) {
    if (!mention) return;
    const suffix = draft.slice(mention.end);
    const space = suffix && /^[\s,.;!?)}\]]/u.test(suffix) ? '' : ' ';
    const replacement = '@' + target.handle + space;
    const next = draft.slice(0, mention.start) + replacement + suffix;
    if (next.length > MAX_CHAT_MESSAGE_LENGTH) {
      setHint(t('Сократите сообщение, чтобы добавить упоминание.', 'Shorten the message to add a mention.'));
      return;
    }
    insertedCaret.current = mention.start + replacement.length + (suffix.startsWith(' ') ? 1 : 0);
    chosenMention.current = {text:next,caret:insertedCaret.current};
    field.current?.focus({preventScroll:true});
    setMentionCaret(null);
    setMentionIndex(0);
    setHint('');
    setRequired(false);
    setTranscript(undefined);
    onDraft(next);
  }

  useLayoutEffect(() => {
    if (insertedCaret.current === null) return;
    field.current?.setSelectionRange(insertedCaret.current, insertedCaret.current);
    insertedCaret.current = null;
  });

  useLayoutEffect(() => {
    const menu = mentionMenu.current;
    const editor = menu?.parentElement;
    if (!mentionsOpen || !menu || !editor) return;
    const viewport = window.visualViewport;
    let pendingLayout = 0;
    const place = () => {
      pendingLayout = 0;
      const viewTop = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const editorTop = editor.getBoundingClientRect().top;
      const spaceAbove = editorTop - viewTop - 18;
      const overlap = spaceAbove < 56;
      menu.toggleAttribute('data-overlap',overlap);
      menu.style.setProperty('--mention-space', (overlap ? Math.max(0,height - 12) : spaceAbove) + 'px');
      if (overlap) menu.style.setProperty('--mention-top', viewTop - editorTop + 6 + 'px');
    };
    const schedule = () => {
      if (!pendingLayout) pendingLayout = requestAnimationFrame(place);
    };
    place();
    viewport?.addEventListener('resize',schedule);
    viewport?.addEventListener('scroll',schedule);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    return () => {
      cancelAnimationFrame(pendingLayout);
      viewport?.removeEventListener('resize',schedule);
      viewport?.removeEventListener('scroll',schedule);
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
    };
  },[mentionsOpen]);

  useLayoutEffect(() => {
    const editor = field.current;
    if (!inserted || !editor) return;
    editor.scrollTop = editor.scrollHeight;
    const layer = preview.current;
    const alignPreview = () => {
      if (!layer) return;
      layer.style.inlineSize = editor.clientWidth + 'px';
      layer.style.blockSize = editor.clientHeight + 'px';
      // Match the native text wrapping on scrollable drafts.
      if (!inserted.plain && layer.querySelector('.composer__dictation-letter') &&
          (editor.scrollHeight > editor.clientHeight || layer.scrollHeight > layer.clientHeight)) {
        setTranscript({...inserted,plain:true});
        return;
      }
      layer.scrollTop = editor.scrollTop;
    };
    alignPreview();
    const resize = layer && typeof ResizeObserver === 'function' ? new ResizeObserver(alignPreview) : undefined;
    resize?.observe(editor);
    const timer = window.setTimeout(() => setTranscript(undefined), 1000);
    return () => {window.clearTimeout(timer); resize?.disconnect();};
  }, [field, inserted]);

  useEffect(() => {
    const editor = field.current;
    const viewport = window.visualViewport;
    if (!editor || !viewport) return;
    const root = document.documentElement;
    let focusWidth = 0;
    let focusHeight = 0;
    let previousInset = -1;
    const update = () => {
      if (focusWidth !== window.innerWidth) {
        focusWidth = window.innerWidth;
        focusHeight = window.innerHeight;
      }
      const obscured = window.innerHeight - viewport.height;
      // Some browsers shrink only the visual viewport when the keyboard opens.
      const keyboard = Math.abs(viewport.scale - 1) < .02 &&
        Math.max(obscured, focusHeight - window.innerHeight) > 100;
      const inset = keyboard ? Math.max(0, Math.round(obscured - viewport.offsetTop)) : -1;
      if (!keyboard && document.activeElement !== editor) {
        stop();
        return;
      }
      if (inset === previousInset) return;
      previousInset = inset;
      root.toggleAttribute('data-composer-keyboard', keyboard);
      if (keyboard) root.style.setProperty('--composer-keyboard-inset', inset + 'px');
      else root.style.removeProperty('--composer-keyboard-inset');
    };
    const start = () => {
      if (previousInset < 0) {
        focusWidth = window.innerWidth;
        focusHeight = window.innerHeight;
      }
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
      update();
    };
    const stop = () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      if (previousInset < 0) return;
      previousInset = -1;
      root.removeAttribute('data-composer-keyboard');
      root.style.removeProperty('--composer-keyboard-inset');
    };
    // Keep the send button in place as a tap transfers focus away from the editor.
    const blur = () => {if (previousInset < 0) stop();};
    editor.addEventListener('focus', start);
    editor.addEventListener('blur', blur);
    if (document.activeElement === editor) start();
    return () => {
      editor.removeEventListener('focus', start);
      editor.removeEventListener('blur', blur);
      stop();
    };
  }, [field]);

  function releasePointer(pointerId: number) {
    if (recordingPointer.current !== pointerId) return;
    recordingPointer.current = null;
    microphone.stop();
  }

  function releaseSpace() {
    if (!recordingSpace.current) return;
    recordingSpace.current = false;
    microphone.stop();
  }

  const sendPrice = retryDraft && !image ? 0 : price;

  async function submit() {
    if (submitting.current || busy || disabled || loading || microphone.phase !== 'idle') return;
    if (!draft.trim() && (attachedDocument || !image)) {
      const message = attachedDocument ? t('Укажите, что изменить в файле.', 'Describe what to change in the file.')
        : t('Напишите сообщение или прикрепите изображение.', 'Write a message or attach an image.');
      setHint(message);
      setRequired(true);
      onValidate?.(message);
      field.current?.focus();
      return;
    }
    submitting.current = true;
    setSending(true);
    try {
      if (await onSubmit(image ? [image] : [], sendButton.current)) {
        setImage(undefined);
        setHint('');
        setRequired(false);
        setTranscript(undefined);
      }
    } catch {
      setHint(t('Сообщение не удалось отправить. Попробуйте ещё раз.','Could not send the message. Try again.'));
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  async function attach(file?: File) {
    if (!file) return;
    setLoading(true);
    setHint('');
    setRequired(false);
    try {
      setImage(await prepareChatImage(file));
      if (attachment?.kind === 'image') onRemoveAttachment?.();
    }
    catch { setHint(t('Выберите PNG, JPEG, WebP, AVIF или GIF до 12 МБ.', 'Choose a PNG, JPEG, WebP, AVIF or GIF up to 12 MB.')); }
    finally { setLoading(false); }
  }

  return (
    <div className="composer-stack">
      <span className="sr-only" role="status">{inserted ? t('Диктовка добавлена в черновик.','Dictation added to the draft.') : ''}</span>
      {hint && <p className="composer__hint notice notice--error" id={messageId+'-hint'} role="alert">{hint}</p>}
      <form className="composer composer--tools" onSubmit={event => {event.preventDefault(); void submit();}} noValidate>
        {attachedDocument && <div className="composer__document">
          <DocumentLabel file={attachedDocument}/>
          <button type="button" className="icon-button" disabled={locked} aria-label={t('Убрать файл из черновика', 'Remove file from draft')}
            onClick={() => {
              onRemoveAttachment?.();
              setHint('');
              setRequired(false);
              field.current?.focus({preventScroll:true});
            }}><X size={17} aria-hidden="true"/></button>
        </div>}
        {image && <div className="composer__attachment"><img src={image.url} alt=""/><span>{image.name}</span>
          <button type="button" className="icon-button" disabled={locked} onClick={() => {
            setImage(undefined);
            if (attachment?.kind === 'image') onRemoveAttachment?.();
          }} aria-label={t('Удалить изображение', 'Remove image')}><X size={17}/></button></div>}
        <label htmlFor={messageId} className="sr-only">{messageId === 'room-message' ? t('Сообщение участникам','Message to members') : t('Ваше сообщение','Your message')}</label>
        <div className="composer__editor">
          {mention && <div ref={mentionMenu} className="composer__mentions" id={mentionListId} role="listbox" aria-label={t('Упоминания', 'Mentions')}>
            {matchingMentions.length ? matchingMentions.map((target, index) => {
              const Icon = target.kind === 'bot' ? Bot : UserRound;
              return <button key={target.kind + ':' + target.id} type="button" role="option" tabIndex={-1}
                id={mentionListId + '-' + index} aria-selected={index === selectedMention} className="composer__mention"
                onPointerDown={event => event.preventDefault()} onClick={() => chooseMention(target)}>
                <Icon size={18} aria-hidden="true"/>
                <span><strong>{target.name}</strong><small>@{target.handle}</small></span>
                {target.kind === 'bot' && <span className="composer__mention-type">{t('Бот', 'Bot')}</span>}
              </button>;
            }) : <p className="composer__mentions-empty">{t('Никого не нашли', 'No matches')}</p>}
          </div>}
          <div className="composer__field">
            <textarea id={messageId} ref={field} className="composer__input" placeholder={placeholder}
              data-expanded={expanded} value={draft} maxLength={MAX_CHAT_MESSAGE_LENGTH} readOnly={locked} aria-invalid={required || undefined}
              data-dictation-reveal={reveal || undefined} aria-describedby={hint ? messageId+'-hint' : undefined}
              aria-autocomplete={mentions?.length ? 'list' : undefined} aria-controls={mention ? mentionListId : undefined}
              aria-activedescendant={selectedMention >= 0 ? mentionListId + '-' + selectedMention : undefined}
              onChange={event => {
                if (mentions) {
                  chosenMention.current = undefined;
                  setMentionCaret(event.currentTarget.selectionStart);
                  setMentionIndex(0);
                }
                setTranscript(undefined);
                onDraft(event.target.value);
                if (required) {setRequired(false); setHint('');}
              }}
              onSelect={event => {
                if (mentions) {
                  const editor = event.currentTarget;
                  if (chosenMention.current?.text === editor.value && chosenMention.current.caret === editor.selectionStart) return;
                  setMentionCaret(editor.selectionStart === editor.selectionEnd ? editor.selectionStart : null);
                }
              }}
              onBlur={() => setMentionCaret(null)}
              onPointerDown={() => setTranscript(undefined)}
              onScroll={event => {if (preview.current) preview.current.scrollTop = event.currentTarget.scrollTop;}}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (mention && event.key === 'Escape') {
                  event.preventDefault();
                  setMentionCaret(null);
                  return;
                }
                if (selectedMention >= 0 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                  event.preventDefault();
                  const length = matchingMentions.length;
                  const index = (selectedMention + (event.key === 'ArrowDown' ? 1 : -1) + length) % length;
                  setMentionIndex(index);
                  const menu = mentionMenu.current;
                  const option = document.getElementById(mentionListId + '-' + index);
                  if (menu && option) {
                    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
                    else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
                      menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
                    }
                  }
                  return;
                }
                if (selectedMention >= 0 && !event.shiftKey && (event.key === 'Enter' || event.key === 'Tab')) {
                  event.preventDefault();
                  chooseMention(matchingMentions[selectedMention]);
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault(); void submit();
                }
              }}/>
            {reveal && <div className="composer__dictation-preview" aria-hidden="true" ref={preview}>
              {inserted.prefix}{inserted.plain
                ? <span className="composer__dictation-passage" key={draft}>{inserted.text}</span>
                : <DictationLetters key={draft} text={inserted.text}/>}
            </div>}
          </div>
          <Tooltip label={expandLabel}>
            <button type="button" className="icon-button composer__expand" aria-label={expandLabel}
              aria-controls={messageId} aria-expanded={expanded} onClick={() => setExpanded(current => !current)}>
              {expanded ? <ArrowDownLeft size={18} aria-hidden="true"/> : <ArrowUpRight size={18} aria-hidden="true"/>}
            </button>
          </Tooltip>
        </div>
        <div className="composer__toolbar">
          <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void attach(file);}}/>
          <Tooltip label={t('Прикрепить изображение', 'Attach image')}>
            <button type="button" className="icon-button" disabled={locked || loading} onClick={() => input.current?.click()}
              aria-label={t('Прикрепить изображение', 'Attach image')}><ImagePlus size={20}/></button>
          </Tooltip>
          {model && onModel && <div className="composer__model">
            <AgentSelect label={t('Модель', 'Model')} value={model} disabled={locked} side="top" onChange={onModel}
              options={CHAT_MODELS.map(value => ({
                value,
                label: t(...modelLabels[value]),
                icon: <ModelIcon model={value}/>,
              }))}/>
          </div>}
          {loading && <span className="composer__preparing" role="status">{t('Загрузка…','Loading…')}</span>}
          <Tooltip label={microphoneLabel+' · K / Alt+K'}>
            <button type="button" className="icon-button composer__mic" data-recording={recording}
              disabled={locked || disabled} aria-label={microphoneLabel} aria-pressed={recording}
              onContextMenu={event => event.preventDefault()}
              onPointerDown={event => {
                if (event.button !== 0 || recordingPointer.current !== null) return;
                event.preventDefault();
                if (microphone.start()) {
                  recordingPointer.current = event.pointerId;
                  try {event.currentTarget.setPointerCapture?.(event.pointerId);} catch {}
                }
              }}
              onPointerUp={event => releasePointer(event.pointerId)}
              onPointerCancel={event => releasePointer(event.pointerId)}
              onLostPointerCapture={event => releasePointer(event.pointerId)}
              onBlur={releaseSpace}
              onKeyDown={event => {
                if (event.key !== ' ') return;
                event.preventDefault();
                if (!event.repeat && microphone.start()) recordingSpace.current = true;
              }}
              onKeyUp={event => {
                if (event.key !== ' ') return;
                event.preventDefault();
                releaseSpace();
              }}>
              <span className="composer__mic-waves" aria-hidden="true"/><Mic size={19} aria-hidden="true"/>
            </button>
          </Tooltip>
          <div className="composer__send-group">
            {sendPrice !== undefined && <span id={messageId+'-price'} data-send-price className="composer__price"
              title={t('Стоимость отправки в демотокенах','Cost in demo tokens')}>
              {sendPrice===1 ? t('1 токен','1 token') : t('0 токенов','0 tokens')}
            </span>}
            <button ref={sendButton} className="composer__send" aria-label={messageId === 'room-message' ? t('Отправить участникам','Send to members') : t('Отправить сообщение','Send message')}
            aria-describedby={sendPrice===undefined ? undefined : messageId+'-price'}
            disabled={locked || disabled || loading || microphone.phase !== 'idle'}><Send size={19}/></button>
          </div>
        </div>
      </form>
    </div>
  );
}
