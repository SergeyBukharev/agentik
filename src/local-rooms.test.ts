import {it,expect,beforeEach} from 'vitest';
import type {Assistant} from './catalog';
import {
  addLocalRoomBot, joinLocalRoom, makeRoom, postLocalBotReply, postLocalMessage, readLocalRooms,
  removeLocalRoomBot, renewLocalInvite, roomMentionTargets, setLocalRoomPrivacy, shareLocalConversation,
  splitRoomMentions, syncSharedConversation,
} from './local-rooms';
const alice={id:'alice',name:'Алиса'},bob={id:'bob',name:'Борис'};
const forestFriend: Assistant = {
  id: 'forest-friend', name: 'Лесной друг', description: 'Помогает найти дорогу в лесу.',
  category: 'Персонажи', kind: 'character', icon: 'Compass', color: 'lime', prompts: [],
  instruction: 'Ты знаешь лесные тропинки и любишь рассказывать о них.',
};
beforeEach(()=>localStorage.clear());
it('creates a room, lets a second local profile join and shares messages',()=>{
 const room=makeRoom(localStorage,alice,'Поездка',1000);
 expect(readLocalRooms(localStorage,'bob',1001)).toEqual([]);
 joinLocalRoom(localStorage,bob,room.invite,1001);
 postLocalMessage(localStorage,bob,room.id,'Привет!',1002);
 const result=readLocalRooms(localStorage,'alice',1003)[0];
 expect(result.members).toEqual([alice,bob]);expect(result.messages[0].body).toBe('Привет!');
});
it('blocks nonmembers and expired invites in the demo adapter',()=>{
 const room=makeRoom(localStorage,alice,'Поездка',1000);
 expect(()=>postLocalMessage(localStorage,bob,room.id,'x',1001)).toThrow();
 expect(()=>joinLocalRoom(localStorage,bob,room.invite,1000+86400001)).toThrow();
});
it('issues a fresh invitation for an active room after the first day',()=>{
 const room=makeRoom(localStorage,alice,'Поездка',1000),later=1000+86400001;
 const token=renewLocalInvite(localStorage,alice,room.id,later);
 expect(token).not.toBe(room.invite);
 expect(joinLocalRoom(localStorage,bob,token,later+1).members.map(m=>m.id)).toEqual(['alice','bob']);
});

it('reuses the conversation room, includes its existing turns and appends new ones once', () => {
 const conversation = {id:'chat-1',assistantId:'writer',title:'Текст',updatedAt:1000,messages:[
  {role:'user' as const,content:'Черновик'},{role:'assistant' as const,content:'Правки'},
 ]};
 const group = shareLocalConversation(localStorage, alice, conversation, 'Редактор', 1000);
 joinLocalRoom(localStorage, bob, group.invite, 1001);
 postLocalMessage(localStorage, bob, group.id, 'Замечание', 1002);
 const again = shareLocalConversation(localStorage, alice,
  {...conversation,messages:[...conversation.messages,{role:'user',content:'Новый черновик'}]}, 'Редактор', 1003);
 expect(again.id).toBe(group.id);
 expect(again.invite).toBe(group.invite);
 expect(again.messages.map(message=>[message.name,message.body])).toEqual([
  ['Алиса','Черновик'],['Редактор','Правки'],['Борис','Замечание'],['Алиса','Новый черновик'],
 ]);
});

it('removes all guests and revokes the invitation while keeping the owner history', () => {
 const group = makeRoom(localStorage, alice, 'Поездка', 1000);
 joinLocalRoom(localStorage, bob, group.invite, 1001);
 postLocalMessage(localStorage, bob, group.id, 'Вклад участника', 1002);
 expect(() => setLocalRoomPrivacy(localStorage, bob, group.id, true, 1003)).toThrow();
 const changed = setLocalRoomPrivacy(localStorage, alice, group.id, true, 1003);
 expect(changed.private).toBe(true);
 expect(readLocalRooms(localStorage,bob.id,1004)).toEqual([]);
 expect(() => postLocalMessage(localStorage,bob,group.id,'Позднее сообщение',1004)).toThrow();
 expect(() => joinLocalRoom(localStorage,bob,group.invite,1004)).toThrow();
 expect(() => renewLocalInvite(localStorage,alice,group.id,1004)).toThrow();
 expect(changed.members).toEqual([alice]);
 expect(changed.messages[0].body).toBe('Вклад участника');
 const reopened = setLocalRoomPrivacy(localStorage, alice, group.id, false, 1005);
 expect(reopened.invite).not.toBe(group.invite);
 expect(joinLocalRoom(localStorage,bob,reopened.invite,1006).messages[0].body).toBe('Вклад участника');
});

it('persists attachment-only turns and rejects an unsafe image source', () => {
 const group = makeRoom(localStorage, alice, 'Референсы', 1000);
 const photo = {id:'image-1',name:'reference.png',url:'data:image/png;base64,AAAA'};
 postLocalMessage(localStorage,alice,group.id,'',1001,[photo]);
 expect(readLocalRooms(localStorage,alice.id,1002)[0].messages[0].images).toEqual([photo]);
 expect(() => postLocalMessage(localStorage,alice,group.id,'',1002,[{...photo,url:'data:text/html;base64,AAAA'}])).toThrow();
});

