import {expect, it} from 'vitest';
import {resolveRoute} from './routes';

it('opens all three public kit pages without changing workspace route matching', () => {
  for (const kit of ['ui-kit', 'brand-kit', 'press-kit']) {
    expect(resolveRoute('/agentik/', `#/${kit}`, '/agentik/')).toMatchObject({kind:'kit', kit});
  }
  expect(resolveRoute('/agentik/', '#/assistant/career', '/agentik/')).toMatchObject({kind:'workspace', page:'assistant', id:'career'});
  expect(resolveRoute('/other/', '#/ui-kit', '/agentik/')).toMatchObject({kind:'not-found'});
});
