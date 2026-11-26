import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import {extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuntime, nodeApi} from './runtime.ts';
import {createTelegramShares} from './telegram-shares.ts';
import {TELEGRAM_SHARE_PAGE_PREFIX} from '../src/telegram-share-contract.ts';

const base = '/agentik/';
const files = await realpath(fileURLToPath(new URL('./dist/', import.meta.url)));
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const telegram = createTelegramShares({
  directory: resolve(process.env.TELEGRAM_SHARE_DIR || 'data/telegram-shares'),
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  miniAppShortName: process.env.TELEGRAM_MINI_APP_SHORT_NAME,
  publicOrigin: process.env.ALLOWED_ORIGIN?.split(',').map(origin => origin.trim()).find(origin => origin.startsWith('https://')),
});
const api = nodeApi(createRuntime(process.env, port, telegram));
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
};

function inside(root: string, path: string) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot && pathFromRoot !== '..' && !pathFromRoot.startsWith('..' + sep) && !isAbsolute(pathFromRoot);
}

async function respond(request: IncomingMessage, response: ServerResponse) {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path.startsWith('/api/') || path.startsWith(TELEGRAM_SHARE_PAGE_PREFIX + '/')) return api(request, response);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {Allow: 'GET, HEAD'}).end();
    return;
  }
  if (path === '/' || path === '/agentik') {
    response.writeHead(308, {Location: base}).end();
    return;
  }
  let file: string | undefined;
  let size = 0;
  try {
    if (path.startsWith(base)) {
      const name = decodeURIComponent(path.slice(base.length)) || 'index.html';
      const candidate = resolve(files, name);
      if (inside(files, candidate)) {
        const actual = await realpath(candidate);
        const info = inside(files, actual) ? await stat(actual) : null;
        if (info?.isFile()) {file = actual; size = info.size;}
      }
    }
  } catch { /* Missing or malformed asset paths return 404. */ }
  if (!file) {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Страница не найдена.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': path.startsWith(base + 'assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).on('error', () => response.destroy()).pipe(response);
}

const server = createServer((request, response) => {
  void respond(request, response).catch(() => {
    if (response.headersSent) response.destroy();
    else response.writeHead(500, {'Cache-Control':'no-store'}).end();
  });
});
server.requestTimeout = 45_000;
server.headersTimeout = 10_000;
server.listen(port, host, () => console.log(`Agentik Mini App listens on http://${host}:${port}${base}`));
