import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {PersistentBrand} from './PersistentBrand';

it('replays the logo spring on each activation of the home link', () => {
  const {unmount} = render(<PersistentBrand href="#/" route="/" onAccess={false}/>);
  const link = screen.getByRole('link', {name:'Agentik — главная'});
  const mark = link.querySelector('.persistent-brand__mark')!;
  const cancel = vi.fn();
  const animate = vi.fn(() => ({cancel}));
  Object.defineProperty(mark, 'animate', {value:animate});

  fireEvent.contextMenu(link);
  expect(animate).not.toHaveBeenCalled();
  fireEvent.keyDown(link, {key:'F10', shiftKey:true});
  expect(animate).not.toHaveBeenCalled();
  fireEvent.click(link, {button:0, detail:1});
  expect(animate).toHaveBeenCalledTimes(1);
  fireEvent.click(link, {button:0, detail:0});
  expect(animate).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledTimes(1);
  unmount();
  expect(cancel).toHaveBeenCalledTimes(2);
});

it('blinks only the eyes when the route changes', () => {
  const {rerender} = render(<PersistentBrand href="#/" route="/" onAccess={false}/>);
  const mark = screen.getByRole('link', {name:'Agentik — главная'}).querySelector('.persistent-brand__mark')!;
  const eyes = mark.querySelector('.persistent-brand__eyes');
  expect(eyes).toBeInTheDocument();
  const spring = vi.fn();
  const blink = vi.fn(() => ({cancel:vi.fn()}));
  Object.defineProperty(mark, 'animate', {value:spring});
  Object.defineProperty(eyes!, 'animate', {value:blink});

  rerender(<PersistentBrand href="#/" route="/ui-kit" onAccess={false}/>);
  expect(blink).toHaveBeenCalledTimes(1);
  expect(spring).not.toHaveBeenCalled();
  rerender(<PersistentBrand href="#/" route="/ui-kit" onAccess={true}/>);
  expect(blink).toHaveBeenCalledTimes(1);
});
