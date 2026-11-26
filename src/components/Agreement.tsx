import {useEffect, useRef, useState, type FormEvent, type PointerEvent} from 'react';
import {Check, Eraser, PenLine, Undo2} from 'lucide-react';
import {
  agreementStorageKey, currentAgreementDate, hasSignatureInk, readAgreement, saveAgreement,
  signatureHeight, signaturePointLimit, signatureStrokeLimit, signatureWidth,
  type InkPoint, type InkStroke,
} from '../agreement';
import {useUi} from '../language';
import './agreement.css';

function Ink({strokes}: {strokes:InkStroke[]}) {
  return <g className="agreement__ink" aria-hidden="true">
    {strokes.map((stroke,index)=>stroke.length===1
      ? <circle key={index} cx={stroke[0].x} cy={stroke[0].y} r={3.6}/>
      : <polyline key={index} points={stroke.map(point=>point.x+','+point.y).join(' ')}/>)}
  </g>;
}

function PenIllustration() {
  return <svg className="agreement__art" viewBox="0 0 300 174" fill="none" aria-hidden="true">
    <path d="M51 132c-10-24 13-74 45-91 29-16 79-16 117 1 30 13 58 41 56 69-3 32-32 42-89 45-57 4-117 0-129-24Z" fill="var(--lime-soft)"/>
    <path d="M68 138c36 14 104 20 158 4" stroke="var(--ink)" opacity=".15" strokeWidth="2" strokeLinecap="round"/>
    <g transform="rotate(-8 133 89)">
      <rect x="68" y="40" width="124" height="101" rx="16" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.4"/>
      <path d="M87 65h68M87 77h49m-49 12h54" stroke="var(--ink)" strokeOpacity=".23" strokeWidth="3" strokeLinecap="round"/>
      <path d="M91 116c9-3 23-14 26-10 2 5-10 17-5 17 4 1 16-12 20-10 4 2-3 8 2 8 5-1 8-4 13-5" stroke="var(--focus)" strokeWidth="2.5" strokeLinecap="round"/>
    </g>
    <g transform="rotate(43 191 75)" stroke="#28321f" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M177 25a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v74h-24Z" fill="#d0ed9c"/>
      <path d="M177 33h24v19h-24z" fill="#dcbde7"/>
      <path d="M201 39h5v26" strokeLinecap="round"/>
      <path d="M177 99h24l-6 15-6 11-6-11-6-15Z" fill="#f9dfac"/>
      <path d="m183 114 6 11 6-11Z" fill="#28321f"/>
      <path d="M185 60v29" opacity=".3" strokeLinecap="round"/>
    </g>
    <circle cx="228" cy="62" r="5.5" fill="#dcbde7"/>
    <path d="M246 91v14m-7-7h14m-207-25v14m-7-7h14" stroke="var(--focus)" strokeWidth="2.3" strokeLinecap="round" opacity=".75"/>
  </svg>;
}

function readLocalAcceptance(accountId?:string) {
  try { return readAgreement(window.localStorage, accountId); }
  catch { return null; }
}

