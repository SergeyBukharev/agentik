import {useEffect, useId, useRef, useState} from 'react';
import {ArrowUpRight, ChevronRight, Download, FileText, Files, Image, Plus, Table2, Trash2} from 'lucide-react';
import {BoardError, getBoard, listBoards, MAX_BOARD_FILES, MAX_BOARD_FILE_BYTES, readBoardFile, saveBoard,
  type BoardDocument, type BoardSummary, type ChatBoard as BoardData} from '../chat-boards';
import {MAX_CHAT_DOCUMENT_LENGTH, MAX_CHAT_DOCUMENT_NAME_LENGTH} from '../chat-contract';
import type {ChatDraftAttachment} from '../chat-drafts';
import {prepareChatImage} from '../chat-media';
import {useUi, type Language} from '../language';
import {AgentSelect} from './AgentSelect';
import {FamilyBudgetDialog} from './FamilyBudgetDialog';
import {ScreenSkeleton} from './ScreenSkeleton';
import './chat-board.css';

type BoardAction = 'summary' | 'compare' | 'extract';
type Translator = (ru: string, en: string) => string;

const accepted = '.txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp,.gif,.avif';
const excerptLength = 2000;
const previewLength = 20_000;

function emptyBoard(profileId: string, key: string, title: string): BoardData {
  return {profileId, key, title, documents: [], updatedAt: 0};
}

function isImage(document: BoardDocument) {
  return /^image\/(?:png|jpeg|webp|gif|avif)$/.test(document.type);
}

function sizeLabel(bytes: number, language: Language) {
  const units = language === 'en' ? ['B', 'KB', 'MB'] : ['Б', 'КБ', 'МБ'];
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  const unit = bytes >= 1024 * 1024 ? 2 : 1;
  const size = new Intl.NumberFormat(language, {maximumFractionDigits: 1}).format(bytes / (1024 ** unit));
  return `${size} ${units[unit]}`;
}

function makeDraft(action: BoardAction, documents: BoardDocument[], t: Translator) {
  const request = {
    summary: t('Сделай краткую выжимку по документу. Выдели главное.', 'Summarize the document and highlight the key points.'),
    compare: t('Сравни документы. Выдели общие идеи, различия и данные, которых не хватает.',
      'Compare the documents. Highlight common themes, differences, and missing information.'),
    extract: t('Извлеки из документа ключевые факты, даты и числовые данные.', 'Extract the key facts, dates, and figures from the document.'),
  }[action];
  const scope = t('Используй приведённые фрагменты как источники. Укажи, если их не хватает для вывода.',
    'Use the supplied excerpts as source material. Note where they do not support a conclusion.');
  const sources = documents.map(document => {
    const text = document.text?.trim() ?? '';
    const truncated = text.length > excerptLength || document.textTruncated;
    return `${document.name.slice(0, 160)}\n${text.slice(0, excerptLength)}${truncated ? '\n[…]': ''}`;
  });
  return [request, scope, ...sources].join('\n\n');
}

function fileError(cause: unknown, t: Translator) {
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : '';
  switch (code) {
    case 'file-too-large': return t('Размер файла превышает допустимый.', 'The file is over the size limit.');
    case 'file-empty': return t('Файл пуст.', 'The file is empty.');
    case 'file-type': return t('Этот формат файла не поддерживается.', 'This file format is unsupported.');
    default: return t('Файл не удалось прочитать.', 'The file could not be read.');
  }
}

function FilePreview({document, onEdit, working}: {document: BoardDocument; onEdit?: () => void; working: boolean}) {
  const {t} = useUi();
  const [object, setObject] = useState<{id: string; url: string}>();
  useEffect(() => {
    const url = URL.createObjectURL(document.blob);
    setObject({id: document.id, url});
    return () => URL.revokeObjectURL(url);
  }, [document.blob, document.id]);
  const url = object?.id === document.id ? object.url : undefined;

  return (
    <>
      <div className="chat-board__preview-content">
        {isImage(document) && url ? <img className="chat-board__image" src={url} alt={document.name}/>
          : document.text ? <>
            <pre className="chat-board__text" tabIndex={0}>{document.text.slice(0, previewLength)}</pre>
            {(document.textTruncated || document.text.length > previewLength) && <p className="chat-board__hint">
              {t('Показано начало извлечённого текста.', 'Showing the start of the extracted text.')}
            </p>}
          </> : <p className="chat-board__hint">
            {document.type === 'application/pdf'
              ? t('Откройте PDF, чтобы посмотреть страницы.', 'Open the PDF to view its pages.')
              : t('Файл можно скачать в исходном формате.', 'You can download the original file.')}
          </p>}
      </div>
      {url && <div className="chat-board__actions">
        {onEdit && <button type="button" className="button button--primary" onClick={onEdit} disabled={working}>
          <ArrowUpRight size={17} aria-hidden="true"/>{t('Редактировать в чате', 'Edit in chat')}
        </button>}
        {document.type === 'application/pdf' && <a className="button button--secondary" href={url} target="_blank" rel="noopener noreferrer">
          <ArrowUpRight size={17} aria-hidden="true"/>{t('Открыть PDF', 'Open PDF')}
        </a>}
        <a className="button button--secondary" href={url} download={document.name}>
          <Download size={17} aria-hidden="true"/>{t('Скачать', 'Download')}
        </a>
      </div>}
    </>
  );
}

