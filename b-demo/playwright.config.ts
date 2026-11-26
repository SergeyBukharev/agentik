import {fileURLToPath} from 'node:url';
import {defineConfig, devices} from '@playwright/test';

const repo = fileURLToPath(new URL('..', import.meta.url));
const port = 4420;
const baseURL = `http://127.0.0.1:${port}/agentik/b-demo/`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {timeout: 6_000},
  workers: 1,
  use: {baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure'},
  webServer: {
    cwd: repo,
    command: `npm exec -- vite --config b-demo/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 960}}},
    {name: 'mobile', use: {...devices['iPhone SE'], viewport: {width: 320, height: 640}}},
  ],
});
