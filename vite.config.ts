import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {offlinePlugin} from './scripts/offline-plugin.ts';
export default defineConfig({
  plugins: [react(),offlinePlugin()], base: '/agentik/',
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts','scripts/**/*.test.ts'], setupFiles: ['src/test-setup.ts'] },
});
