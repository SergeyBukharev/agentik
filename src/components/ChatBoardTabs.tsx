import {useUi} from '../language';

export function ChatBoardTabs({assistantId, conversationId, active}: {
  assistantId: string;
  conversationId?: string;
  active: 'chat' | 'board';
}) {
  const {t} = useUi();
  const chat = conversationId ? `#/chat/${conversationId}` : `#/assistant/${assistantId}`;
  const board = `#/board/${assistantId}${conversationId ? '/' + conversationId : ''}`;
  return <nav className="chat-tabs chat-mode-tabs" aria-label={t('Чат и файлы','Chat and files')}>
    <a className={`chat-tabs__link${active === 'chat' ? ' chat-tabs__link--active' : ''}`} href={chat}
      aria-current={active === 'chat' ? 'page' : undefined}>{t('Чат','Chat')}</a>
    <a className={`chat-tabs__link${active === 'board' ? ' chat-tabs__link--active' : ''}`} href={board}
      aria-current={active === 'board' ? 'page' : undefined}>{t('Доска','Board')}</a>
  </nav>;
}
