import {useEffect, useState} from 'react';
import {kitPaths, type KitPage} from './kits';

export type Route = {page?: string; id?: string; path: string; kind: 'home' | 'login' | 'agreement' | 'kit' | 'workspace' | 'not-found'; kit?: KitPage; homeHref: string};
const simple = new Set(['assistants', 'characters', 'favorites', 'history', 'rooms', 'profile', 'pro', 'create']);
const detail = new Set(['assistant', 'chat', 'rooms', 'join']);

export function resolveRoute(pathname: string, hash: string, base = import.meta.env.BASE_URL): Route {
  const inRoot = pathname === base || pathname === base.replace(/\/$/, '');
  const homeHref = inRoot ? '#/' : base;
  const path = hash.slice(1) || '/';
  if (!inRoot) return {kind: 'not-found', path, homeHref};
  if (path === '/') return {kind: 'home', path, homeHref};
  if (path === '/agreement') return {kind: 'agreement', path, homeHref};
  if (path === '/login') return {kind: 'login', path, homeHref};
  const kit = kitPaths.find(item => path === `/${item}` || path === `/${item}/`);
  if (kit) return {kind: 'kit', kit, path, homeHref};
  const match = /^\/([a-z]+)(?:\/([a-zA-Z0-9_-]{1,128}))?\/?$/.exec(path);
  if (match) {
    const [, page, id] = match;
    if (id ? detail.has(page) : simple.has(page)) return {kind: 'workspace', page, id, path, homeHref};
  }
  return {kind: 'not-found', path, homeHref};
}

export function useRoute() {
  const read = () => resolveRoute(location.pathname, location.hash);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const change = () => {
      setRoute(read());
      window.scrollTo({top: 0, behavior: 'instant'});
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}
