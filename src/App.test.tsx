import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {saveAccess} from './access-client';
import {ACCESS_DURATION_MS} from './access-contract';
import type {Message} from './state';

const account = 'a'.repeat(32);
const profileKey = () => `agentik:state:${localStorage.getItem('agentik:active:' + account)}`;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', import.meta.env.BASE_URL + '#/assistants');
  saveAccess({accountId: account, token: 'v1.fixture.' + 'a'.repeat(43), expiresAt: Date.now() + ACCESS_DURATION_MS, plan:'pro'});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {status: 204})));
});
afterEach(() => vi.unstubAllGlobals());
it('searches assistants and explains empty results',async()=>{
 const u=userEvent.setup();render(<App/>);
 await u.type(screen.getByRole('searchbox'), 'резюме');
 expect(screen.getByRole('heading',{name:'Карьерный навигатор'})).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Шеф на кухне'})).not.toBeInTheDocument();
 await u.clear(screen.getByRole('searchbox'));await u.type(screen.getByRole('searchbox'),'несуществующийзапрос');
 expect(screen.getByText('Пока никого не нашли')).toBeInTheDocument();
});
it('favorites survive reload and custom assistant can be opened',async()=>{
 const u=userEvent.setup();const view=render(<App/>);
 await u.click(screen.getByRole('button',{name:'В избранное: Редактор'}));
 await u.click(screen.getAllByRole('link',{name:/Избранное/})[0]);
 expect(screen.getByRole('heading',{name:'Редактор'})).toBeInTheDocument();
 await u.click(screen.getAllByRole('button',{name:'Создать помощника'})[0]);
 await u.type(screen.getByLabelText('Название'),'Мой исследователь');
 await u.type(screen.getByLabelText('Что он умеет'),'Помогает изучать историю архитектуры');
 await u.click(screen.getByRole('button',{name:'Сохранить помощника'}));
 expect(await screen.findByRole('heading',{name:'Мой исследователь'})).toBeInTheDocument();
 await waitFor(()=>expect(JSON.parse(localStorage.getItem(profileKey())!).custom).toHaveLength(1));
 view.unmount();render(<App/>);
 expect(screen.getByRole('heading',{name:'Мой исследователь'})).toBeInTheDocument();
});
it('sends a demo request and saves it to history',async()=>{
 const u=userEvent.setup();render(<App/>);
 await u.click(screen.getByRole('link',{name:'Открыть: Редактор'}));
 await u.type(await screen.findByRole('textbox',{name:'Ваше сообщение'}),'Помоги написать письмо');
 await u.click(screen.getByRole('button',{name:'Отправить сообщение'}));
 expect(await screen.findByText(/Это демонстрационный ответ/)).toBeInTheDocument();
 await u.click(screen.getByRole('link',{name:/История/}));
 expect(screen.getByRole('link',{name:/Помоги написать письмо/})).toBeInTheDocument();
});
it('retries a failed request without duplicating user messages',async()=>{
 let attempts=0;const u=userEvent.setup();render(<App requestReply={async()=>{if(attempts++===0)throw new Error('Нет связи');return 'Готовый ответ';}}/>);
 await u.click(screen.getByRole('link',{name:'Открыть: Редактор'}));
 await u.type(await screen.findByRole('textbox',{name:'Ваше сообщение'}),'Тест запроса');
 await u.click(screen.getByRole('button',{name:'Отправить сообщение'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
 expect(screen.getByRole('textbox',{name:'Ваше сообщение'})).toHaveValue('Тест запроса');
 await u.click(screen.getByRole('button',{name:'Повторить запрос'}));
 expect(await screen.findByText('Готовый ответ')).toBeInTheDocument();
 const messages=JSON.parse(localStorage.getItem(profileKey())!).conversations[0].messages;
 expect(messages.map(({role,content}:Message)=>({role,content}))).toEqual([{role:'user',content:'Тест запроса'},{role:'assistant',content:'Готовый ответ'}]);
});
it('keeps a delayed response in its original conversation after navigation',async()=>{
 let resolve!:(s:string)=>void;const u=userEvent.setup();render(<App requestReply={()=>new Promise(r=>{resolve=r;})}/>);
 await u.click(screen.getByRole('link',{name:'Открыть: Редактор'}));
 await u.type(await screen.findByRole('textbox',{name:'Ваше сообщение'}),'Первый чат');
 await u.click(screen.getByRole('button',{name:'Отправить сообщение'}));
 location.hash='#/assistants';fireEvent(window,new HashChangeEvent('hashchange'));
 await u.click(await screen.findByRole('link',{name:'Открыть: Шеф на кухне'}));
 resolve('Ответ редактора');
 await waitFor(()=>expect(JSON.parse(localStorage.getItem(profileKey())!).conversations[0].messages).toHaveLength(2));
 expect(screen.queryByText('Ответ редактора')).not.toBeInTheDocument();
});
it('preserves an edited draft when retrying the previously failed message',async()=>{
 let attempts=0;const u=userEvent.setup();render(<App requestReply={async()=>{if(attempts++===0)throw new Error('Нет связи');return 'Ответ';}}/>);
 await u.click(screen.getByRole('link',{name:'Открыть: Редактор'}));
 await u.type(await screen.findByRole('textbox',{name:'Ваше сообщение'}),'Первый текст');await u.click(screen.getByRole('button',{name:'Отправить сообщение'}));
 await screen.findByRole('alert');await u.clear(screen.getByRole('textbox',{name:'Ваше сообщение'}));await u.type(await screen.findByRole('textbox',{name:'Ваше сообщение'}),'Новый черновик');
 await u.click(screen.getByRole('button',{name:'Повторить запрос'}));await screen.findByText('Ответ');
 expect(screen.getByRole('textbox',{name:'Ваше сообщение'})).toHaveValue('Новый черновик');
});
it('starts a new conversation with an empty draft while the previous reply is pending',async()=>{
 const u=userEvent.setup();render(<App requestReply={()=>new Promise(()=>{})}/>);
 await u.click(screen.getByRole('link',{name:'Открыть: Редактор'}));await u.type(await screen.findByRole('textbox',{name:'Ваше сообщение'}),'Первый запрос');
 await u.click(screen.getByRole('button',{name:'Отправить сообщение'}));await u.click(screen.getByRole('link',{name:'Новый разговор'}));
 expect(screen.getByRole('textbox',{name:'Ваше сообщение'})).toHaveValue('');
});
