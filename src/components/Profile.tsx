import {useUi} from '../language';
import {useState, type ReactNode, type FormEvent} from 'react';
import {Check, FlaskConical, Plus, Sparkles} from 'lucide-react';
import {createProfile, listProfiles, resumeProfile, type LocalProfile} from '../session';
import {demoAccessEnabled} from '../access-client';
import {Modal} from './Modal';
import {AgentSelect} from './AgentSelect';

export function Profile({onClose, mode, setMode, profile, accountId, preferences, onSwitch, onSignOut}: {
  onClose: () => void;
  mode: 'demo' | 'live';
  setMode: (mode: 'demo' | 'live') => void;
  profile: LocalProfile;
  accountId: string;
  preferences?:ReactNode;
  onSwitch: (profile: LocalProfile) => void;
  onSignOut: () => void;
}) {
  const {t} = useUi();
  const [adding, setAdding] = useState(false);
  const [nameError,setNameError]=useState(false);
  let profiles: LocalProfile[] = [];
  try { profiles = listProfiles(localStorage, Date.now(), accountId); } catch { /* The active profile is still available. */ }
  if (!profiles.some(item => item.id === profile.id)) profiles.push(profile);

  function choose(item: LocalProfile) {
    let renewed = item;
    try { renewed = resumeProfile(localStorage, item.id, Date.now(), accountId) ?? item; } catch {}
    onSwitch(renewed);
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name=String(new FormData(event.currentTarget).get('name')??'').trim();
    if (!name) {
      setNameError(true);
      event.currentTarget.querySelector<HTMLInputElement>('#profile-name')?.focus();
      return;
    }
    setNameError(false);
    onSwitch(createProfile(name));
  }

  return (
    <Modal title={t('Ваше пространство','Your workspace')} description={t('Профили на этом устройстве хранят отдельные разговоры и избранное.','Each local profile keeps its own chats and favorites.')} onClose={onClose}>
      <div className="profile-list">
        {profiles.map(item => (
          <button className="profile-list__item" key={item.id} onClick={() => choose(item)} aria-pressed={item.id === profile.id}>
            <span className="profile-button__avatar" aria-hidden="true">{item.name[0]}</span>
            <span>{item.name}</span>{item.id === profile.id && <Check size={19}/>}
          </button>
        ))}
      </div>
      <button className="button button--secondary" onClick={() => {setAdding(!adding);setNameError(false);}} aria-expanded={adding}>
        <Plus size={18}/> {t('Другой профиль','Add profile')}
      </button>
      {adding && (
        <form className="form profile__new" onSubmit={add} noValidate>
          <label htmlFor="profile-name" className="form__label">{t('Как вас зовут?','Your name')}</label>
          <input id="profile-name" name="name" required maxLength={60} className="form__input" autoComplete="given-name" aria-invalid={nameError || undefined} aria-describedby={nameError ? 'profile-name-error' : undefined} onChange={()=>setNameError(false)}/>
          {nameError&&<p className="notice notice--error" id="profile-name-error" role="alert">{t('Укажите имя профиля.','Enter a profile name.')}</p>}
          <button className="button button--primary">{t('Создать пространство','Create profile')}</button>
        </form>
      )}
      <div className="form profile__auth">
        <label htmlFor="mode" className="form__label">{t('Режим ответов','Reply mode')}</label>
        <AgentSelect id="mode" fullWidth label={t('Режим ответов','Reply mode')} value={mode} onChange={setMode}
          options={[
            {value:'demo', label:t('Демо, включая офлайн','Demo with offline support'), icon:<FlaskConical size={17} aria-hidden="true"/>},
            ...(!demoAccessEnabled ? [{value:'live' as const, label:t('AI через сервер','AI via server'), icon:<Sparkles size={17} aria-hidden="true"/>}] : []),
          ]}/>
      </div>
      {preferences}
      <a className="text-link profile__agreement" href="#/agreement" onClick={onClose}>
        {t('Пользовательское соглашение','User agreement')}
      </a>
      <div className="profile__buttons">
        <button className="button button--text" onClick={onSignOut}>{t('Выйти','Sign out')}</button>
        <button className="button button--primary" onClick={onClose}>{t('Готово','Done')}</button>
      </div>
    </Modal>
  );
}
