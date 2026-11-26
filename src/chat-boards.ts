export const MAX_BOARD_FILES = 12;
export const MAX_BOARD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 160_000;
const MAX_DOCX_XML_BYTES = 2 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

export type BoardDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  text?: string;
  extraction: 'ready' | 'unsupported';
  textTruncated?: true;
};

export type ChatBoard = {profileId: string; key: string; title: string; documents: BoardDocument[]; updatedAt: number};
export type BoardSummary = {key: string; title: string; documentCount: number; updatedAt: number};
type StoredDocument = BoardDocument | (Omit<BoardDocument, 'blob'> & {bytes: ArrayBuffer});
type StoredBoard = Omit<ChatBoard, 'documents'> & {documents: StoredDocument[]};
type StoredSummary = BoardSummary & Pick<ChatBoard, 'profileId'>;
type BoardErrorCode = 'file-too-large' | 'file-type' | 'file-empty' | 'board-limit' | 'board-conflict' | 'invalid-board' | 'storage-unavailable';

export class BoardError extends Error {
  constructor(readonly code: BoardErrorCode) {
    super(code);
    this.name = 'BoardError';
  }
}

const databaseName = 'agentik-chat-boards';
let connection: Promise<IDBDatabase> | undefined;
let useByteRecords = false;
const bytesByBlob = new WeakMap<Blob, ArrayBuffer>();

function boardDatabase() {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('boards', {keyPath: ['profileId', 'key']});
      database.createObjectStore('summaries', {keyPath: ['profileId', 'key']}).createIndex('profileId', 'profileId');
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {database.close(); return;}
      const release = () => {connection = undefined; database.close();};
      database.onversionchange = release;
      database.onclose = release;
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {blocked = true; reject(new BoardError('storage-unavailable'));};
  }).catch(() => {
    connection = undefined;
    throw new BoardError('storage-unavailable');
  });
  return connection;
}

async function readStore<T>(store: string, read: (objectStore: IDBObjectStore) => IDBRequest<T>) {
  const database = await boardDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(store, 'readonly');
      const request = read(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    throw new BoardError('storage-unavailable');
  }
}

function validKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && !!value.trim();
}

export async function listBoards(profileId: string): Promise<BoardSummary[]> {
  if (!validKey(profileId)) throw new BoardError('invalid-board');
  const records = await readStore<StoredSummary[]>('summaries', store => store.index('profileId').getAll(profileId));
  return records.sort((a, b) => b.updatedAt - a.updatedAt).map(({key, title, documentCount, updatedAt}) => ({key, title, documentCount, updatedAt}));
}

export async function getBoard(profileId: string, key: string): Promise<ChatBoard | null> {
  if (!validKey(profileId) || !validKey(key)) throw new BoardError('invalid-board');
  const record = await readStore<StoredBoard | undefined>('boards', store => store.get([profileId, key]));
  if (!record) return null;
  return {...record, documents:record.documents.map(file => {
    if ('blob' in file) return file;
    useByteRecords = true;
    const {bytes, ...metadata} = file;
    const blob = new Blob([bytes], {type:metadata.type});
    bytesByBlob.set(blob, bytes);
    return {...metadata, blob};
  })};
}

function isDocument(entry: BoardDocument) {
  return entry && validKey(entry.id) && validKey(entry.name) && entry.type === typeFor(entry.name)
    && entry.blob instanceof Blob && entry.blob.type === entry.type && entry.size === entry.blob.size
    && entry.size > 0 && entry.size <= MAX_BOARD_FILE_BYTES
    && (entry.extraction === 'ready' ? typeof entry.text === 'string' && !!entry.text.trim() && entry.text.length <= MAX_TEXT_CHARS
      : entry.extraction === 'unsupported' && entry.text === undefined);
}

async function byteRecord(board: ChatBoard): Promise<StoredBoard> {
  const documents: StoredDocument[] = [];
  for (const {blob, ...metadata} of board.documents) {
    let bytes = bytesByBlob.get(blob);
    if (!bytes) {
      bytes = await fileBytes(blob);
      bytesByBlob.set(blob, bytes);
    }
    documents.push({...metadata, bytes});
  }
  return {...board, documents};
}

