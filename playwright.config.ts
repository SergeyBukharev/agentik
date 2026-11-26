import {resolve} from 'node:path';
import {defineConfig, devices} from '@playwright/test';

const port = 4391;
const origin = 'http://127.0.0.1:' + port;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {timeout: 12_000},
  reporter: 'list',
  use: {
    baseURL: origin + '/agentik/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port ' + port + ' --strictPort',
    url: origin + '/agentik/',
    env: {
      AGENTIK_CODES_FILE: resolve('tests/fixtures/access-codes.txt'),
      AGENTIK_ACCESS_SECRET: 'playwright-fixture-secret-for-local-tests-only',
      AI_API_KEY: '',
      AI_MODEL: '',
      AGENTIK_ACCOUNT_EMAIL: 'owner@example.test',
      AGENTIK_ACCOUNT_EMAIL_ALIASES: 'alias@example.test',
      AGENTIK_ACCOUNT_CODE: '123QWE',
      AGENTIK_CLIENT_ACCOUNTS: '[]',
      AGENTIK_PRO_CODES: 'PD7B4M',
    },
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']},
      },
    },
    {
      name: 'webkit-mobile',
      testMatch: ['**/mobile.spec.ts', '**/select.spec.ts', '**/capture-guard.spec.ts', '**/sharing.spec.ts'],
      use: {...devices['iPhone SE']},
    },
  ],
});
