import {useId} from 'react';
import {AgentikMark} from './AgentikMark';

export type SceneKind = 'ideas' | 'together' | 'search' | 'history' | 'lost';

export function Scene({kind = 'ideas'}: {kind?: SceneKind}) {
  const dots = useId() + '-dots';
  if (kind === 'lost') return <LostScene/>;
  return <svg xmlns="http://www.w3.org/2000/svg" className={`scene scene--${kind}`} viewBox="0 0 320 220" fill="none" aria-hidden="true">
    <defs>
      <pattern id={dots} width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor" opacity=".12"/>
      </pattern>
    </defs>
    <ellipse cx="160" cy="187" rx="117" ry="17" fill="currentColor" opacity=".05"/>
    <rect x="30" y="20" width="260" height="166" rx="70" fill={`url(#${dots})`}/>
    <path d="M48 131C16 57 132 10 232 40c75 22 44 129-43 135" stroke="currentColor" strokeOpacity=".18" strokeDasharray="4 6"/>
    <g className="scene__float">
      <g data-agentik-mascot transform="translate(76 45) rotate(-9 66 66) scale(2.75)">
        <AgentikMark eyesClassName="scene__eyes"/>
      </g>
      <path d="M80 153c-28 1-29 19-17 24M193 151c20-9 28-1 29 10" stroke="var(--brand-ink)" strokeWidth="3" strokeLinecap="round"/>
    </g>
    {kind === 'together' ? <g className="scene__friend">
      <g data-agentik-mascot transform="translate(205 100) rotate(12 34 34) scale(1.42)">
        <AgentikMark eyesClassName="scene__eyes"/>
      </g>
    </g> : <g className="scene__card">
      <rect x="211" y="66" width="63" height="74" rx="9" fill="var(--surface)" stroke="currentColor" strokeOpacity=".2" transform="rotate(12 242 103)"/>
      <path d="m227 87 27 6m-29 6 26 6m-28 6 17 4" stroke="currentColor" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round"/>
    </g>}
    <path className="scene__star" d="M253 29v24m-12-12h24m-20-8 16 16m-16 0 16-16" stroke="#8f79ae" strokeWidth="3" strokeLinecap="round"/>
    {kind === 'search' && <g className="scene__card">
      <circle cx="242" cy="100" r="21" fill="var(--surface)" stroke="#87729f" strokeWidth="4"/>
      <path d="m257 116 17 18" stroke="#87729f" strokeWidth="7" strokeLinecap="round"/>
    </g>}
    {kind === 'history' && <g className="scene__card">
      <circle cx="242" cy="100" r="24" fill="var(--surface)" stroke="#87729f" strokeWidth="3"/>
      <path d="M242 84v17l11 7" stroke="#87729f" strokeWidth="3" strokeLinecap="round"/>
    </g>}
    <circle className="scene__satellite" cx="41" cy="87" r="7" fill="#ecc8b3"/>
    <path d="m45 161 4 9 10 1-8 6 2 10-8-6-9 5 3-10-7-7 10 1 3-9Z" fill="#b5c59c"/>
  </svg>;
}

function LostScene() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="scene scene--lost" viewBox="0 0 320 220" fill="none" aria-hidden="true">
    <ellipse cx="160" cy="189" rx="106" ry="12" fill="currentColor" opacity=".08"/>
    <circle cx="159" cy="105" r="81" fill="var(--soft)"/>
    <path className="scene__signal" d="M51 91a116 68 0 0 1 216 21M62 133a115 69 0 0 0 192 14"
      stroke="currentColor" strokeOpacity=".24" strokeDasharray="4 7" strokeWidth="2" strokeLinecap="round"/>
    <g className="scene__float">
      <g data-agentik-mascot transform="translate(98 58) rotate(-9 60 60) scale(2.5)">
        <AgentikMark eyesClassName="scene__eyes"/>
      </g>
      <circle className="scene__signal-point" cx="142" cy="43" r="5" fill="#c3abd9"/>
    </g>
    <path className="scene__star" d="M248 62v18m-9-9h18m-15-6 12 12m-12 0 12-12" stroke="#9a83b9" strokeWidth="3" strokeLinecap="round"/>
    <circle className="scene__satellite" cx="49" cy="135" r="6" fill="#e8ac99"/>
    <path d="m268 159 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" fill="#b4c68b"/>
  </svg>;
}
