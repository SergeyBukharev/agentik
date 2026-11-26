import {useMemo} from 'react';
import {Plus, Table2} from 'lucide-react';
import type {Assistant} from '../catalog';
import {MAX_CHAT_MESSAGE_LENGTH} from '../chat-contract';
import {getChatSuggestions} from '../chat-suggestions';
import {useUi} from '../language';
import './chat-suggestions.css';

export function ChatSuggestions({assistant, draft, compact, busy, onApply, onCreateBudget}: {
  assistant: Assistant;
  draft: string;
  compact: boolean;
  busy: boolean;
  onApply: (next: string) => void;
  onCreateBudget?: (opener: HTMLButtonElement) => void;
}) {
  const {language, t} = useUi();
  const prompts = useMemo(() => getChatSuggestions(assistant, language), [assistant, language]);
  const trimmedDraft = draft.trimEnd();

  return (
    <div className={`prompt-list${compact ? ' prompt-list--conversation' : ''}`} role="group"
      aria-label={t('Подсказки для сообщения', 'Message suggestions')}>
      {onCreateBudget && <button className="prompt-list__item" type="button" aria-haspopup="dialog" disabled={busy}
        onClick={event => onCreateBudget(event.currentTarget)}>
        <span>{t('Создать таблицу бюджета', 'Create a budget table')}</span><Table2 size={15} aria-hidden="true"/>
      </button>}
      {prompts.map(prompt => {
        const alreadyAdded = trimmedDraft === prompt || trimmedDraft.endsWith(`\n\n${prompt}`);
        const next = alreadyAdded ? draft : trimmedDraft ? `${draft}\n\n${prompt}` : prompt;
        return (
          <button className="prompt-list__item" type="button" key={prompt}
            disabled={busy || next.length > MAX_CHAT_MESSAGE_LENGTH} onClick={() => onApply(next)}>
            <span>{prompt}</span><Plus size={15} aria-hidden="true"/>
          </button>
        );
      })}
    </div>
  );
}
