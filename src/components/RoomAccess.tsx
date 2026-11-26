import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Check, Link2, LockKeyhole, Share2, Users} from 'lucide-react';
import {LOCAL_ROOMS_KEY, readLocalRooms, type LocalRoom} from '../local-rooms';
import {Modal} from './Modal';
import './room-access.css';

export function useLocalRooms(profileId: string) {
  const [rooms, setRooms] = useState<LocalRoom[]>(() => {
    try { return readLocalRooms(localStorage, profileId); } catch { return []; }
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try {
        setRooms(readLocalRooms(localStorage, profileId));
        setStorageUnavailable(false);
      } catch {
        setRooms([]);
        setStorageUnavailable(true);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_ROOMS_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener('agentik:rooms', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('agentik:rooms', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [profileId]);
  return {rooms, storageUnavailable};
}

const roomErrors: Record<string, string> = {
  'Браузер не смог сохранить комнату. Освободите место и повторите.': 'Your browser could not save the chat. Free up space and try again.',
  'Комната не найдена или приглашение истекло. Локальные ссылки работают только в этом браузере.': 'The chat was removed or the invite expired. Local links work in this browser only.',
  'У профиля нет доступа к этой комнате.': 'This profile no longer has access to the chat.',
  'Напишите сообщение до 6000 символов или прикрепите изображение.': 'Write a message of up to 6,000 characters or attach an image.',
  'Для этого чата приглашения закрыты.': 'Invites are closed for this chat.',
  'Настройки доступа может менять только владелец.': 'Only the owner can manage access.',
  'Выберите одно поддерживаемое изображение.': 'Choose one supported image.',
  'Ботов может добавлять только владелец комнаты.': 'Only the group owner can add characters.',
  'Ботов может удалять только владелец комнаты.': 'Only the group owner can remove characters.',
  'Выберите бота для комнаты.': 'Choose a character for the group.',
};

export function roomError(error: unknown, language: 'ru' | 'en') {
  const message = error instanceof Error ? error.message : '';
  return language === 'en' ? roomErrors[message] ?? 'Could not save the change. Try again.'
    : message || 'Не удалось сохранить изменение. Попробуйте ещё раз.';
}

export function RoomAccessDialog({room, profileId, language = 'ru', currentGroup = false, onClose, onOpenGroup, onRefreshLink, onMakePrivate}: {
  room?: LocalRoom;
  profileId: string;
  language?: 'ru' | 'en';
  currentGroup?: boolean;
  onClose: () => void;
  onOpenGroup?: () => void;
  onRefreshLink?: () => void;
  onMakePrivate?: () => void;
}) {
  const t = (ru: string, en: string) => language === 'en' ? en : ru;
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const hasAccess = room && !room.private;
  const code = hasAccess && room.inviteExpiresAt > Date.now() ? room.invite : '';
  const link = code ? location.origin + location.pathname + '#/join/' + code : '';
  const title = t('Доступ к чату', 'Chat access');
  useEffect(() => { if (confirmPrivate) cancel.current?.focus(); }, [confirmPrivate]);

  function run(change: () => void, note = '') {
    setError('');
    setNotice('');
    try {
      change();
      if (note) setNotice(note);
    } catch (cause) {
      setError(roomError(cause, language));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setNotice(t('Ссылка скопирована.', 'Invite link copied.'));
      setError('');
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice(t('Скопируйте выделенную ссылку.', 'Copy the selected link.'));
    }
  }

  async function shareLink() {
    try {
      await navigator.share({title: room?.title, url: link});
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') await copyLink();
    }
  }

  return (
    <Modal title={title} description={t('Управляйте приглашениями и участниками.', 'Manage invitations and members.')} onClose={onClose}>
      <div className="room-access">
        {confirmPrivate ? (
          <>
            <div className="room-access__summary">
              <LockKeyhole size={20}/>
              <p>{t('Приглашение перестанет действовать, а участники потеряют доступ. История останется у вас.',
                'The invite will stop working and members will lose access. You keep the chat history.')}</p>
            </div>
            <div className="room-access__actions">
              <button ref={cancel} type="button" className="button button--secondary" onClick={() => setConfirmPrivate(false)}>{t('Отмена', 'Cancel')}</button>
              <button type="button" className="button button--primary" onClick={() => onMakePrivate && run(() => {
                onMakePrivate();
                setConfirmPrivate(false);
              }, t('Чат стал приватным.', 'The chat is now private.'))}>{t('Закрыть доступ', 'Remove guest access')}</button>
            </div>
          </>
        ) : hasAccess ? (
          <>
            {link ? (
              <div className="form">
                <label htmlFor="local-invite" className="form__label">{t('Приглашение', 'Invite link')}</label>
                <input ref={input} id="local-invite" className="form__input" value={link} readOnly onFocus={event => event.currentTarget.select()}/>
                <p className="form__hint">{t('Ссылка действует 24 часа и открывается в другом профиле этого браузера.',
                  'The link works with other profiles in this browser for 24 hours.')}</p>
                <div className="room-access__actions">
                  <button type="button" className="button button--primary" onClick={() => void copyLink()}>
                    {notice === t('Ссылка скопирована.', 'Invite link copied.') ? <Check size={18}/> : <Link2 size={18}/>}
                    {t('Скопировать ссылку', 'Copy link')}
                  </button>
                  {typeof navigator.share === 'function' && <button type="button" className="button button--secondary" onClick={() => void shareLink()}>
                    <Share2 size={18}/>{t('Отправить…', 'Share…')}
                  </button>}
                </div>
              </div>
            ) : onRefreshLink ? (
              <button type="button" className="button button--secondary" onClick={() => run(onRefreshLink)}>
                <Link2 size={18}/>{t('Обновить приглашение', 'Renew invite')}
              </button>
            ) : null}
            <details className="room-access__members">
              <summary>{t('Участники', 'Members')} · {room.members.length}</summary>
              <ul>{room.members.map(person => <li key={person.id}>
                {person.name}{person.id === room.ownerId && <span>{t('владелец', 'owner')}</span>}
              </li>)}</ul>
            </details>
            {room.sourceChatId && !currentGroup && (
              <a className="button button--secondary room-access__open" href={'#/rooms/' + room.id} onClick={onClose}>
                {t('Открыть группу', 'Open group')}<ArrowUpRight size={17}/>
              </a>
            )}
            {room.ownerId === profileId && onMakePrivate && (
              <button type="button" className="button button--text room-access__privacy" onClick={() => {setError('');setNotice('');setConfirmPrivate(true);}}>
                <LockKeyhole size={17}/>{t('Сделать приватным', 'Make private')}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="room-access__summary">
              <Users size={20}/>
              <p>{room
                ? t('Чат открыт только вам. При повторном открытии доступа новые участники увидят историю.',
                  'This chat is private. If you share it again, new members will see its history.')
                : t('Создайте группу на основе этого чата. Участники по ссылке увидят существующие сообщения.',
                  'Create a group from this chat. People who follow the invite can see existing messages.')}</p>
            </div>
            <div className="room-access__actions">
              {onOpenGroup && <button type="button" className="button button--primary" onClick={() => run(onOpenGroup)}>
                {room ? t('Открыть групповой доступ', 'Share with a group') : t('Создать группу', 'Create group')}
              </button>}
              {room?.sourceChatId && !currentGroup && <a className="button button--secondary" href={'#/rooms/' + room.id} onClick={onClose}>
                {t('Открыть историю группы', 'Open group history')}<ArrowUpRight size={17}/>
              </a>}
            </div>
          </>
        )}
        {notice && <p role="status" className="room-access__notice">{notice}</p>}
        {error && <p role="alert" className="notice notice--error">{error}</p>}
      </div>
    </Modal>
  );
}
