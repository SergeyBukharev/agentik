import {useEffect, useRef, useState} from 'react';
import type {Language} from './language';

type Result = {isFinal: boolean; 0: {transcript: string}};
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: {resultIndex: number; results: ArrayLike<Result>}) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition};
type Problem = 'unsupported' | 'permission' | 'offline' | 'no-speech' | 'failed';
export function useDictation(language: Language, receive: (text: string) => void, fail: (issue: Problem) => void, disabled: boolean) {
  const [phase, setPhase] = useState<'idle'|'listening'|'finishing'>('idle');
  const current = useRef<{recognition: Recognition; text: string; endedHold: boolean; started: boolean; timer?: ReturnType<typeof setTimeout>} | null>(null);
  const callbacks = useRef({receive, fail});
  callbacks.current = {receive, fail};

  function stop() {
    const item = current.current;
    if (!item || item.endedHold) return;
    item.endedHold = true;
    setPhase('finishing');
    if (item.started) {
      try { item.recognition.stop(); } catch {}
    }
    item.timer = setTimeout(() => {
      if (current.current !== item) return;
      current.current = null;
      item.recognition.abort();
      setPhase('idle');
      if (item.text.trim()) callbacks.current.receive(item.text.trim());
      else callbacks.current.fail('no-speech');
    }, 5000);
  }

  function start() {
    if (disabled || current.current) return false;
    if (!navigator.onLine) { callbacks.current.fail('offline'); return false; }
    const api = window as SpeechWindow;
    const Constructor = api.SpeechRecognition ?? api.webkitSpeechRecognition;
    if (!Constructor) { callbacks.current.fail('unsupported'); return false; }
    const recognition = new Constructor();
    const item = {recognition, text: '', endedHold: false, started: false, timer: undefined as ReturnType<typeof setTimeout> | undefined};
    current.current = item;
    recognition.lang = language === 'en' ? 'en-US' : 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => {
      if (current.current !== item) return;
      item.started = true;
      if (item.endedHold) {
        try { recognition.stop(); } catch {}
      }
    };
    recognition.onresult = event => {
      item.text = Array.from(event.results, result => result[0].transcript).join(' ').trim();
    };
    recognition.onend = () => {
      if (current.current !== item) return;
      current.current = null;
      clearTimeout(item.timer);
      setPhase('idle');
      if (item.text) callbacks.current.receive(item.text);
      else callbacks.current.fail('no-speech');
    };
    recognition.onerror = ({error}) => {
      if (current.current !== item) return;
      current.current = null;
      clearTimeout(item.timer);
      setPhase('idle');
      if (item.text.trim() && item.endedHold) callbacks.current.receive(item.text.trim());
      else callbacks.current.fail(error === 'not-allowed' || error === 'service-not-allowed' ? 'permission'
        : error === 'no-speech' ? 'no-speech' : error === 'network' && !navigator.onLine ? 'offline' : 'failed');
    };
    try {
      recognition.start();
      setPhase('listening');
      return true;
    } catch {
      current.current = null;
      callbacks.current.fail('failed');
      return false;
    }
  }

  const actions = useRef({start, stop});
  actions.current = {start, stop};
  useEffect(() => {
    let held = false;
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyK' || event.repeat || event.ctrlKey || event.metaKey || event.isComposing) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('select,[role="combobox"],[role="listbox"]')) return;
      const editable = target?.closest('input,textarea,[contenteditable="true"]');
      if (editable && !event.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [data-state="open"][role="dialog"]')) return;
      if (actions.current.start()) { held = true; event.preventDefault(); }
    };
    const keyUp = (event: KeyboardEvent) => { if (event.code === 'KeyK' && held) { held = false; actions.current.stop(); } };
    const release = () => { held = false; actions.current.stop(); };
    const onVisibility = () => { if (document.hidden) release(); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
      const item = current.current;
      current.current = null;
      clearTimeout(item?.timer);
      item?.recognition.abort();
    };
  }, []);
  return {phase, start, stop};
}
