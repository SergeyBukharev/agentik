import {createHandler} from './app.ts';

type PreviewEnv = {
  ASSETS: {fetch(request: Request): Promise<Response>};
  AGENTIK_ACCESS_SECRET?: string;
  AGENTIK_CLIENT_ACCOUNTS?: string;
  AGENTIK_PRO_CODES?: string;
};

const base = '/agentik/';
let accessApi: ReturnType<typeof createHandler> | undefined;

export default {
  async fetch(request: Request, env: PreviewEnv): Promise<Response> {
    if (!request.headers.get('OAI-Authenticated-User-Id')) {
      return new Response('Sign in with ChatGPT to open this preview.', {status: 401, headers: {'Cache-Control': 'no-store'}});
    }
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      accessApi ??= createHandler({
        origin: url.origin,
        access: {
          secret: env.AGENTIK_ACCESS_SECRET,
          clientAccounts: env.AGENTIK_CLIENT_ACCOUNTS,
          proCodes: env.AGENTIK_PRO_CODES,
        },
      });
      return accessApi(request, request.headers.get('CF-Connecting-IP') ?? undefined);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD'}});
    }
    if (url.pathname === '/' || url.pathname === '/agentik') {
      return Response.redirect(new URL(base, url), 302);
    }
    if (!url.pathname.startsWith(base)) return new Response('Not found', {status: 404});
    if (url.pathname === base) url.pathname = base + 'index.html';
    return env.ASSETS.fetch(new Request(url, {method: request.method, headers: request.headers}));
  },
};
