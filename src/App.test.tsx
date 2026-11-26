import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,waitFor,fireEvent,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {saveAccess} from './access-client';
import {ACCESS_DURATION_MS} from './access-contract';
import {emptyState, saveState, type Message} from './state';
import {activeProfile} from './session';

const account = 'a'.repeat(32);
const profileKey = () => `agentik:state:${localStorage.getItem('agentik:active:' + account)}`;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', import.meta.env.BASE_URL + '#/assistants');
  saveAccess({accountId: account, token: 'v1.fixture.' + 'a'.repeat(43), expiresAt: Date.now() + ACCESS_DURATION_MS, plan:'pro'});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {status: 204})));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('opens a protected deep link in the hosted preview when the static build has no access API', () => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv('VITE_ACCESS_PREVIEW_URL', 'https://preview.example.test/agentik/');
  history.replaceState(null, '', import.meta.env.BASE_URL + '#/assistant/writer');
  render(<App/>);
  expect(screen.getByRole('link', {name:'Войти в превью'})).toHaveAttribute('href', 'https://preview.example.test/agentik/#/assistant/writer');
  expect(screen.queryByRole('textbox', {name:'Код доступа'})).toBeNull();
});
it('hides onboarding after the first saved chat and shows only configured announcements on home', async () => {
 history.replaceState(null, '', import.meta.env.BASE_URL + '#/');
 const user = userEvent.setup();
 const view = render(<App/>);
 expect(screen.getByRole('heading', {name:/Меньше рутины/})).toBeInTheDocument();
 await user.click(screen.getByRole('link', {name:'Открыть: Редактор'}));
 await user.type(await screen.findByRole('textbox', {name:'Ваше сообщение'}), 'Первый разговор');
 await user.click(screen.getByRole('button', {name:'Отправить сообщение'}));
 await screen.findByText(/Это демонстрационный ответ/);
 await user.click(screen.getByRole('link', {name:/^Для вас$/}));
 expect(await screen.findByRole('heading', {name:'Найдите своего помощника', level:1})).toBeInTheDocument();
 expect(screen.queryByRole('heading', {name:/Меньше рутины/})).toBeNull();

 view.unmount();
 vi.stubEnv('VITE_SERVICE_ANNOUNCEMENTS', JSON.stringify([
  {id:'offer',kind:'promotion',title:'Пробная акция',description:'Подробности акции'},
  {id:'notice',kind:'important',title:'Важное обновление',description:'Информация от Agentik'},
 ]));
 render(<App/>);
 expect(screen.getByRole('heading', {name:'Важное обновление'})).toBeInTheDocument();
 expect(screen.queryByRole('heading', {name:/Меньше рутины/})).toBeNull();
 await user.click(screen.getByRole('button', {name:'Следующее объявление'}));
 expect(screen.getByRole('heading', {name:'Пробная акция'})).toBeInTheDocument();
});
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
it('shows saved message totals across an assistant’s conversations and ignores drafts', async () => {
 const user = userEvent.setup();
 const profile = activeProfile(account);
 const updatedAt = Date.now();
 const sent: Message = {role:'user', content:'Запрос'};
 const reply: Message = {role:'assistant', content:'Ответ'};
 saveState(localStorage, {...emptyState(), conversations:[
  {id:'writer-first', assistantId:'writer', title:'Первый', updatedAt, messages:[sent, reply]},
  {id:'writer-second', assistantId:'writer', title:'Второй', updatedAt, messages:[sent]},
  {id:'chef-greeting', assistantId:'chef', title:'Приветствие', updatedAt, messages:[reply]},
 ]}, profile.id, updatedAt, account);
 render(<App/>);
 const editor = () => screen.getByRole('link', {name:'Открыть: Редактор'});
 const chef = () => screen.getByRole('link', {name:'Открыть: Шеф на кухне'});
 expect(editor()).toHaveAccessibleDescription('Сообщений: 3');
 expect(within(editor()).getByText('3', {exact:true})).toBeVisible();
 expect(chef()).toHaveAccessibleDescription('');

 await user.click(chef());
 await user.type(await screen.findByRole('textbox', {name:'Ваше сообщение'}), 'Черновик');
 location.hash = '#/assistants'; fireEvent(window, new HashChangeEvent('hashchange'));
 await screen.findByRole('link', {name:'Открыть: Шеф на кухне'});
 expect(chef()).toHaveAccessibleDescription('');
 expect(editor()).toHaveAccessibleDescription('Сообщений: 3');

 await user.click(chef());
 expect(await screen.findByRole('textbox', {name:'Ваше сообщение'})).toHaveValue('Черновик');
 await user.click(screen.getByRole('button', {name:'Отправить сообщение'}));
 await screen.findByText(/Это демонстрационный ответ/);
 location.hash = '#/assistants'; fireEvent(window, new HashChangeEvent('hashchange'));
 expect(await screen.findByRole('link', {name:'Открыть: Шеф на кухне'})).toHaveAccessibleDescription('Сообщений: 3');
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