it('mirrors new turns to a shared chat without reopening a private one', () => {
 const empty = {id:'chat-live',assistantId:'writer',title:'Тест',updatedAt:1000,messages:[]};
 const group = shareLocalConversation(localStorage,alice,empty,'Редактор',1000);
 const first = {role:'user' as const,content:'Первый'};
 const second = {role:'user' as const,content:'Второй'};
 syncSharedConversation(localStorage,alice,{...empty,messages:[first]},'Редактор',1001);
 expect(readLocalRooms(localStorage,alice.id,1002)[0].messages.map(message=>message.body)).toEqual(['Первый']);
 setLocalRoomPrivacy(localStorage,alice,group.id,true,1003);
 syncSharedConversation(localStorage,alice,{...empty,messages:[first,second]},'Редактор',1004);
 const privateGroup = readLocalRooms(localStorage,alice.id,1005)[0];
 expect(privateGroup.private).toBe(true);
 expect(privateGroup.messages.map(message=>message.body)).toEqual(['Первый']);
});

it('lets only the owner add or remove bots in the selected group', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  const other = makeRoom(localStorage, alice, 'Море', 1001);
  joinLocalRoom(localStorage, bob, group.invite, 1002);

  expect(() => addLocalRoomBot(localStorage, bob, group.id, forestFriend, 1003)).toThrow();
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1004);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1005);
  expect(readLocalRooms(localStorage, bob.id, 1006)[0].bots).toEqual([forestFriend]);
  expect(readLocalRooms(localStorage, alice.id, 1006).find(room => room.id === other.id)?.bots ?? []).toEqual([]);

  expect(() => removeLocalRoomBot(localStorage, bob, group.id, forestFriend.id, 1007)).toThrow();
  removeLocalRoomBot(localStorage, alice, group.id, forestFriend.id, 1008);
  expect(readLocalRooms(localStorage, bob.id, 1009)[0].bots).toEqual([]);
});

it('keeps distinct mention handles when a member joins or a same-name bot is removed', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1001);
  const guest = {id: 'guest', name: 'Лесной друг'};
  joinLocalRoom(localStorage, guest, group.invite, 1002);
  const twin = {...forestFriend, id: 'another-forest-friend'};
  addLocalRoomBot(localStorage, alice, group.id, twin, 1003);

  expect(roomMentionTargets(readLocalRooms(localStorage, guest.id, 1004)[0]).map(target => [target.id, target.handle])).toEqual([
    [alice.id, 'алиса'], [guest.id, 'лесной-друг-2'], [forestFriend.id, 'лесной-друг'], [twin.id, 'лесной-друг-3'],
  ]);

  removeLocalRoomBot(localStorage, alice, group.id, forestFriend.id, 1005);
  expect(roomMentionTargets(readLocalRooms(localStorage, guest.id, 1006)[0]).map(target => [target.id, target.handle])).toEqual([
    [alice.id, 'алиса'], [guest.id, 'лесной-друг-2'], [twin.id, 'лесной-друг-3'],
  ]);
});

it('keeps stale draft mentions from reaching different identities after removal or making the room private', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  joinLocalRoom(localStorage, bob, group.invite, 1001);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1002);
  const draft = '@лесной-друг, @борис, посмотрите фото.';
  const photo = {id: 'image-1', name: 'forest.png', url: 'data:image/png;base64,AAAA'};

  removeLocalRoomBot(localStorage, alice, group.id, forestFriend.id, 1003);
  setLocalRoomPrivacy(localStorage, alice, group.id, true, 1004);
  const reopened = setLocalRoomPrivacy(localStorage, alice, group.id, false, 1005);
  addLocalRoomBot(localStorage, alice, group.id, {...forestFriend, id: 'new-bot'}, 1006);
  joinLocalRoom(localStorage, {...bob, id: 'new-member'}, reopened.invite, 1007);

  const sent = postLocalMessage(localStorage, alice, group.id, draft, 1008, [photo]);
  expect(sent.images).toEqual([photo]);
  expect(sent.mentions).toBeUndefined();
  expect(roomMentionTargets(readLocalRooms(localStorage, alice.id, 1009)[0]).map(target => [target.id, target.handle])).toEqual([
    [alice.id, 'алиса'], ['new-member', 'борис-2'], ['new-bot', 'лесной-друг-2'],
  ]);
});

