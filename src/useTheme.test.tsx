import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useTheme} from './useTheme';

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

it('applies the new palette inside the native update callback', () => {
  let update: (() => void) | undefined;
  const start = vi.fn((callback: () => void) => {
    update = callback;
    return {ready:Promise.resolve(), finished:new Promise(() => {}), skipTransition:vi.fn()};
  });
  Object.defineProperty(document, 'startViewTransition', {configurable:true, value:start});
  const {result} = renderHook(() => useTheme(false));
  act(() => result.current.toggleTheme());
  expect(start).toHaveBeenCalledTimes(1);
  expect(document.documentElement.dataset.theme).toBe('light');
  act(() => update?.());
  expect(result.current.dark).toBe(true);
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('cancels an overlapping transition and preserves the parity of rapid toggles', () => {
  let update: (() => void) | undefined;
  const skipTransition = vi.fn();
  Object.defineProperty(document, 'startViewTransition', {configurable:true, value:(callback: () => void) => {
    update = callback;
    return {ready:Promise.resolve(), finished:new Promise(() => {}), skipTransition};
  }});
  const {result} = renderHook(() => useTheme(false));
  act(() => {
    result.current.toggleTheme();
    result.current.toggleTheme();
    update?.();
  });
  expect(skipTransition).toHaveBeenCalledOnce();
  expect(result.current.dark).toBe(false);
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('switches immediately when reduced motion is enabled', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true})));
  const start = vi.fn();
  Object.defineProperty(document, 'startViewTransition', {configurable:true, value:start});
  const {result} = renderHook(() => useTheme(false));
  act(() => result.current.toggleTheme());
  expect(start).not.toHaveBeenCalled();
  expect(result.current.dark).toBe(true);
  expect(document.documentElement.dataset.theme).toBe('dark');
});
