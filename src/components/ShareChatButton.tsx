import './share-chat-button.css';

export function ShareChatButton({label, accessibleLabel, onClick, disabled, expanded}: {
  label: string;
  accessibleLabel: string;
  onClick: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <button type="button" className="button button--secondary chat-share" aria-label={accessibleLabel}
      aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick} disabled={disabled}>
      <svg className="chat-share__icon" viewBox="0 0 24 24" width="18" height="18" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M8 9H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"/>
        <path className="chat-share__arrow" d="M12 15V3m-4 4 4-4 4 4"/>
        <path className="chat-share__spark" strokeWidth="1.5" d="M19.5 3v3m-1.5-1.5h3"/>
      </svg>
      <span>{label}</span>
    </button>
  );
}
