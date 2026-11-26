import {useEffect, useState} from 'react';
import {setLocalRoomPrivacy, shareLocalConversation, syncSharedConversation} from '../local-rooms';
import type {LocalProfile} from '../session';
import type {Conversation} from '../state';
import {RoomAccessDialog, roomError, useLocalRooms} from './RoomAccess';
import {ShareChatButton} from './ShareChatButton';
import {Modal} from './Modal';

export function ChatSharing({conversation, profile, assistantName, language = 'ru'}: {
  conversation?: Conversation;
  profile: LocalProfile;
  assistantName: string;
  language?: 'ru' | 'en';
}) {
  const t = (ru: string, en: string) => language === 'en' ? en : ru;
  const {rooms} = useLocalRooms(profile.id);
  const room = conversation && rooms.find(item => item.ownerId === profile.id && item.sourceChatId === conversation.id);
  const [showAccess, setShowAccess] = useState(false);
  const [error, setError] = useState('');
  const share = conversation && (() => {shareLocalConversation(localStorage, profile, conversation, assistantName);});
  const isShared = Boolean(room && !room.private);
  useEffect(() => {
    if (!conversation || !isShared) return;
    try { syncSharedConversation(localStorage, profile, conversation, assistantName); }
    catch (cause) { setError(roomError(cause, language)); }
  }, [assistantName, conversation, isShared, language, profile]);

  function openAccess() {
    setError('');
    try {
      if (room && !room.private) share?.();
      setShowAccess(true);
    } catch (cause) {
      setError(roomError(cause, language));
    }
  }

  return (
    <>
      <ShareChatButton label={t('Поделиться', 'Share')} accessibleLabel={t('Поделиться чатом', 'Share chat')}
        onClick={openAccess} expanded={showAccess}/>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {showAccess && (conversation ? <RoomAccessDialog
        room={room}
        profileId={profile.id}
        language={language}
        onClose={() => setShowAccess(false)}
        onOpenGroup={share}
        onRefreshLink={share}
        onMakePrivate={room ? () => {setLocalRoomPrivacy(localStorage, profile, room.id, true);} : undefined}
      /> : <Modal title={t('Доступ к чату', 'Chat access')}
        description={t('Отправьте первое сообщение, чтобы создать ссылку на этот чат.', 'Send the first message to create a link to this chat.')}
        onClose={() => setShowAccess(false)}>
        <button type="button" className="button button--primary" onClick={() => setShowAccess(false)}>
          {t('Вернуться к чату', 'Return to chat')}
        </button>
      </Modal>)}
    </>
  );
}