function SignatureForm({accountId}: {accountId?:string}) {
  const {language,t} = useUi();
  const readLocal = () => {
    try { return readLocalAcceptance(accountId); } catch { return null; }
  };
  const [record,setRecord] = useState(readLocal);
  const [mode,setMode] = useState<'ink'|'name'>('ink');
  const [strokes,setStrokes] = useState<InkStroke[]>([]);
  const [name,setName] = useState('');
  const [error,setError] = useState('');
  const [announcement,setAnnouncement] = useState('');
  const draft = useRef<InkStroke[]>([]);
  const pointer = useRef<number|null>(null);
  const focusAfterAction = useRef(false);
  const savedStatus = useRef<HTMLDivElement>(null);
  const firstMode = useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    const sync=(event:StorageEvent)=>{
      if (event.key===null || event.key===agreementStorageKey(accountId)) setRecord(readLocal());
    };
    window.addEventListener('storage',sync);
    return ()=>window.removeEventListener('storage',sync);
  },[accountId]);

  useEffect(()=>{
    if (!focusAfterAction.current) return;
    focusAfterAction.current=false;
    (record ? savedStatus.current : firstMode.current)?.focus();
  },[record]);

  function draw(next:InkStroke[]) {
    draft.current=next;
    setStrokes(next);
    setError('');
  }

  function point(event:PointerEvent<SVGSVGElement>):InkPoint|null {
    const rect=event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x:Math.round(Math.max(0,Math.min(signatureWidth,(event.clientX-rect.left)/rect.width*signatureWidth))),
      y:Math.round(Math.max(0,Math.min(signatureHeight,(event.clientY-rect.top)/rect.height*signatureHeight))),
    };
  }

  function start(event:PointerEvent<SVGSVGElement>) {
    if (event.button!==0 || pointer.current!==null || draft.current.length>=signatureStrokeLimit
      || draft.current.reduce((total,stroke)=>total+stroke.length,0)>=signaturePointLimit) return;
    const startPoint=point(event);
    if (!startPoint) return;
    pointer.current=event.pointerId;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Drawing still works without capture. */ }
    draw([...draft.current,[startPoint]]);
  }

  function move(event:PointerEvent<SVGSVGElement>) {
    if (pointer.current!==event.pointerId || draft.current.reduce((total,stroke)=>total+stroke.length,0)>=signaturePointLimit) return;
    const position=point(event);
    const currentStroke=draft.current.at(-1);
    const last=currentStroke?.at(-1);
    if (!position || !currentStroke || !last || Math.hypot(position.x-last.x,position.y-last.y)<2) return;
    draw([...draft.current.slice(0,-1),[...currentStroke,position]]);
  }

  function end(event:PointerEvent<SVGSVGElement>) {
    if (pointer.current!==event.pointerId) return;
    move(event);
    pointer.current=null;
  }

  function selectMode(value:'ink'|'name') {
    setMode(value);
    setError('');
    setAnnouncement('');
  }

  function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid=mode==='ink' ? hasSignatureInk(strokes) : name.trim().length>=2 && /\p{L}/u.test(name);
    if (!valid) {
      setError(mode==='ink' ? t('Нарисуйте подпись или введите имя.','Draw a signature or type your name.')
        : t('Введите своё имя.','Enter your name.'));
      return;
    }
    try {
      const saved=saveAgreement(localStorage,accountId,mode==='ink' ? {kind:'ink',strokes} : {kind:'name',name},language);
      focusAfterAction.current=true;
      setRecord(saved);
      setError('');
      setAnnouncement('');
    } catch {
      setError(t('Браузер не смог сохранить согласие. Разрешите локальное хранилище и повторите.','Your browser could not save the record. Allow local storage and try again.'));
    }
  }

  function remove() {
    try {
      localStorage.removeItem(agreementStorageKey(accountId));
      focusAfterAction.current=true;
      setRecord(null);
      draw([]);
      setName('');
      setMode('ink');
      setAnnouncement(t('Запись удалена.','The local record was deleted.'));
    } catch {
      setError(t('Браузер не смог удалить запись.','Your browser could not delete the record.'));
    }
  }

  return <section className="agreement__signature" aria-labelledby="agreement-sign">
    <div className="agreement__signature-head">
      <div>
        <h2 id="agreement-sign">{t('Подписать соглашение','Accept the agreement')}</h2>
        <p className="agreement__muted">{t('Рисунок или имя, версия и дата сохраняются только в этом браузере.',
          'The drawing or name, agreement version and date are saved in this browser.')}</p>
      </div>
      <PenIllustration/>
    </div>
    {announcement && <p className="sr-only" role="status">{announcement}</p>}
    {record ? (
      <div className="agreement__saved">
        <div className="agreement__saved-state" ref={savedStatus} tabIndex={-1}><Check size={17} aria-hidden="true"/>
          <span>{t('Согласие сохранено в этом браузере.','Your acceptance is saved in this browser.')}</span>
        </div>
        <time dateTime={new Date(record.acceptedAt).toISOString()}>
          {new Intl.DateTimeFormat(language==='ru' ? 'ru-RU' : 'en',{dateStyle:'long',timeStyle:'short'}).format(record.acceptedAt)}
        </time>
        {record.signature.kind==='ink' ? (
          <svg className="agreement__saved-ink" viewBox={`0 0 ${signatureWidth} ${signatureHeight}`} role="img" aria-label={t('Сохранённая подпись','Saved signature')}>
            <Ink strokes={record.signature.strokes}/>
          </svg>
        ) : <p className="agreement__saved-name">{record.signature.name}</p>}
        <button type="button" className="button button--secondary" onClick={remove}>{t('Удалить отметку','Delete local record')}</button>
      </div>
    ) : (
      <form className="agreement__form" onSubmit={save} noValidate>
        <div className="agreement__modes" role="group" aria-label={t('Способ подписи','Signature method')}>
          <button className="button button--secondary" type="button" ref={firstMode} aria-pressed={mode==='ink'} onClick={()=>selectMode('ink')}>
            <PenLine size={17} aria-hidden="true"/>{t('Ручкой','Draw a signature')}
          </button>
          <button className="button button--secondary" type="button" aria-pressed={mode==='name'} onClick={()=>selectMode('name')}>{t('Ввести имя','Type my name')}</button>
        </div>
        {mode==='ink' ? (
          <div>
            <div className="agreement__pad">
              {!strokes.length && <span aria-hidden="true">{t('Поставьте подпись здесь','Draw your signature here')}</span>}
              <svg viewBox={`0 0 ${signatureWidth} ${signatureHeight}`} preserveAspectRatio="none" role="img"
                aria-label={t('Поле для подписи','Signature drawing area')} aria-describedby="agreement-ink-help"
                onPointerDown={start} onPointerMove={move} onPointerUp={end}
                onPointerCancel={event=>{if(pointer.current===event.pointerId){pointer.current=null;draw(draft.current.slice(0,-1));}}}
                onLostPointerCapture={event=>{if(pointer.current===event.pointerId) pointer.current=null;}}>
                <Ink strokes={strokes}/>
              </svg>
            </div>
            <div className="agreement__tools">
              <p id="agreement-ink-help">{t('Стилусом, пальцем или мышью.','Use a stylus, finger or mouse.')}</p>
              <button className="button button--secondary" type="button" disabled={!strokes.length} onClick={()=>draw(draft.current.slice(0,-1))}>
                <Undo2 size={16} aria-hidden="true"/>{t('Отменить штрих','Undo stroke')}
              </button>
              <button className="button button--secondary" type="button" disabled={!strokes.length} onClick={()=>draw([])}>
                <Eraser size={16} aria-hidden="true"/>{t('Очистить','Clear')}
              </button>
            </div>
          </div>
        ) : (
          <div className="form">
            <label htmlFor="agreement-name" className="form__label">{t('Ваше имя','Your name')}</label>
            <input id="agreement-name" className="form__input" autoComplete="name" maxLength={100} value={name}
              aria-invalid={!!error} aria-describedby={error ? 'agreement-error' : undefined}
              onChange={event=>{setName(event.target.value);setError('');}}/>
          </div>
        )}
        <button className="button button--primary agreement__save">{t('Сохранить согласие','Save acceptance')}</button>
      </form>
    )}
    {error && <p className="notice notice--error" id="agreement-error" role="alert">{error}</p>}
  </section>;
}

