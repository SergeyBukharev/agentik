import {useRef, useState, type CSSProperties, type RefObject} from 'react';
import {ImagePlus, Mic, Send, X} from 'lucide-react';
import {MAX_CHAT_MESSAGE_LENGTH} from '../chat-contract';
import {CHAT_MODELS, prepareChatImage, type ChatImage, type ChatModel} from '../chat-media';
import {useUi, type Language} from '../language';
import {useDictation} from '../useDictation';
import {AgentSelect} from './AgentSelect';
import {ModelIcon} from './ModelIcon';

export function MessageImages({images}: {images?: ChatImage[]}) {
  if (!images?.length) return null;
  return <div className="chat-images">{images.map(image =>
    <a key={image.id} href={image.url} download={image.name} className="chat-images__item">
      <img src={image.url} alt={image.name} loading="lazy" decoding="async"/>
    </a>
  )}</div>;
}

function Transcript({text}: {text: string}) {
  let index = 0;
  return <span className="transcript" role="status"><span className="sr-only">{text}</span>
    <span aria-hidden="true">{text.split(/(\s+)/).map((word, wordIndex) => (
      /^\s+$/.test(word) ? word : <span className="transcript__word" key={wordIndex}>{Array.from(word).map((letter, letterIndex) => (
        <span className="transcript__letter" key={letterIndex} style={{'--letter-delay': Math.min(index++, 37) * 13 + 'ms'} as CSSProperties}>{letter}</span>
      ))}</span>
    ))}</span>
  </span>;
}

export function ChatComposer({draft, onDraft, onSubmit, onValidate, messageId = 'message', language, busy = false, disabled = false,
  model, onModel, fieldRef, price, retryDraft = false}: {
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
}) {
  const ui = useUi();
  const lang = language ?? ui.language;
  const t = (ru: string, en: string) => lang === 'en' ? en : ru;
  const input = useRef<HTMLInputElement>(null);
  const fallbackField = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? fallbackField;
  const sendButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const locked = busy || sending;
  const [image, setImage] = useState<ChatImage>();
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('');
  const [required, setRequired] = useState(false);
  const [transcript, setTranscript] = useState<{text:string; id:number}>();
  const sequence = useRef(0);
  const microphone = useDictation(lang, text => {
    const next = [draft.trimEnd(), text].filter(Boolean).join(' ').slice(0, MAX_CHAT_MESSAGE_LENGTH);
    onDraft(next);
    setHint('');
    setRequired(false);
    setTranscript({text: text.slice(0, 128), id:++sequence.current});
  }, issue => setHint({
    unsupported: t('Этот браузер не поддерживает диктовку.', 'Dictation is unavailable in this browser.'),
    permission: t('Разрешите доступ к микрофону в браузере.', 'Allow microphone access in the browser.'),
    offline: t('Для распознавания речи нужен интернет.', 'Speech recognition needs an internet connection.'),
    'no-speech': t('Речь не распознана. Попробуйте ещё раз.', 'No speech was recognised. Try again.'),
    failed: t('Не удалось распознать речь. Попробуйте ещё раз.', 'Dictation failed. Try again.'),
  }[issue]), locked || disabled);
  const recording = microphone.phase === 'listening';
  const microphoneLabel = t('Удерживайте для диктовки', 'Hold to dictate');

  const sendPrice = retryDraft && !image ? 0 : price;

  async function submit() {
    if (submitting.current || busy || disabled || loading || microphone.phase !== 'idle') return;
    if (!draft.trim() && !image) {
      const message = t('Напишите сообщение или прикрепите изображение.', 'Write a message or attach an image.');
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
    try { setImage(await prepareChatImage(file)); }
    catch { setHint(t('Выберите PNG, JPEG, WebP, AVIF или GIF до 12 МБ.', 'Choose a PNG, JPEG, WebP, AVIF or GIF up to 12 MB.')); }
    finally { setLoading(false); }
  }

  return (
    <div className="composer-stack">
      {transcript && <Transcript key={transcript.id} text={transcript.text}/>}
      {hint && <p className="composer__hint notice notice--error" id={messageId+'-hint'} role="alert">{hint}</p>}
      <form className="composer composer--tools" onSubmit={event => {event.preventDefault(); void submit();}} noValidate>
        {image && <div className="composer__attachment"><img src={image.url} alt=""/><span>{image.name}</span>
          <button type="button" className="icon-button" disabled={locked} onClick={() => setImage(undefined)} aria-label={t('Удалить изображение', 'Remove image')}><X size={17}/></button></div>}
        <label htmlFor={messageId} className="sr-only">{messageId === 'room-message' ? t('Сообщение участникам','Message to members') : t('Ваше сообщение','Your message')}</label>
        <textarea id={messageId} ref={field} className="composer__input" placeholder={t('Напишите сообщение…', 'Write a message…')}
          value={draft} maxLength={MAX_CHAT_MESSAGE_LENGTH} readOnly={locked} aria-invalid={required || undefined}
          aria-describedby={hint ? messageId+'-hint' : undefined}
          onChange={event => {onDraft(event.target.value); if(required) {setRequired(false); setHint('');}}}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault(); void submit();
            }
          }}/>
        <div className="composer__toolbar">
          <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void attach(file);}}/>
          <button type="button" className="icon-button" disabled={locked || loading} onClick={() => input.current?.click()} aria-label={t('Прикрепить изображение', 'Attach image')} title={t('Прикрепить изображение', 'Attach image')}><ImagePlus size={20}/></button>
          {model && onModel && <div className="composer__model">
            <AgentSelect label={t('Модель', 'Model')} value={model} disabled={locked} side="top" onChange={onModel}
              options={CHAT_MODELS.map(value => ({
                value,
                label: value === 'auto' ? t('Авто', 'Auto') : value === 'chatgpt' ? 'ChatGPT' : 'DeepSeek',
                icon: <ModelIcon model={value}/>,
              }))}/>
          </div>}
          {loading && <span className="composer__preparing" role="status">{t('Загрузка…','Loading…')}</span>}
          <button type="button" className="icon-button composer__mic" data-recording={recording}
            disabled={locked || disabled} aria-label={microphoneLabel} aria-pressed={recording}
            title={microphoneLabel+' · K / Alt+K'}
            onPointerDown={event => {
              if (event.button !== 0) return;
              if (microphone.start()) {
                try {event.currentTarget.setPointerCapture?.(event.pointerId);} catch {}
              }
            }}
            onPointerUp={microphone.stop} onPointerCancel={microphone.stop} onLostPointerCapture={microphone.stop}
            onKeyDown={event => {if (event.key === ' ' && !event.repeat) { event.preventDefault(); microphone.start(); }}}
            onKeyUp={event => {if (event.key === ' ') { event.preventDefault(); microphone.stop(); }}}><Mic size={19}/></button>
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