export async function saveBoard(board: ChatBoard, expectedUpdatedAt?: number | null): Promise<void> {
  if (!board || !validKey(board.profileId) || !validKey(board.key) || !validKey(board.title) || !Number.isFinite(board.updatedAt)
    || !Array.isArray(board.documents)) throw new BoardError('invalid-board');
  if (board.documents.length > MAX_BOARD_FILES) throw new BoardError('board-limit');
  if (!board.documents.every(isDocument) || new Set(board.documents.map(document => document.id)).size !== board.documents.length
    || (typeof expectedUpdatedAt === 'number' && (!Number.isFinite(expectedUpdatedAt) || board.updatedAt <= expectedUpdatedAt))) {
    throw new BoardError('invalid-board');
  }
  const {profileId, key, title, updatedAt, documents} = board;
  const summary = {profileId, key, title, updatedAt, documentCount: documents.length} satisfies StoredSummary;
  const database = await boardDatabase();
  function write(record: StoredBoard) {
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['boards', 'summaries'], 'readwrite');
      const boards = transaction.objectStore('boards');
      let writeError: unknown;
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(writeError ?? transaction.error);
      function abort(error: unknown) {
        writeError = error;
        transaction.abort();
      }
      function store() {
        try {
          boards.put(record);
          transaction.objectStore('summaries').put(summary);
        } catch (error) {abort(error);}
      }
      if (expectedUpdatedAt === undefined) {store(); return;}

      const request = boards.get([profileId, key]) as IDBRequest<StoredBoard | undefined>;
      request.onsuccess = () => {
        const revision = request.result?.updatedAt ?? null;
        if (revision !== expectedUpdatedAt) {abort(new BoardError('board-conflict')); return;}
        store();
      };
    });
  }
  try {
    if (useByteRecords) {
      await write(await byteRecord(board));
      return;
    }
    try {
      await write(board);
    } catch (error) {
      // Some WebKit stores can serialize byte buffers but reject Blob records.
      if (!documents.length || !(error instanceof DOMException)
        || (error.name !== 'UnknownError' && error.name !== 'DataCloneError')) throw error;
      await write(await byteRecord(board));
      useByteRecords = true;
    }
  } catch (error) {
    if (error instanceof BoardError) throw error;
    throw new BoardError('storage-unavailable');
  }
}

const types = new Map(Object.entries({
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf',
  png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
}));

function typeFor(name: string) {
  return types.get(/\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '');
}

function fileBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

type ExtractedText = {text: string; truncated?: boolean};

async function plainText(blob: Blob): Promise<ExtractedText | undefined> {
  const prefix = blob.slice(0, MAX_TEXT_CHARS * 4);
  const bytes = new Uint8Array(await fileBytes(prefix));
  const truncated = prefix.size < blob.size;
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  const text = new TextDecoder(encoding, {fatal: true}).decode(bytes, {stream: truncated});
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return;
  return {text, truncated};
}

function findDocxBody(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // Inspect the central directory so data-descriptor archives can be read without scanning compressed entries.
  const minimum = Math.max(0, bytes.length - 22 - 65_535);
  let footer = bytes.length - 22;
  while (footer >= minimum && (view.getUint32(footer, true) !== 0x06054b50
    || footer + 22 + view.getUint16(footer + 20, true) !== bytes.length)) footer--;
  if (footer < minimum || view.getUint32(footer + 4, true) !== 0) return;

  const count = view.getUint16(footer + 10, true);
  const dirLength = view.getUint32(footer + 12, true);
  const dirStart = view.getUint32(footer + 16, true);
  const dirEnd = dirStart + dirLength;
  if (count > 4096 || count !== view.getUint16(footer + 8, true) || dirEnd > footer) return;

  const decoder = new TextDecoder();
  let cursor = dirStart;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > dirEnd || view.getUint32(cursor, true) !== 0x02014b50) return;
    const nameLength = view.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (next > dirEnd) return;
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name !== 'word/document.xml') {cursor = next; continue;}

    const method = view.getUint16(cursor + 10, true);
    const compressedLength = view.getUint32(cursor + 20, true);
    const length = view.getUint32(cursor + 24, true);
    const local = view.getUint32(cursor + 42, true);
    if ((view.getUint16(cursor + 8, true) & 1) || (method !== 0 && method !== 8) || length > MAX_DOCX_XML_BYTES
      || local + 30 > dirStart || view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method) return;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressedLength > dirStart || (method === 0 && compressedLength !== length)) return;
    return {method, length, bytes: bytes.subarray(start, start + compressedLength)};
  }
}

