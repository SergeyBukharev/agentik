import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {offlinePlugin} from '../scripts/offline-plugin.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: '/agentik/b-demo/',
  plugins: [react(), offlinePlugin({cacheScope: 'agentik-b-demo', publicFiles: ['icon.svg', 'mascot.webp']})],
});
