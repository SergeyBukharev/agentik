import {Crown} from 'lucide-react';
import type {MouseEventHandler} from 'react';

export function ProButton({label,onClick}: {label:string;onClick:MouseEventHandler<HTMLButtonElement>}) {
  return <button className="button button--pro" type="button" onClick={onClick}>
    <Crown size={16}/><span>{label}</span>
  </button>;
}
