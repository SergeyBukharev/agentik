export type ChatImage = {id: string; name: string; url: string};
export const CHAT_MODELS = ['auto', 'chatgpt', 'deepseek'] as const;
export type ChatModel = typeof CHAT_MODELS[number];
export function isChatModel(value: unknown): value is ChatModel {
  return CHAT_MODELS.some(item => item === value);
}
export const CHAT_IMAGE_MAX_LENGTH = 320_000;
export function isChatImage(value: unknown): value is ChatImage {
  if (!value || typeof value !== 'object') return false;
  const {id, name, url} = value as Partial<ChatImage>;
  return typeof id === 'string' && id.length <= 100 && typeof name === 'string' && name.length <= 120
    && typeof url === 'string' && url.length <= CHAT_IMAGE_MAX_LENGTH && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(url);
}

export async function prepareChatImage(file: File): Promise<ChatImage> {
  if (!['image/png','image/jpeg','image/webp','image/avif','image/gif'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('image-format');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('image-format');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const name = file.name.slice(0, 120);
    for (const quality of [.8, .6, .42]) {
      const item = {id: crypto.randomUUID(), name, url: canvas.toDataURL('image/jpeg', quality)};
      if (isChatImage(item)) return item;
    }
    throw new Error('image-size');
  } finally { URL.revokeObjectURL(source); }
}
