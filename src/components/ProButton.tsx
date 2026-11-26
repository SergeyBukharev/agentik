import {Crown} from 'lucide-react';

export function ProButton({label,onClick}: {label:string;onClick:()=>void}) {
  return <button className="button button--pro" type="button" onClick={onClick}>
    <Crown size={16}/><span>{label}</span>
  </button>;
}
