import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {agreementStorageKey} from '../agreement';
import {Agreement} from './Agreement';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('rejects a blank drawing and allows the keyboard form to save and delete local acceptance', () => {
  const view = render(<Agreement/>);
  fireEvent.click(screen.getByRole('button',{name:'Сохранить согласие'}));
  expect(screen.getByRole('alert')).toHaveTextContent('Нарисуйте подпись или введите имя.');
  expect(localStorage.getItem(agreementStorageKey())).toBeNull();

  fireEvent.click(screen.getByRole('button',{name:'Ввести имя'}));
  const input = screen.getByRole('textbox',{name:'Ваше имя'});
  fireEvent.change(input,{target:{value:'Тестовый Пользователь'}});
  fireEvent.click(screen.getByRole('button',{name:'Сохранить согласие'}));
  expect(screen.getByText('Согласие сохранено в этом браузере.').closest('[tabindex]')).toHaveFocus();

  view.unmount();
  render(<Agreement/>);
  expect(screen.getByText('Тестовый Пользователь')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Удалить отметку'}));
  expect(screen.getByRole('status')).toHaveTextContent('Запись удалена.');
  expect(localStorage.getItem(agreementStorageKey())).toBeNull();
  expect(screen.getByRole('button',{name:'Ручкой'})).toHaveFocus();
});

it('keeps the terms readable when access to local storage is denied', () => {
  const getStorage=vi.spyOn(window,'localStorage','get').mockImplementation(() => {
    throw new DOMException('Blocked','SecurityError');
  });
  try {
    render(<Agreement/>);
    expect(screen.getByRole('heading',{name:'Пользовательское соглашение'})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Ввести имя'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Ваше имя'}),{target:{value:'Тестовый Пользователь'}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить согласие'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Браузер не смог сохранить согласие.');
  } finally { getStorage.mockRestore(); }
});
