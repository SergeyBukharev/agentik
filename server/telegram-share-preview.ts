import {
  MAX_TELEGRAM_SHARE_PREVIEW_BYTES, TELEGRAM_SHARE_PAGE_PREFIX,
  TELEGRAM_SHARE_PREVIEW_HEIGHT, TELEGRAM_SHARE_PREVIEW_WIDTH,
} from '../src/telegram-share-contract.ts';

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

export function parseSharePreviewPng(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_TELEGRAM_SHARE_PREVIEW_BYTES / 3) * 4
    || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return;
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 45 || bytes.length > MAX_TELEGRAM_SHARE_PREVIEW_BYTES || !bytes.subarray(0, 8).equals(pngSignature)
    || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR'
    || bytes.readUInt32BE(16) !== TELEGRAM_SHARE_PREVIEW_WIDTH || bytes.readUInt32BE(20) !== TELEGRAM_SHARE_PREVIEW_HEIGHT) return;
  return value;
}

export function httpsShareOrigin(value: string | undefined) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash) return url.origin;
  } catch { /* A direct Mini App link remains available without a public web origin. */ }
}

function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function respondToSharePreview({method, headers, title, id, publicOrigin, previewPng, image}: {
  method: 'GET' | 'HEAD';
  headers: Record<string, string>;
  title: string;
  id: string;
  publicOrigin: string;
  previewPng?: string;
  image: boolean;
}) {
  if (image) {
    if (!previewPng) {
      return new Response(null, {status: 302, headers: {...headers, Location: publicOrigin + '/agentik/brand/agentik-og.png'}});
    }
    const bytes = Uint8Array.from(Buffer.from(previewPng, 'base64'));
    return new Response(method === 'HEAD' ? null : bytes, {headers: {...headers,
      'Content-Type':'image/png', 'Content-Length':String(bytes.length)}});
  }

  const previewUrl = escapeHtml(publicOrigin + TELEGRAM_SHARE_PAGE_PREFIX + '/' + id);
  const safeTitle = escapeHtml(title);
  const imageUrl = previewUrl + '/preview.png';
  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} · Agentik</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Agentik">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="Копия чата в Agentik">
<meta property="og:url" content="${previewUrl}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${TELEGRAM_SHARE_PREVIEW_WIDTH}">
<meta property="og:image:height" content="${TELEGRAM_SHARE_PREVIEW_HEIGHT}">
<meta property="og:image:alt" content="Agentik · ${safeTitle}">
<meta name="twitter:card" content="summary_large_image">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#fcfdfb;color:#242822;font:16px system-ui,sans-serif}
main{width:min(100%,680px);text-align:center}
img{display:block;width:100%;height:auto}
h1{font-size:clamp(24px,5vw,36px);overflow-wrap:anywhere}
a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:10px;background:#d4f58a;color:#242822;font-weight:650}
</style>
</head>
<body><main>
<img src="${imageUrl}" width="1200" height="630" alt="Agentik">
<h1>${safeTitle}</h1>
<a href="/agentik/widget.html#agentikShare=${id}">Открыть копию чата</a>
</main></body>
</html>`;
  return new Response(method === 'HEAD' ? null : html, {headers: {...headers,
    'Content-Type':'text/html; charset=utf-8', 'Content-Length':String(Buffer.byteLength(html)),
    'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
