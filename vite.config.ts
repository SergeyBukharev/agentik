import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()], base: '/agentik/',
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'], setupFiles: ['src/test-setup.ts'] },
});
