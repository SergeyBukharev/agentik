import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {FavoriteButton} from './FavoriteButton';

afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

it('springs on activation, emits particles only on add, and clears them when they finish', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false})));
  const onToggle = vi.fn();
  const view = render(<FavoriteButton pressed={false} label="Favorite" onToggle={onToggle}/>);
  const button = screen.getByRole('button', {name:'Favorite'});
  const star = button.querySelector('svg');
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledOnce();
  expect(button.querySelector('svg')).not.toBe(star);
  const dots = button.querySelectorAll('.favorite-button__particle');
  expect(dots).toHaveLength(5);
  act(() => {vi.advanceTimersByTime(450);});
  expect(button.querySelectorAll('.favorite-button__particle')).toHaveLength(0);

  view.rerender(<FavoriteButton pressed={true} label="Favorite" onToggle={onToggle}/>);
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledTimes(2);
  expect(button.querySelectorAll('.favorite-button__particle')).toHaveLength(0);
});

it('still toggles a favorite when reduced motion is enabled', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true})));
  const onToggle = vi.fn();
  render(<FavoriteButton pressed={false} label="Favorite" onToggle={onToggle}/>);
  const button = screen.getByRole('button', {name:'Favorite'});
  const star = button.querySelector('svg');
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledOnce();
  expect(button.querySelector('svg')).toBe(star);
  expect(button.querySelectorAll('.favorite-button__particle')).toHaveLength(0);
});
