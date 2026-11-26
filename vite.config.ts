import {resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {loadEnv, normalizePath} from 'vite';
import {offlinePlugin} from './scripts/offline-plugin.ts';
import {localApiPlugin} from './scripts/local-api-plugin.ts';

export default defineConfig(({mode}) => {
  const env = {...loadEnv(mode, process.cwd(), ''), ...process.env};
  const codes = resolve(env.AGENTIK_CODES_FILE || 'codes-for-pro.txt');
  let codeSource = codes;
  try { codeSource = realpathSync(codes); } catch { /* The default missing file leaves login disabled. */ }
  return {
    plugins: [react(), offlinePlugin(), localApiPlugin(env)],
    base: '/agentik/',
    server: {
      strictPort: true,
      fs: {deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/codes-for-pro.txt', '**/.private/**',
        normalizePath(codes), normalizePath(codeSource)]},
    },
    preview: {strictPort: true},
    test: {environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts','scripts/**/*.test.ts'], setupFiles: ['src/test-setup.ts']},
  };
});