function BudgetBoardItem({profileId}: {profileId: string}) {
  const {t} = useUi();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <li>
    <button ref={trigger} type="button" className="chat-board__index-card" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span className="chat-board__file-icon"><Table2 size={20} aria-hidden="true"/></span>
      <span className="chat-board__file-copy"><strong>{t('Семейный бюджет', 'Family budget')}</strong></span>
      <ChevronRight size={17} aria-hidden="true"/>
    </button>
    {open && <FamilyBudgetDialog profileId={profileId} onClose={() => setOpen(false)} returnFocus={() => trigger.current}/>}
  </li>;
}

export function ChatBoard({profileId, boardKey, title, hasBudget, onUseText, onUseAttachment}: {
  profileId: string;
  boardKey: string;
  title: string;
  hasBudget?: boolean;
  onUseText: (text: string) => boolean;
  onUseAttachment: (attachment: ChatDraftAttachment) => void;
}) {
  const {language, t} = useUi();
  const headingId = useId();
  const compareId = useId();
  const input = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const filePanel = useRef<HTMLElement>(null);
  const preview = useRef<HTMLElement>(null);
  const editRequest = useRef<symbol | undefined>(undefined);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, retry] = useState(0);
  const [selectedId, select] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareIdValue, setCompareIdValue] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setBoard(null);
    setLoadFailed(false);
    setNotice('');
    select('');
    setComparing(false);
    setConfirmRemove(false);
    void getBoard(profileId, boardKey).then(saved => {
      if (active) setBoard(saved ?? emptyBoard(profileId, boardKey, title));
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; editRequest.current = undefined; };
  }, [profileId, boardKey, title, revision]);

  const showBudget = boardKey === 'budget' && hasBudget;
  const documents = board?.documents ?? [];
  const selected = documents.find(item => item.id === selectedId) ?? documents[0];
  const comparisonOptions = documents.filter(item => item.id !== selected?.id && item.text?.trim());
  const comparison = comparisonOptions.find(item => item.id === compareIdValue) ?? comparisonOptions[0];

  function showDocument(id: string) {
    select(id);
    setComparing(false);
    setConfirmRemove(false);
    setNotice('');
    const files = filePanel.current;
    const panel = preview.current;
    if (files && panel && panel.getBoundingClientRect().top >= files.getBoundingClientRect().bottom) {
      panel.scrollIntoView?.({block: 'nearest'});
    }
  }

  async function commit(documents: BoardDocument[]) {
    if (!board) return false;
    const next = {profileId, key: boardKey, title, documents, updatedAt: Math.max(Date.now(), board.updatedAt + 1)};
    try {
      await saveBoard(next, board.updatedAt || null);
      setBoard(next);
      return true;
    } catch (cause) {
      if (cause instanceof BoardError && cause.code === 'board-conflict') {
        setConfirmRemove(false);
        setComparing(false);
        try {
          const latest = await getBoard(profileId, boardKey);
          setBoard(latest ?? emptyBoard(profileId, boardKey, title));
          setNotice(t('Доска изменилась в другой вкладке. Проверьте обновлённый список и повторите действие.',
            'The board changed in another tab. Review the refreshed list and try again.'));
        } catch {
          setBoard(null);
          setLoadFailed(true);
        }
      } else setNotice(t('Изменения не удалось сохранить. Проверьте доступное место и повторите.',
        'The changes could not be saved. Check available space and try again.'));
      return false;
    }
  }

  async function addFiles(files: File[]) {
    if (working || !board || !files.length) return;
    setWorking(true);
    setNotice('');
    try {
      const added: BoardDocument[] = [];
      const limit = MAX_BOARD_FILES - board.documents.length;
      const failures: string[] = [];
      for (const file of files.slice(0, limit)) {
        try { added.push(await readBoardFile(file)); }
        catch (cause) { failures.push(`${file.name} — ${fileError(cause, t)}`); }
      }
      if (files.length > limit) failures.push(t(`На доске помещается до ${MAX_BOARD_FILES} файлов.`, `A board holds up to ${MAX_BOARD_FILES} files.`));
      if (added.length && !await commit([...board.documents, ...added])) return;
      if (added.length) showDocument(added[0].id);
      setNotice(failures.join('\n'));
    } finally { setWorking(false); }
  }

  async function removeFile() {
    if (working || !board || !selected) return;
    setWorking(true);
    setNotice('');
    try {
      if (await commit(documents.filter(item => item.id !== selected.id))) {
        setConfirmRemove(false);
        setComparing(false);
        select('');
        uploadButton.current?.focus();
      }
    } finally { setWorking(false); }
  }

  function prepare(action: BoardAction, sources: BoardDocument[]) {
    if (!onUseText(makeDraft(action, sources, t))) {
      setNotice(t('В черновике мало места. Сократите его и вернитесь на доску.',
        'The draft needs more space. Shorten it and return to the board.'));
    }
  }

  async function editFile(file: BoardDocument) {
    if (working || editRequest.current) return;
    if (file.text?.trim()) {
      onUseAttachment({kind:'document', document:{id:file.id, name:file.name.slice(0, MAX_CHAT_DOCUMENT_NAME_LENGTH),
        text:file.text.slice(0, MAX_CHAT_DOCUMENT_LENGTH),
        ...(file.textTruncated || file.text.length > MAX_CHAT_DOCUMENT_LENGTH ? {truncated:true} : {})}});
      return;
    }
    if (!isImage(file)) return;
    const route = location.hash;
    const request = Symbol();
    editRequest.current = request;
    setWorking(true);
    setNotice('');
    try {
      const image = await prepareChatImage(new File([file.blob], file.name, {type:file.type}));
      if (editRequest.current === request && location.hash === route) onUseAttachment({kind:'image', image});
    } catch {
      if (editRequest.current === request) setNotice(t('Изображение не удалось подготовить для чата.', 'The image could not be prepared for the chat.'));
    } finally {
      if (editRequest.current === request) {
        editRequest.current = undefined;
        setWorking(false);
      }
    }
  }

  return (
    <section className="chat-board" aria-labelledby={headingId}>
      <header className="chat-board__header">
        <h2 className="chat-board__heading" id={headingId}>
          {showBudget ? t('Материалы доски', 'Board items') : t('Файлы доски', 'Board files')}
        </h2>
        <input ref={input} type="file" accept={accepted} multiple hidden onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          void addFiles(files);
        }}/>
        <button ref={uploadButton} type="button" className="button button--primary" onClick={() => input.current?.click()}
          disabled={!board || working || documents.length >= MAX_BOARD_FILES}>
          <Plus size={18} aria-hidden="true"/>{t('Добавить файлы', 'Add files')}
        </button>
      </header>
      {showBudget && <ul className="chat-board__index"><BudgetBoardItem profileId={profileId}/></ul>}
      {working && <p role="status" className="chat-board__hint">{t('Обновляем доску…', 'Updating board…')}</p>}
      {notice && <p className="notice notice--error chat-board__notice" role="alert">{notice}</p>}
      {!board && (loadFailed ? <BoardLoadError retry={() => retry(value => value + 1)}/> : <ScreenSkeleton compact/>)}
      {board && !selected && !showBudget && (
        <div className="chat-board__empty">
          <span className="chat-board__file-icon"><Files size={22} aria-hidden="true"/></span>
          <h2>{t('Здесь будут файлы', 'Your files go here')}</h2>
          <p className="chat-board__hint">{t(`До ${MAX_BOARD_FILES} файлов по ${MAX_BOARD_FILE_BYTES / 1024 / 1024} МБ.`,
            `Up to ${MAX_BOARD_FILES} files of ${MAX_BOARD_FILE_BYTES / 1024 / 1024} MB each.`)}</p>
        </div>
      )}
      {selected && <div className="chat-board__workspace">
        <section ref={filePanel} className="chat-board__files" aria-label={t('Загруженные файлы', 'Uploaded files')}>
          <p className="chat-board__files-head">{t(`${documents.length} из ${MAX_BOARD_FILES} файлов`, `${documents.length} of ${MAX_BOARD_FILES} files`)}</p>
          <ul className="chat-board__file-list">
            {documents.map(document => <li key={document.id}>
              <button type="button" className="chat-board__file" aria-pressed={document.id === selected.id} onClick={() => showDocument(document.id)}>
                <span className="chat-board__file-icon">
                  {isImage(document) ? <Image size={17} aria-hidden="true"/> : <FileText size={17} aria-hidden="true"/>}
                </span>
                <span className="chat-board__file-copy"><strong>{document.name}</strong><span>{sizeLabel(document.size, language)}</span></span>
              </button>
            </li>)}
          </ul>
        </section>
        <section ref={preview} className="chat-board__preview" aria-label={t('Просмотр файла', 'File preview')}>
          <div className="chat-board__preview-head">
            <h2>{selected.name}</h2>
            <button type="button" className="icon-button" aria-label={t('Удалить файл', 'Remove file')}
              title={t('Удалить файл', 'Remove file')} disabled={working} onClick={() => setConfirmRemove(true)}><Trash2 size={18} aria-hidden="true"/></button>
          </div>
          {confirmRemove && <div className="chat-board__confirm">
            <p>{t('Убрать этот файл с доски?', 'Remove this file from the board?')}</p>
            <div className="chat-board__actions">
              <button type="button" className="button button--secondary" onClick={() => setConfirmRemove(false)}>{t('Отмена', 'Cancel')}</button>
              <button type="button" className="button button--secondary chat-board__remove" disabled={working} onClick={() => void removeFile()}>{t('Удалить', 'Remove')}</button>
            </div>
          </div>}
          <FilePreview key={selected.id} document={selected} working={working}
            onEdit={selected.text?.trim() || isImage(selected) ? () => void editFile(selected) : undefined}/>
          {selected.text?.trim() && <div className="chat-board__draft-tools">
            <p className="chat-board__hint">{t('В черновик чата добавятся фрагменты файлов.', 'Excerpts from the files go into your chat draft.')}</p>
            <div className="chat-board__actions">
              <button type="button" className="button button--secondary" onClick={() => prepare('summary', [selected])}>{t('Сделать выжимку', 'Summarize')}</button>
              <button type="button" className="button button--secondary" onClick={() => prepare('extract', [selected])}>{t('Извлечь данные', 'Extract data')}</button>
              {comparison && <button type="button" className="button button--secondary" aria-expanded={comparing}
                onClick={() => setComparing(value => !value)}>{t('Сравнить', 'Compare')}</button>}
            </div>
            {comparing && comparison && <div className="chat-board__compare">
              <label htmlFor={compareId}>{t('С каким файлом сравнить', 'File to compare with')}</label>
              <AgentSelect id={compareId} label={t('С каким файлом сравнить', 'File to compare with')}
                value={comparison.id} fullWidth onChange={setCompareIdValue} options={comparisonOptions.map(item => ({value: item.id, label: item.name}))}/>
              <button type="button" className="button button--primary" onClick={() => prepare('compare', [selected, comparison])}>{t('В черновик', 'Add to draft')}</button>
            </div>}
          </div>}
        </section>
      </div>}
    </section>
  );
}

