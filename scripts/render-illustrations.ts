import {readFileSync, writeFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Scene, type SceneKind} from '../src/components/Scene';

const palette = JSON.parse(readFileSync(new URL('../design-system/colors.json', import.meta.url), 'utf8'));
const colors = (theme: 'light' | 'dark') => ['surface', 'ink', 'brand-lime', 'brand-ink']
  .map(token => `--${token}:${palette[theme][token]}`).join(';');
const css = `<style>
  svg{${colors('light')};color:var(--ink)}
  @media(prefers-color-scheme:dark){svg{${colors('dark')}}}
  .scene__float{animation:float 3.2s ease-in-out}
  .scene__friend,.scene__card{animation:float 3.4s ease-in-out .22s}
  .scene__eyes{animation:blink 3.5s ease-in-out;transform-box:fill-box;transform-origin:center}
  .scene__star{animation:turn 3.6s ease-in-out;transform-box:fill-box;transform-origin:center}
  @keyframes float{50%{transform:translateY(-7px)}}
  @keyframes blink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.1)}}
  @keyframes turn{50%{transform:rotate(24deg)}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`;

const names: SceneKind[] = ['ideas', 'together', 'search', 'history'];
for (const kind of names) {
  const svg = renderToStaticMarkup(createElement(Scene, {kind}));
  const opening = svg.indexOf('>') + 1;
  const content = svg.slice(0, opening) + '\n' + css + `\n<title>Agentik — ${kind}</title>\n` + svg.slice(opening) + '\n';
  const target = new URL(`../public/illustrations/${kind}.svg`, import.meta.url);
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== content) {
      console.error(`Outdated illustration: ${kind}.svg`);
      process.exitCode = 1;
    }
  } else writeFileSync(target, content);
}
