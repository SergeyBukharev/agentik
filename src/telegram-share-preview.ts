import colors from '../design-system/colors.json';
import {
  MAX_TELEGRAM_SHARE_PREVIEW_BYTES, TELEGRAM_SHARE_PREVIEW_HEIGHT, TELEGRAM_SHARE_PREVIEW_WIDTH,
} from './telegram-share-contract';

const titleWidth = 1056;
const logoWidth = 580;
const logoHeight = logoWidth * 48 / 180;
const iconSize = 44;
const pngPrefix = 'data:image/png;base64,';

function fitTitle(context: CanvasRenderingContext2D, title: string) {
  const words = title.trim().split(/\s+/u);
  for (let fontSize = 62; fontSize >= 26; fontSize -= 6) {
    context.font = '650 ' + fontSize + 'px system-ui, sans-serif';
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (context.measureText(next).width <= titleWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of Array.from(word)) {
        if (line && context.measureText(line + character).width > titleWidth) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 3 || fontSize === 26) return {lines, lineHeight:fontSize * 1.15};
  }
  return {lines:[title], lineHeight:30};
}

export async function createTelegramPreview(title: string): Promise<string | undefined> {
  if (location.protocol !== 'https:') return;
  const logo = new Image();
  const canvas = document.createElement('canvas');
  canvas.width = TELEGRAM_SHARE_PREVIEW_WIDTH;
  canvas.height = TELEGRAM_SHARE_PREVIEW_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return;
  let timer: number | undefined;
  try {
    logo.src = import.meta.env.BASE_URL + 'brand/agentik-wordmark-light.svg';
    const ready = await Promise.race([
      logo.decode().then(() => true),
      new Promise<boolean>(resolve => {timer = window.setTimeout(() => resolve(false), 1600);}),
    ]);
    if (!ready) return;

    const {lines, lineHeight} = fitTitle(context, title);
    const centerX = canvas.width / 2;
    const top = (canvas.height - logoHeight - 42 - iconSize - 12 - lines.length * lineHeight) / 2;
    context.fillStyle = colors.light.canvas;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(logo, centerX - logoWidth / 2, top, logoWidth, logoHeight);

    const iconTop = top + logoHeight + 42;
    context.save();
    context.translate(centerX - iconSize / 2, iconTop);
    context.scale(iconSize / 24, iconSize / 24);
    context.strokeStyle = colors.light.focus;
    context.lineWidth = 1.8;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke(new Path2D('M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M7 9h10 M7 13h6'));
    context.restore();

    context.fillStyle = colors.light.ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const titleTop = iconTop + iconSize + 12;
    lines.forEach((line, index) => context.fillText(line, centerX, titleTop + (index + .5) * lineHeight, titleWidth));
    const url = canvas.toDataURL('image/png');
    const maxLength = pngPrefix.length + Math.ceil(MAX_TELEGRAM_SHARE_PREVIEW_BYTES / 3) * 4;
    if (url.startsWith(pngPrefix) && url.length <= maxLength) return url.slice(pngPrefix.length);
  } catch { /* Publishing can still use the standard Agentik preview. */ }
  finally {window.clearTimeout(timer);}
}
