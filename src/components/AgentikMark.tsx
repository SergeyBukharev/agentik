import type {Ref} from 'react';

export function AgentikMark({eyesClassName, eyesRef}: {eyesClassName?: string; eyesRef?: Ref<SVGGElement>}) {
  const lime = 'var(--brand-lime, #d4f58a)';
  const ink = 'var(--brand-ink, #242822)';
  return <>
    <rect width="48" height="48" rx="14" fill={lime}/>
    <path d="M24 6v5" stroke={ink} strokeWidth="3" strokeLinecap="round"/>
    <rect x="9" y="10" width="30" height="30" rx="12" fill={ink}/>
    <g ref={eyesRef} className={eyesClassName} fill={lime}>
      <rect x="16" y="18" width="5" height="9" rx="2.5"/>
      <rect x="27" y="18" width="5" height="9" rx="2.5"/>
    </g>
    <path d="M18.5 31.5q5.5 5.5 11 0" fill="none" stroke={lime} strokeWidth="2.8" strokeLinecap="round"/>
  </>;
}
