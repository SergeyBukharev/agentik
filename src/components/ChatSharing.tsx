import {useEffect, useState} from 'react';
import {Share2} from 'lucide-react';
import {setLocalRoomPrivacy, shareLocalConversation, syncSharedConversation} from '../local-rooms';
import type {LocalProfile} from '../session';
import type {Conversation} from '../state';
import {RoomAccessDialog, roomError, useLocalRooms} from './RoomAccess';

export function ChatSharing({conversation, profile, assistantName, language = 'ru'}: {
  conversation: Conversation;
  profile: LocalProfile;
  assistantName: string;
  language?: 'ru' | 'en';
}) {
  const t = (ru: string, en: string) => language === 'en' ? en : ru;
  const {rooms} = useLocalRooms(profile.id);
  const room = rooms.find(item => item.ownerId === profile.id && item.sourceChatId === conversation.id);
  const [showAccess, setShowAccess] = useState(false);
  const [error, setError] = useState('');
  const share = () => {shareLocalConversation(localStorage, profile, conversation, assistantName);};
  const isShared = Boolean(room && !room.private);
  useEffect(() => {
    if (!isShared) return;
    try { syncSharedConversation(localStorage, profile, conversation, assistantName); }
    catch (cause) { setError(roomError(cause, language)); }
  }, [assistantName, conversation, isShared, language, profile]);

  function openAccess() {
    setError('');
    try {
      if (room && !room.private) share();
      setShowAccess(true);
    } catch (cause) {
      setError(roomError(cause, language));
    }
  }

  return (
    <>
      <button
        className="button button--secondary chat-share"
        type="button"
        aria-label={t('Поделиться чатом', 'Share chat')}
        onClick={openAccess}
      >
        <Share2 size={17}/><span>{t('Поделиться', 'Share')}</span>
      </button>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {showAccess && <RoomAccessDialog
        room={room}
        profileId={profile.id}
        language={language}
        onClose={() => setShowAccess(false)}
        onOpenGroup={share}
        onRefreshLink={share}
        onMakePrivate={room ? () => {setLocalRoomPrivacy(localStorage, profile, room.id, true);} : undefined}
      />}
    </>
  );
}
