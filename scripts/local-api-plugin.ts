import {existsSync, readdirSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import type {Plugin} from 'vite';
import {createRuntime, nodeApi} from '../server/runtime.ts';

function inside(parent: string, child: string) {
  const path = relative(parent, child);
  return !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
}

export function localApiPlugin(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'agentik-local-api',
    configResolved(config) {
      if (!config.publicDir || !existsSync(config.publicDir)) return;
      const source = resolve(config.root, env.AGENTIK_CODES_FILE || 'codes-for-pro.txt');
      const publicRoot = realpathSync(config.publicDir);
      const misplacedSource = inside(publicRoot, source) || (existsSync(source) && inside(publicRoot, realpathSync(source)));
      const containsCodeList = readdirSync(publicRoot, {recursive: true, withFileTypes: true})
        .some(entry => entry.name.toLowerCase() === 'codes-for-pro.txt');
      if (misplacedSource || containsCodeList) throw new Error('Переместите файл кодов из public перед запуском или сборкой.');
    },
    configureServer(server) {
      const middleware = nodeApi(createRuntime(env, server.config.server.port ?? 5173));
      server.middlewares.use((req, res, next) => {void middleware(req, res, next);});
    },
    configurePreviewServer(server) {
      const middleware = nodeApi(createRuntime(env, server.config.preview.port ?? 4173));
      server.middlewares.use((req, res, next) => {void middleware(req, res, next);});
    },
  };
}
