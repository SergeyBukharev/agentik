import {resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {loadEnv, normalizePath} from 'vite';
import {offlinePlugin} from './scripts/offline-plugin.ts';
import {localApiPlugin} from './scripts/local-api-plugin.ts';

export default defineConfig(({mode}) => {
  const env = {...loadEnv(mode, process.cwd(), ''), ...process.env};
  const telegram = env.VITE_TELEGRAM_MINI_APP === 'true';
  const codes = resolve(env.AGENTIK_CODES_FILE || 'codes-for-pro.txt');
  let codeSource = codes;
  try { codeSource = realpathSync(codes); } catch { /* The default missing file leaves login disabled. */ }
  return {
    plugins: [react(), {
      name: 'agentik-script-policy',
      apply: 'build',
      transformIndexHtml: () => [{
        tag: 'meta',
        attrs: {'http-equiv': 'Content-Security-Policy', content: `script-src 'self'${telegram ? ' https://telegram.org' : ''}; object-src 'none'; base-uri 'self'`},
        injectTo: 'head-prepend',
      }, ...(telegram ? [{
        tag: 'script',
        attrs: {src: 'https://telegram.org/js/telegram-web-app.js?65'},
        injectTo: 'head-prepend' as const,
      }] : [])],
    }, offlinePlugin(), localApiPlugin(env)],
    base: '/agentik/',
    build: telegram ? {rolldownOptions: {input: {app: resolve('index.html'), widget: resolve('widget.html')}}} : undefined,
    server: {
      strictPort: true,
      fs: {deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/codes-for-pro.txt', '**/.private/**',
        normalizePath(codes), normalizePath(codeSource)]},
    },
    preview: {strictPort: true},
    test: {environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts','scripts/**/*.test.ts'], setupFiles: ['src/test-setup.ts']},
  };
});