it('records case-insensitive mentions while skipping email addresses and partial handles', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  joinLocalRoom(localStorage, bob, group.invite, 1001);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1002);
  const photo = {id: 'image-1', name: 'forest.png', url: 'data:image/png;base64,AAAA'};
  const body = '«@ЛЕСНОЙ-ДРУГ», ответь @алиса. @лесной-друг! mail@алиса.ru @алиса_extra @лесной-друг-9 @алиса@example.com @алиса.example.com';
  const message = postLocalMessage(localStorage, bob, group.id, body, 1003, [photo]);

  expect(message.mentions).toEqual([
    {id: forestFriend.id, name: 'Лесной друг', handle: 'лесной-друг', kind: 'bot'},
    {id: alice.id, name: 'Алиса', handle: 'алиса', kind: 'member'},
  ]);
  removeLocalRoomBot(localStorage, alice, group.id, forestFriend.id, 1004);
  const saved = readLocalRooms(localStorage, bob.id, 1005)[0].messages[0];
  expect(saved.images).toEqual([photo]);
  expect(splitRoomMentions(saved.body, saved.mentions).filter(part => part.mention).map(part => [part.text, part.mention?.name])).toEqual([
    ['@ЛЕСНОЙ-ДРУГ', 'Лесной друг'], ['@алиса', 'Алиса'], ['@лесной-друг', 'Лесной друг'],
  ]);
});

it('recognizes equivalent Unicode spellings of a custom assistant handle', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  const custom: Assistant = {...forestFriend, id: 'custom-guide', name: 'J\u030c', kind: 'assistant'};
  addLocalRoomBot(localStorage, alice, group.id, custom, 1001);

  const first = postLocalMessage(localStorage, alice, group.id, '@ǰ, привет!', 1002);
  const second = postLocalMessage(localStorage, alice, group.id, '@J\u030c, привет!', 1003);
  expect(first.mentions?.map(mention => mention.id)).toEqual(['custom-guide']);
  expect(second.mentions).toEqual(first.mentions);
  expect(readLocalRooms(localStorage, alice.id, 1004)[0].messages[0].mentions).toEqual(first.mentions);
});

it('commits one reply from a summoned bot for the member who sent the message', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  joinLocalRoom(localStorage, bob, group.invite, 1001);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1002);
  const untargeted = postLocalMessage(localStorage, bob, group.id, 'Привет!', 1003);
  expect(postLocalBotReply(localStorage, bob, group.id, forestFriend.id, untargeted.id, 'Ответ', 1004)).toBeUndefined();

  const source = postLocalMessage(localStorage, bob, group.id, '@лесной-друг, где тропа?', 1005);
  expect(postLocalBotReply(localStorage, alice, group.id, forestFriend.id, source.id, 'Ответ', 1006)).toBeUndefined();
  expect(postLocalBotReply(localStorage, bob, group.id, forestFriend.id, source.id, '  У ручья.  ', 1007)).toMatchObject({
    userId: 'assistant:forest-friend', name: 'Лесной друг', body: 'У ручья.', replyToMessageId: source.id,
  });
  expect(postLocalBotReply(localStorage, bob, group.id, forestFriend.id, source.id, 'Повтор', 1008)).toBeUndefined();
  expect(readLocalRooms(localStorage, alice.id, 1009)[0].messages.map(message => message.body)).toEqual([
    'Привет!', '@лесной-друг, где тропа?', 'У ручья.',
  ]);
});

it('drops a pending bot reply when the bot or the sender loses access', () => {
  const group = makeRoom(localStorage, alice, 'Лес', 1000);
  joinLocalRoom(localStorage, bob, group.invite, 1001);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1002);
  const first = postLocalMessage(localStorage, bob, group.id, '@лесной-друг, где тропа?', 1003);
  removeLocalRoomBot(localStorage, alice, group.id, forestFriend.id, 1004);
  expect(postLocalBotReply(localStorage, bob, group.id, forestFriend.id, first.id, 'Ответ', 1005)).toBeUndefined();

  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1006);
  const second = postLocalMessage(localStorage, bob, group.id, '@лесной-друг, мы у ручья.', 1007);
  setLocalRoomPrivacy(localStorage, alice, group.id, true, 1008);
  expect(postLocalBotReply(localStorage, bob, group.id, forestFriend.id, second.id, 'Ответ', 1009)).toBeUndefined();
  expect(readLocalRooms(localStorage, alice.id, 1010)[0].messages).toEqual([first, second]);
  expect(readLocalRooms(localStorage, bob.id, 1010)).toEqual([]);
});

it('keeps older shared history plain and expires an inactive bot roster after 90 days', () => {
  const conversation = {id: 'old-chat', assistantId: 'writer', title: 'Текст', updatedAt: 1000, messages: [
    {role: 'user' as const, content: 'Когда-нибудь позовём @лесной-друг.'},
  ]};
  const group = shareLocalConversation(localStorage, alice, conversation, 'Редактор', 1000);
  addLocalRoomBot(localStorage, alice, group.id, forestFriend, 1001);
  const expiresAt = 1001 + 90 * 86_400_000;
  const saved = readLocalRooms(localStorage, alice.id, expiresAt - 1)[0];
  expect(saved.bots).toEqual([forestFriend]);
  expect(splitRoomMentions(saved.messages[0].body, saved.messages[0].mentions)).toEqual([
    {text: 'Когда-нибудь позовём @лесной-друг.'},
  ]);
  expect(readLocalRooms(localStorage, alice.id, expiresAt)).toEqual([]);
});