function BoardLoadError({retry}: {retry: () => void}) {
  const {t} = useUi();
  return <p className="notice notice--error" role="alert">
    {t('Файлы доски не удалось загрузить.', 'Board files could not be loaded.')}
    <button type="button" className="button button--text" onClick={retry}>{t('Повторить', 'Try again')}</button>
  </p>;
}

export function BoardIndex({profileId, hasBudget}: {profileId: string; hasBudget?: boolean}) {
  const {t} = useUi();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setBoards(null);
    setLoadFailed(false);
    void listBoards(profileId).then(items => { if (active) setBoards(items); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [profileId, revision]);

  return <section className="chat-board">
    <header className="chat-board__header"><h1 className="section-title">{t('Доски', 'Boards')}</h1></header>
    {(hasBudget || !!boards?.length) && <ul className="chat-board__index">
      {hasBudget && <BudgetBoardItem profileId={profileId}/>}
      {boards?.map(board => <li key={board.key}>
        <a className="chat-board__index-card" href={'#/board/' + encodeURIComponent(board.key)}>
          <span className="chat-board__file-icon"><Files size={20} aria-hidden="true"/></span>
          <span className="chat-board__file-copy"><strong>{board.title || t('Доска', 'Board')}</strong>
            <span>{t(`Файлов: ${board.documentCount}`, `Files: ${board.documentCount}`)}</span>
          </span><ArrowUpRight size={17} aria-hidden="true"/>
        </a>
      </li>)}
    </ul>}
    {!boards && (loadFailed ? <BoardLoadError retry={() => retry(value => value + 1)}/> : <ScreenSkeleton compact/>)}
    {boards?.length === 0 && !hasBudget && <div className="chat-board__empty">
      <span className="chat-board__file-icon"><Files size={22} aria-hidden="true"/></span>
      <h2>{t('Доски пока пусты', 'No boards yet')}</h2>
      <p className="chat-board__hint">{t('Откройте чат с помощником и добавьте файлы на его доску.', 'Open a chat with an assistant and add files to its board.')}</p>
      <a className="button button--primary" href="#/assistants">{t('Выбрать помощника', 'Choose an assistant')}</a>
    </div>}
  </section>;
}
