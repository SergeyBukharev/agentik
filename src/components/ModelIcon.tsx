import {Sparkles} from 'lucide-react';
import openai from '../assets/providers/openai.svg';
import openaiWhite from '../assets/providers/openai-white.svg';
import deepseek from '../assets/providers/deepseek.svg';
import alice from '../assets/providers/alice.svg';
import type {ChatModel} from '../chat-media';

export function ModelIcon({model}: {model: ChatModel}) {
  if (model === 'chatgpt') {
    return (
      <span className="model-icon" data-provider-icon="openai" aria-hidden="true">
        <img className="model-icon__image model-icon__image--light" src={openai} alt="" width="18" height="18"/>
        <img className="model-icon__image model-icon__image--dark" src={openaiWhite} alt="" width="18" height="18"/>
      </span>
    );
  }
  if (model === 'deepseek') {
    return (
      <span className="model-icon" data-provider-icon="deepseek" aria-hidden="true">
        <img className="model-icon__image" src={deepseek} alt="" width="18" height="18"/>
      </span>
    );
  }
  if (model === 'alice') {
    return (
      <span className="model-icon" data-provider-icon="alice" aria-hidden="true">
        <img className="model-icon__image" src={alice} alt="" width="18" height="18"/>
      </span>
    );
  }
  return <Sparkles className="model-icon model-icon--auto" size={18} strokeWidth={1.7} aria-hidden="true"/>;
}
