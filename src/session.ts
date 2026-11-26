import {ACCESS_DURATION_MS} from './access-contract';

export const SESSION_MS = ACCESS_DURATION_MS;
export type LocalProfile = {id: string; name: string; createdAt: number; expiresAt: number};
type ProfileStore = Pick<Storage, 'getItem' | 'setItem'>;

const registryKey = (account?: string) => account ? `agentik:profiles:v1:${account}` : 'agentik:profiles:v1';
const selectedKey = (account?: string) => account ? `agentik:active:${account}` : 'agentik:active';

export function createProfile(name: string, now = Date.now()): LocalProfile {
  return {id: crypto.randomUUID(), name: name.trim().slice(0, 60) || 'Моё пространство', createdAt: now, expiresAt: now + SESSION_MS};
}

export function listProfiles(storage: Pick<Storage, 'getItem'>, now = Date.now(), account?: string): LocalProfile[] {
  try {
    const data = JSON.parse(storage.getItem(registryKey(account)) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(profile => profile && typeof profile.id === 'string' && typeof profile.name === 'string'
      && Number.isFinite(profile.expiresAt) && profile.expiresAt > now);
  } catch {
    return [];
  }
}

export function saveProfile(storage: ProfileStore, profile: LocalProfile, account?: string): boolean {
  try {
    const profiles = listProfiles(storage, profile.createdAt, account);
    storage.setItem(registryKey(account), JSON.stringify([...profiles.filter(item => item.id !== profile.id), profile]));
    return true;
  } catch {
    return false;
  }
}

export function resumeProfile(storage: ProfileStore, id: string, now = Date.now(), account?: string): LocalProfile | null {
  const profile = listProfiles(storage, now, account).find(item => item.id === id);
  if (!profile) return null;
  const renewed = {...profile, expiresAt: now + SESSION_MS};
  saveProfile(storage, renewed, account);
  return renewed;
}

export function activeProfile(account?: string): LocalProfile {
  const key = selectedKey(account);
  try {
    const id = sessionStorage.getItem(key) || localStorage.getItem(key);
    const profile = id ? resumeProfile(localStorage, id, Date.now(), account) : null;
    if (profile) {
      sessionStorage.setItem(key, profile.id);
      return profile;
    }
  } catch { /* The workspace falls back to an in-memory profile. */ }
  const profile = createProfile('Моё пространство');
  selectProfile(profile, account);
  return profile;
}

export function selectProfile(profile: LocalProfile, account?: string) {
  try {
    saveProfile(localStorage, profile, account);
    localStorage.setItem(selectedKey(account), profile.id);
    sessionStorage.setItem(selectedKey(account), profile.id);
  } catch { /* The workspace remains usable in memory. */ }
}
