import fs from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Scene} from '../src/components/Scene';
const animation=`svg{--lime:#d1f28b;--surface:#fff;--ink:#263021;color:var(--ink)}.scene__float{animation:float 5s ease-in-out infinite}.scene__friend,.scene__card{animation:float 5.8s ease-in-out .7s infinite}.scene__eyes{animation:blink 7s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.scene__star{animation:turn 16s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes float{50%{transform:translateY(-7px)}}@keyframes blink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.1)}}@keyframes turn{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}`;
await fs.mkdir('public/illustrations',{recursive:true});
for(const kind of ['ideas','together','search','history'] as const){const svg=renderToStaticMarkup(<Scene kind={kind}/>).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace('<defs>',`<style>${animation}</style><title>Agentik — ${kind}</title><defs>`);await fs.writeFile(`public/illustrations/${kind}.svg`,svg);}
console.log('4 animated SVG assets exported.');
