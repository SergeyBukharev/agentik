import {it,expect,beforeEach} from 'vitest';
import {makeRoom,joinLocalRoom,postLocalMessage,readLocalRooms,renewLocalInvite,setLocalRoomPrivacy,shareLocalConversation,syncSharedConversation} from './local-rooms';
const alice={id:'alice',name:'Алиса'},bob={id:'bob',name:'Борис'};
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