async function unzipXml(entry: NonNullable<ReturnType<typeof findDocxBody>>) {
  if (entry.method === 0) return entry.bytes;
  let cursor = 0;
  const compressed = new ReadableStream<Uint8Array<ArrayBuffer>>({pull(controller) {
    if (cursor >= entry.bytes.length) {controller.close(); return;}
    const next = Math.min(cursor + 8192, entry.bytes.length);
    controller.enqueue(entry.bytes.subarray(cursor, next));
    cursor = next;
  }});
  const stream = compressed.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const xml = new Uint8Array(entry.length);
  let offset = 0;
  try {
    for (;;) {
      const {value, done} = await stream.read();
      if (done) return offset === xml.length ? xml : undefined;
      if (offset + value.byteLength > xml.length) {await stream.cancel(); return;}
      xml.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    stream.releaseLock();
  }
}

async function wordText(blob: Blob): Promise<ExtractedText | undefined> {
  const entry = findDocxBody(await fileBytes(blob));
  if (!entry) return;
  const xml = await unzipXml(entry);
  if (!xml) return;
  const source = new TextDecoder('utf-8', {fatal: true}).decode(xml);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) return;
  const document = new DOMParser().parseFromString(source, 'application/xml');
  const {localName, namespaceURI} = document.documentElement;
  if (localName !== 'document' || !namespaceURI || document.querySelector('parsererror')) return;
  const paragraphs = document.getElementsByTagNameNS(namespaceURI, 'p');
  const text = Array.from(paragraphs, paragraph => Array.from(paragraph.getElementsByTagNameNS(namespaceURI, '*'), node => {
    if (node.localName === 'tab') return '\t';
    if (node.localName === 'br') return '\n';
    return node.localName === 't' ? node.textContent ?? '' : '';
  }).join('')).join('\n');
  return {text};
}

async function pdfText(blob: Blob): Promise<ExtractedText | undefined> {
  const data = await fileBytes(blob);
  if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) return;
  const [pdf, {default: workerSrc}] = await Promise.all([
    import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdf.GlobalWorkerOptions.workerSrc = workerSrc;
  const loading = pdf.getDocument({data, disableFontFace: true, enableXfa: false, useWasm: false,
    useSystemFonts: false, useWorkerFetch: false, stopAtErrors: true, maxImageSize: 16_777_216});
  const deadline = setTimeout(() => {void loading.destroy().catch(() => {});}, 8_000);
  try {
    const document = await loading.promise;
    const pageCount = Math.min(document.numPages, MAX_PDF_PAGES);
    let text = '';
    for (let number = 1; number <= pageCount; number++) {
      const page = await document.getPage(number);
      const reader = page.streamTextContent().getReader();
      try {
        for (;;) {
          const {value, done} = await reader.read();
          if (done) break;
          for (const item of value.items) {
            if (!('str' in item)) continue;
            text += item.str + (item.hasEOL ? '\n' : ' ');
            if (text.length > MAX_TEXT_CHARS) {await reader.cancel(); return {text, truncated: true};}
          }
        }
      } finally {
        reader.releaseLock();
        page.cleanup();
      }
      if (text) text += '\n\n';
    }
    return {text, truncated: pageCount < document.numPages};
  } finally {
    clearTimeout(deadline);
    await loading.destroy();
  }
}

export async function readBoardFile(file: File): Promise<BoardDocument> {
  if (!file.size) throw new BoardError('file-empty');
  if (file.size > MAX_BOARD_FILE_BYTES) throw new BoardError('file-too-large');
  const name = file.name.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f]/g, '').trim() ?? '';
  const type = typeFor(name);
  if (!type || !validKey(name)) throw new BoardError('file-type');
  const blob = file.slice(0, file.size, type);
  const document = {id: crypto.randomUUID(), name, type, size: blob.size, blob};
  let result: ExtractedText | undefined;
  try {
    if (type === 'application/pdf') result = await pdfText(blob);
    else if (type === types.get('docx')) result = await wordText(blob);
    else if (!type.startsWith('image/')) result = await plainText(blob);
  } catch {
    // Keep the original when the browser cannot decode a damaged, encrypted, or scanned document.
  }
  const text = result?.text.trim() ?? '';
  if (!text) return {...document, extraction: 'unsupported'};
  return {...document, extraction: 'ready', text: text.slice(0, MAX_TEXT_CHARS),
    ...(text.length > MAX_TEXT_CHARS || result?.truncated ? {textTruncated: true} : {})};
}
