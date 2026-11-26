import {useState} from 'react';
import {Bot, Plus, X} from 'lucide-react';
import type {Assistant} from '../catalog';
import type {Language} from '../language';
import {addLocalRoomBot, removeLocalRoomBot, type LocalRoom} from '../local-rooms';
import type {LocalProfile} from '../session';
import {AgentIcon} from './Brand';
import {Modal} from './Modal';
import {roomError} from './RoomAccess';

export function RoomCharacters({room, profile, custom, templates, language, onClose}: {
  room: LocalRoom;
  profile: LocalProfile;
  custom: readonly Assistant[];
  templates: readonly Assistant[];
  language: Language;
  onClose: () => void;
}) {
  const t = (ru: string, en: string) => language === 'en' ? en : ru;
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const owner = room.ownerId === profile.id;
  const active = room.bots ?? [];
  const activeIds = new Set(active.map(bot => bot.id));
  const archived = active.filter(bot => !custom.some(item => item.id === bot.id) && !templates.some(item => item.id === bot.id));
  const sections = owner ? [
    {name:t('Мои персонажи','My characters'), items:[...custom, ...archived]},
    {name:t('Шаблоны','Templates'), items:templates},
  ] : [{name:t('В чате','In this chat'), items:active}];

  function change(bot: Assistant, present: boolean) {
    setError('');
    setNotice('');
    try {
      if (present) removeLocalRoomBot(localStorage,profile,room.id,bot.id);
      else addLocalRoomBot(localStorage,profile,room.id,bot);
      setNotice(present ? t(`«${bot.name}» удалён из чата.`, `Removed ${bot.name} from the chat.`)
        : t(`«${bot.name}» в чате.`, `${bot.name} is in the chat.`));
    } catch (cause) {
      setError(roomError(cause,language));
    }
  }

  return (
    <Modal title={t('Персонажи в чате','Chat characters')}
      description={t('Введите @ и выберите персонажа, чтобы он ответил в группе.', 'Type @ and pick a character to call them into the conversation.')}
      onClose={onClose}>
      <div className="room-characters">
        {sections.every(section => !section.items.length) && <p className="form__hint">{t('В чате пока нет персонажей.', 'There are no characters in this chat yet.')}</p>}
        {sections.map(({name,items}) => items.length > 0 && <section key={name}>
          <h3 className="room-characters__heading">{name}</h3>
          <ul className="room-characters__list">
            {items.map(bot => {
              const present = activeIds.has(bot.id);
              const action = present ? t('Убрать', 'Remove') : t('Добавить', 'Add');
              return <li className="room-characters__row" key={bot.id}>
                <span className={`avatar avatar--${bot.color}`} aria-hidden="true"><AgentIcon name={bot.icon} size={18}/></span>
                <div className="room-characters__info"><strong>{bot.name}</strong><span>{bot.description}</span>
                  {owner && present && <small><Bot size={14} aria-hidden="true"/>{t('В чате','In chat')}</small>}
                </div>
                {owner && <button type="button" className="button button--secondary room-characters__action"
                  aria-label={`${action} «${bot.name}»`} onClick={() => change(bot,present)}>
                  {present ? <X size={16} aria-hidden="true"/> : <Plus size={16} aria-hidden="true"/>}{action}
                </button>}
              </li>;
            })}
          </ul>
        </section>)}
        <span className="sr-only" role="status">{notice}</span>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
