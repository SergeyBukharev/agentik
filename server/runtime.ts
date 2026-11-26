import {readFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {Readable} from 'node:stream';
import {createHandler} from './app.ts';
import type {TelegramShareHandler} from './telegram-shares.ts';

type Environment = Record<string, string | undefined>;

function readCodeFile(path: string) {
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > 256 * 1024) return undefined;
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

export function createRuntime(env: Environment, loopbackPort?: number, telegramShares?: TelegramShareHandler) {
  const origins = (env.ALLOWED_ORIGIN ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const aliceFolder = env.AI_ALICE_FOLDER_ID?.trim();
  if (loopbackPort) {
    origins.push(`http://127.0.0.1:${loopbackPort}`, `http://localhost:${loopbackPort}`, `http://[::1]:${loopbackPort}`);
  }
  return createHandler({
    origins,
    telegramShares,
    apiKey: env.AI_API_KEY,
    apiBase: env.AI_API_BASE,
    model: env.AI_MODEL,
    vision: env.AI_VISION === 'true',
    providers: {
      chatgpt: {apiKey:env.AI_OPENAI_API_KEY, model:env.AI_OPENAI_MODEL, apiBase:env.AI_OPENAI_BASE ?? 'https://api.openai.com/v1', vision:true},
      deepseek: {apiKey:env.AI_DEEPSEEK_API_KEY, model:env.AI_DEEPSEEK_MODEL, apiBase:env.AI_DEEPSEEK_BASE ?? 'https://api.deepseek.com/v1'},
      alice: {
        apiKey:env.AI_ALICE_API_KEY,
        apiBase:env.AI_ALICE_API_BASE ?? 'https://ai.api.cloud.yandex.net/v1',
        model:aliceFolder ? `gpt://${aliceFolder}/${env.AI_ALICE_MODEL?.trim() || 'aliceai-llm'}` : undefined,
        authScheme:'Api-Key',
        project:aliceFolder,
      },
    },
    access: {
      codesText: readCodeFile(resolve(env.AGENTIK_CODES_FILE || 'codes-for-pro.txt')),
      secret: env.AGENTIK_ACCESS_SECRET,
      accountEmail: env.AGENTIK_ACCOUNT_EMAIL,
      accountEmailAliases: env.AGENTIK_ACCOUNT_EMAIL_ALIASES,
      accountCode: env.AGENTIK_ACCOUNT_CODE,
      clientAccounts: env.AGENTIK_CLIENT_ACCOUNTS,
      proCodes: env.AGENTIK_PRO_CODES,
    },
  });
}

export function nodeApi(handler: ReturnType<typeof createHandler>) {
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    if (next && !req.url?.startsWith('/api/')) return next();
    try {
      const method = req.method ?? 'GET';
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const request = new Request(`http://localhost${req.url}`, {
        method,
        headers: req.headers as HeadersInit,
        ...(hasBody ? {body: Readable.toWeb(req) as ReadableStream, duplex: 'half'} : {}),
      } as RequestInit);
      const response = await handler(request, req.socket.remoteAddress);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (res.headersSent) return res.end();
      res.writeHead(500, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
      res.end(JSON.stringify({error: 'Не удалось обработать запрос.'}));
    }
  };
}
