import React,{useId} from 'react';
export function Scene({kind='ideas'}:{kind?:'ideas'|'together'|'search'|'history'|'lost'}){
 const id=useId().replace(/:/g,'');
 if (kind==='lost') return <LostScene id={id}/>;
 return <svg className={`scene scene--${kind}`} viewBox="0 0 320 220" fill="none" aria-hidden="true"><defs><pattern id={`${id}-dots`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor" opacity=".12"/></pattern></defs><ellipse cx="160" cy="187" rx="117" ry="17" fill="currentColor" opacity=".05"/><rect x="30" y="20" width="260" height="166" rx="70" fill={`url(#${id}-dots)`}/><path d="M48 131C16 57 132 10 232 40c75 22 44 129-43 135" stroke="currentColor" strokeOpacity=".18" strokeDasharray="4 6"/><g className="scene__float"><rect x="70" y="51" width="142" height="123" rx="31" fill="var(--lime)" stroke="#33432a" strokeWidth="2" transform="rotate(-9 141 112)"/><rect x="94" y="77" width="95" height="64" rx="24" fill="#293326" transform="rotate(-9 141 109)"/><g className="scene__eyes"><rect x="117" y="94" width="11" height="22" rx="5.5" fill="#d1f28b"/><rect x="154" y="88" width="11" height="22" rx="5.5" fill="#d1f28b"/></g><path d="M130 121q8 9 16-3" stroke="#d1f28b" strokeWidth="3" strokeLinecap="round"/><path d="m128 52-3-15" stroke="#33432a" strokeWidth="3" strokeLinecap="round"/><circle cx="124" cy="31" r="6" fill="#a995cd"/><path d="M80 153c-28 1-29 19-17 24M193 151c20-9 28-1 29 10" stroke="#33432a" strokeWidth="3" strokeLinecap="round"/></g>{kind==='together'?<g className="scene__friend"><rect x="205" y="99" width="66" height="74" rx="22" fill="#e5dbf3" stroke="#81718f" strokeWidth="2" transform="rotate(12 238 136)"/><rect x="220" y="122" width="6" height="13" rx="3" fill="#645174"/><rect x="245" y="126" width="6" height="13" rx="3" fill="#645174"/><path d="M228 148q5 7 12 2" stroke="#645174" strokeWidth="2" strokeLinecap="round"/></g>:<g className="scene__card"><rect x="211" y="66" width="63" height="74" rx="9" fill="var(--surface)" stroke="currentColor" strokeOpacity=".2" transform="rotate(12 242 103)"/><path d="m227 87 27 6m-29 6 26 6m-28 6 17 4" stroke="currentColor" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round"/></g>}<g className="scene__star" stroke="#8f79ae" strokeWidth="3" strokeLinecap="round"><path d="M253 29v24m-12-12h24m-20-8 16 16m-16 0 16-16"/></g>{kind==='search'&&<g className="scene__card"><circle cx="242" cy="100" r="21" fill="var(--surface)" stroke="#87729f" strokeWidth="4"/><path d="m257 116 17 18" stroke="#87729f" strokeWidth="7" strokeLinecap="round"/></g>}{kind==='history'&&<g className="scene__card"><circle cx="242" cy="100" r="24" fill="var(--surface)" stroke="#87729f" strokeWidth="3"/><path d="M242 84v17l11 7" stroke="#87729f" strokeWidth="3" strokeLinecap="round"/></g>}<circle className="scene__satellite" cx="41" cy="87" r="7" fill="#ecc8b3"/><path d="m45 161 4 9 10 1-8 6 2 10-8-6-9 5 3-10-7-7 10 1 3-9Z" fill="#b5c59c"/></svg>;
}

function LostScene({id}: {id: string}) {
 return (
   <svg className="scene scene--lost" viewBox="0 0 320 220" fill="none" aria-hidden="true">
     <defs>
       <linearGradient id={id+'-shell'} x1="99" y1="71" x2="220" y2="170" gradientUnits="userSpaceOnUse">
         <stop stopColor="#eafbca"/><stop offset="1" stopColor="#a8d86f"/>
       </linearGradient>
     </defs>
     <ellipse cx="160" cy="189" rx="106" ry="12" fill="currentColor" opacity=".08"/>
     <circle cx="159" cy="105" r="81" fill="var(--soft)"/>
     <path className="scene__signal" d="M51 91a116 68 0 0 1 216 21M62 133a115 69 0 0 0 192 14"
       stroke="currentColor" strokeOpacity=".24" strokeDasharray="4 7" strokeWidth="2" strokeLinecap="round"/>
     <g className="scene__float">
       <rect x="92" y="64" width="132" height="109" rx="29" fill={'url(#'+id+'-shell)'} stroke="#47573b" strokeWidth="2" transform="rotate(-9 158 119)"/>
       <rect x="112" y="88" width="93" height="59" rx="20" fill="#253122" transform="rotate(-9 158 117)"/>
       <g className="scene__eyes" stroke="#e5f4cd" strokeWidth="4" strokeLinecap="round">
         <path d="m135 113 8-1m30-5 8-1"/>
       </g>
       <path d="M151 124q8 8 16-2" stroke="#c4e692" strokeWidth="3" strokeLinecap="round"/>
       <path d="m146 65-3-17" stroke="#47573b" strokeWidth="3" strokeLinecap="round"/>
       <circle className="scene__signal-point" cx="142" cy="43" r="6" fill="#c3abd9"/>
     </g>
     <g className="scene__star" stroke="#9a83b9" strokeWidth="3" strokeLinecap="round"><path d="M248 62v18m-9-9h18m-15-6 12 12m-12 0 12-12"/></g>
     <circle className="scene__satellite" cx="49" cy="135" r="6" fill="#e8ac99"/>
     <path d="m268 159 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" fill="#b4c68b"/>
   </svg>
 );
}
