import {beforeEach, expect, it} from 'vitest';
import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {joinLocalRoom, readLocalRooms} from '../local-rooms';
import {ChatSharing} from './ChatSharing';

const owner = {id:'owner', name:'Алиса', createdAt:0, expiresAt:Date.now()+1_000_000};
const chat = {
  id:'test-chat', assistantId:'writer', title:'Открытие', updatedAt:1,
  messages:[{role:'user' as const, content:'Старое сообщение'}],
};

beforeEach(() => localStorage.clear());

it('explains how to share a new chat before a conversation is saved', async () => {
  const user = userEvent.setup();
  render(<ChatSharing profile={owner} assistantName="Редактор"/>);

  const trigger = screen.getByRole('button', {name:'Поделиться чатом'});
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  trigger.focus();
  await user.keyboard('{Enter}');
  const dialog = within(screen.getByRole('dialog', {name:'Доступ к чату'}));
  expect(dialog.getByText(/Отправьте первое сообщение/)).toBeVisible();
  expect(dialog.queryByRole('button', {name:'Создать группу'})).not.toBeInTheDocument();
  expect(readLocalRooms(localStorage, owner.id)).toEqual([]);

  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
});

it('offers a share link after explicit confirmation and revokes guest access from the same dialog', async () => {
  const user = userEvent.setup();
  render(<ChatSharing conversation={chat} profile={owner} assistantName="Редактор"/>);
  await user.click(screen.getByRole('button',{name:'Поделиться чатом'}));
  expect(readLocalRooms(localStorage, owner.id)).toEqual([]);
  const dialog = within(screen.getByRole('dialog'));

  await user.click(dialog.getByRole('button',{name:'Создать группу'}));
  const invitation = dialog.getByRole('textbox',{name:'Приглашение'});
  expect((invitation as HTMLInputElement).value).toContain('#/join/');
  const [room] = readLocalRooms(localStorage,owner.id);
  const guest = {id:'guest',name:'Борис'};
  act(() => {joinLocalRoom(localStorage,guest,room.invite);});
  await user.click(dialog.getByText(/Участники/));
  expect(dialog.getByText('Борис')).toBeInTheDocument();

  await user.click(dialog.getByRole('button',{name:'Сделать приватным'}));
  expect(readLocalRooms(localStorage, guest.id)).toHaveLength(1);
  await user.click(dialog.getByRole('button',{name:'Закрыть доступ'}));
  expect(readLocalRooms(localStorage,guest.id)).toEqual([]);
  expect(readLocalRooms(localStorage,owner.id)[0].messages[0].body).toBe('Старое сообщение');
  expect(dialog.queryByRole('textbox',{name:'Приглашение'})).not.toBeInTheDocument();
});
