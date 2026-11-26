import {useState} from 'react';
import {Crown} from 'lucide-react';
import {allowsMotion, ShaderLayer} from './ShaderEffects';

export function ProButton({label,onClick}: {label:string;onClick:()=>void}) {
  const [play,setPlay] = useState(false);
  const start = () => {if (allowsMotion()) setPlay(true);};
  const end = () => setPlay(false);
  return <button className="button button--pro" type="button" onClick={onClick}
    onPointerEnter={event=>{if (event.pointerType==='mouse') start();}} onPointerLeave={end}
    onFocus={event=>{if (event.currentTarget.matches(':focus-visible')) start();}} onBlur={end}>
    {play&&<ShaderLayer effect="pro" duration={1250}/>}
    <Crown size={16}/><span>{label}</span>
  </button>;
}
