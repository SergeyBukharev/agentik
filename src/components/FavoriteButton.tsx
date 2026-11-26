import {useEffect, useState} from 'react';
import {Star} from 'lucide-react';
import {allowsMotion} from './ShaderEffects';
import './favorite-button.css';

const particles = [0, 1, 2, 3, 4];

export function FavoriteButton({pressed, label, onToggle}: {pressed:boolean; label:string; onToggle:()=>void}) {
  const [motion, setMotion] = useState({turn:0, burst:false});
  useEffect(() => {
    if (!motion.burst) return;
    const timer = window.setTimeout(() => setMotion(current => ({...current, burst:false})), 450);
    return () => window.clearTimeout(timer);
  }, [motion.burst, motion.turn]);

  return <button className={`icon-button agent-card__favorite${pressed ? ' agent-card__favorite--active' : ''}`} type="button"
    aria-label={label} aria-pressed={pressed} onClick={() => {
      onToggle();
      if (allowsMotion()) setMotion(current => ({turn:current.turn + 1, burst:!pressed}));
    }}>
    <Star key={`star-${motion.turn}`} className={motion.turn > 0 ? 'favorite-button__star--spring' : undefined} size={19} aria-hidden="true"/>
    {motion.burst && <span key={`burst-${motion.turn}`} className="favorite-button__burst" aria-hidden="true">
      {particles.map(particle => <span key={particle} className="favorite-button__particle"/>)}
    </span>}
  </button>;
}
