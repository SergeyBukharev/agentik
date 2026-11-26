import {useState, type FormEvent} from 'react';
import {Link2, LockKeyhole, Plus, Users} from 'lucide-react';
import type {ChatImage} from '../chat-media';
import type {Language} from '../language';
import {
  joinLocalRoom, makeRoom, postLocalMessage, renewLocalInvite, setLocalRoomPrivacy, type LocalRoom,
} from '../local-rooms';
import type {LocalProfile} from '../session';
import {ChatComposer, MessageImages} from './ChatComposer';
import {Modal} from './Modal';
import {RoomAccessDialog, roomError, useLocalRooms} from './RoomAccess';
import {Scene} from './Scene';
import {WelcomeTitle} from './ShaderEffects';

type RoomsProps = {
  roomId?: string;
  joinToken?: string;
  profile: LocalProfile;
  language?: Language;
  onSend?: (anchor: HTMLElement | null) => void;
  messagePrice?: number;
  billMessage?: (commit:()=>boolean) => Promise<boolean>;
};

export function Rooms({roomId, joinToken, profile, language = 'ru', onSend, messagePrice, billMessage}: RoomsProps) {
  const t = (ru: string, en: string) => language === 'en' ? en : ru;
  const {rooms, storageUnavailable} = useLocalRooms(profile.id);
  const [error, setError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const room = rooms.find(item => item.id === roomId);
  const openRoom = (item: LocalRoom) => {location.hash = '#/rooms/' + item.id;};
  const createLabel = t('Создать комнату', 'Create a group');

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const field = form.elements.namedItem('title') as HTMLInputElement;
    const title = field.value.trim();
    if (!title || title.length > 100) {
      setTitleError(t('Укажите название до 100 символов.', 'Enter a name of up to 100 characters.'));
      field.focus();
      return;
    }
    setTitleError('');
    try {
      const created = makeRoom(localStorage, profile, title);
      setCreating(false);
      openRoom(created);
    } catch (cause) {
      setError(roomError(cause, language));
    }
  }

  function join(token: string) {
    try {
      const joined = joinLocalRoom(localStorage, profile, token);
      openRoom(joined);
    } catch (cause) {
      setError(roomError(cause, language));
    }
  }

  function send(target: LocalRoom, images: ChatImage[], anchor: HTMLElement | null): boolean {
    try {
      postLocalMessage(localStorage, profile, target.id, draft, Date.now(), images);
      setDraft('');
      setError('');
      onSend?.(anchor);
      return true;
    } catch (cause) {
      setError(roomError(cause, language));
      return false;
    }
  }

  if (joinToken) return (
    <section className="rooms">
      <div className="empty-state">
        <Scene kind="together"/>
        <h1 className="section-title">{t('Приглашение в группу', 'Group invitation')}</h1>
        <p className="empty-state__text">{t(
          'Вы присоединитесь как '+profile.name+'. Ссылка работает между профилями этого браузера.',
          'You will join as '+profile.name+'. The invite works across profiles in this browser.',
        )}</p>
        <button className="button button--primary" onClick={() => join(joinToken)}>{t('Присоединиться', 'Join group')}</button>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
      </div>
    </section>
  );

  if (roomId && !room) return (
    <section className="chat">
      <div className="empty-state">
        <Scene kind="together"/>
        <h1 className="section-title">{t('Чат недоступен', 'Chat unavailable')}</h1>
        <p className="empty-state__text">{t(
          'Попросите владельца прислать новое приглашение. Если он закрыл доступ, история осталась у него.',
          'Ask the owner for a fresh invite. If they made the chat private, they have kept its history.',
        )}</p>
        <a className="button button--secondary" href="#/rooms">{t('К комнатам', 'Back to groups')}</a>
      </div>
    </section>
  );

  if (room) {
    const owner = room.ownerId === profile.id;
    const openAccess = () => {
      setError('');
      setAccessOpen(true);
    };
    return (
      <section className="chat room-chat">
        <header className="chat__header">
          <div className="chat__heading">
            <a className="text-link" href="#/rooms">{t('Все комнаты', 'All groups')}</a>
            <h1 className="chat__title">{room.title}</h1>
            <span className="chat__subtitle">{room.private ? t('Приватный чат', 'Private chat') : t('Участники', 'Members')+' · '+room.members.length}</span>
          </div>
          <div className="chat__actions">
            <button type="button" className="button button--secondary chat-share" onClick={openAccess}
              aria-label={room.private ? t('Управление доступом', 'Manage access') : t('Пригласить участника', 'Invite a member')}>
              {room.private ? <LockKeyhole size={17}/> : <Link2 size={17}/>}
              <span>{room.private ? t('Доступ', 'Access') : t('Пригласить', 'Invite')}</span>
            </button>
          </div>
        </header>
        <div className="chat__messages room-message-list" aria-live="polite">
          {!room.messages.length && <div className="chat-welcome">
            <Scene kind="together"/>
            <WelcomeTitle text={t('Начните с «привет»', 'Say hello')}/>
            <p className="chat-welcome__text">{t('Напишите сообщение или пригласите другого участника.', 'Write a message or invite another member.')}</p>
          </div>}
          {room.messages.map(message => (
            <article className={'message'+(message.userId === profile.id ? ' message--user' : '')} key={message.id}>
              <span className="message__author">{message.name} · {new Date(message.createdAt).toLocaleTimeString(language, {hour:'2-digit', minute:'2-digit'})}</span>
              {message.body && <p className="message__body">{message.body}</p>}
              <MessageImages images={message.images}/>
            </article>
          ))}
        </div>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <ChatComposer draft={draft} onDraft={setDraft} onSubmit={(images, anchor) => {
          const commit = () => send(room,images,anchor);
          return billMessage ? billMessage(commit) : commit();
        }}
          price={messagePrice} messageId="room-message" language={language}/>
        {accessOpen && <RoomAccessDialog
          room={room}
          currentGroup
          profileId={profile.id}
          language={language}
          onClose={() => setAccessOpen(false)}
          onOpenGroup={owner ? () => {setLocalRoomPrivacy(localStorage, profile, room.id, false);} : undefined}
          onRefreshLink={() => {renewLocalInvite(localStorage, profile, room.id);}}
          onMakePrivate={owner ? () => {setLocalRoomPrivacy(localStorage, profile, room.id, true);} : undefined}
        />}
      </section>
    );
  }

  return (
    <section className="rooms">
      <div className="section-heading">
        <div>
          <h1 className="section-title">{t('Общие комнаты', 'Groups')}</h1>
          <p className="section-description">{t('Приглашайте участников по ссылке.', 'Invite others with a link.')}</p>
        </div>
        <button className="button button--primary" onClick={() => {setError('');setTitleError('');setCreating(true);}}>
          <Plus size={18}/>{createLabel}
        </button>
      </div>
      {rooms.length ? (
        <div className="history-list">
          {rooms.map(item => (
            <a className="history-item" key={item.id} href={'#/rooms/'+item.id}>
              <span className="avatar avatar--lavender">{item.private ? <LockKeyhole size={20}/> : <Users size={22}/>}</span>
              <span className="history-item__text">
                <strong>{item.title}</strong>
                <span>{item.private ? t('Приватный чат', 'Private chat') : t('Участники', 'Members')+' · '+item.members.length}</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Scene kind="together"/>
          <h2 className="empty-state__title">{t('У вас пока нет групп', 'No groups yet')}</h2>
          <p className="empty-state__text">{t('Создайте комнату или поделитесь личным чатом.', 'Create a group or share a private chat.')}</p>
        </div>
      )}
      {storageUnavailable && <p className="notice notice--error" role="alert">{t('Хранилище браузера недоступно.', 'Browser storage is unavailable.')}</p>}
      {creating && (
        <Modal title={t('Новая группа', 'New group')} description={t('После создания вы сможете пригласить участников.', 'You can invite members after creating the group.')}
          onClose={() => setCreating(false)}>
          <form className="form" onSubmit={create} noValidate>
            <label htmlFor="room-title" className="form__label">{t('Название комнаты', 'Group name')}</label>
            <input id="room-title" name="title" aria-required="true" maxLength={100} className="form__input"
              aria-invalid={!!titleError} aria-describedby={titleError ? 'room-title-error' : undefined}
              onChange={() => setTitleError('')}/>
            {titleError && <p className="notice notice--error" id="room-title-error" role="alert">{titleError}</p>}
            {error && <p className="notice notice--error" role="alert">{error}</p>}
            <button className="button button--primary">{createLabel}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