export function Agreement({accountId}: {accountId?:string}) {
  const {t} = useUi();
  const sections=[
    {
      heading:t('Кто заключает соглашение','Who this agreement is between'),
      text:t('Вы пользуетесь Agentik, а создатель сервиса предоставляет доступ к его функциям. Условия описывают доступ к помощникам, чатам и возможностям PRO.',
        'You use Agentik and its creator provides access to the service. These terms cover assistants, chats and PRO features.'),
    },
    {
      heading:t('Доступ и оплата','Access and payment'),
      text:t('Храните код доступа в тайне. Пробный доступ включает два сообщения на аккаунт. Следующие отправки доступны с PRO. Если покупка включена, проверьте цену и условия оплаты перед её подтверждением.',
        'Keep your access code private. The trial includes two messages per account. Further messages require PRO. When checkout is available, review the price and payment terms before confirming.'),
    },
    {
      heading:t('Ваши материалы и другие участники','Your content and other participants'),
      text:t('Вы сохраняете права на свои материалы. Загружайте и отправляйте только то, чем имеете право делиться. Уважайте права других участников и используйте сервис законно.',
        'You retain the rights to your content. Upload and share material you have permission to use. Respect other participants’ rights and use the service lawfully.'),
    },
    {
      heading:t('Данные чатов','Chat data'),
      text:t('В этой версии история и вложения хранятся в браузере. По приглашению другой профиль в этом же браузере может увидеть историю группы. Владелец может прекратить доступ через настройки группы.',
        'In this version, chat history and attachments are stored in the browser. An invited profile in that browser can see the group history. The owner can remove access in the group settings.'),
    },
    {
      heading:t('Работа помощников','How assistants work'),
      text:t('Деморежим показывает примеры ответов. Если вы включили генерацию, запрос и выбранное вложение могут передаваться поставщику модели. Проверяйте важные ответы самостоятельно.',
        'Demo mode shows sample replies. If you enable generation, your request and selected attachment may be sent to the model provider. Check important replies yourself.'),
    },
    {
      heading:t('Версии соглашения','Agreement versions'),
      text:t('При изменении условий на этой странице появится новая версия. Нажатие «Сохранить согласие» создаёт локальную отметку для открытой версии. Вы можете удалить её на этой же странице.',
        'If these terms change, a new version will appear here. Selecting “Save acceptance” creates a local record for the displayed version. You can delete it on this page.'),
    },
  ];

  return <main className="agreement">
    <header className="agreement__intro">
      <p className="agreement__version">{t('Редакция 2 от','Version 2 dated')} <time dateTime={currentAgreementDate}>{t('26 ноября 2026 г.','November 26, 2026')}</time></p>
      <h1 className="section-title">{t('Пользовательское соглашение','User agreement')}</h1>
      <p className="agreement__muted">{t('Условия использования Agentik. Прочтите их перед тем, как сохранить согласие.',
        'Read the terms for using Agentik before saving your acceptance.')}</p>
    </header>
    <div className="agreement__clauses">
      {sections.map(({heading,text},index)=><section className="agreement__clause" key={index}>
        <h2>{heading}</h2>
        <p>{text}</p>
      </section>)}
    </div>
    <SignatureForm key={accountId??'guest'} accountId={accountId}/>
  </main>;
}
