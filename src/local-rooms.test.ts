import {it,expect,beforeEach} from 'vitest';
import {makeRoom,joinLocalRoom,postLocalMessage,readLocalRooms,renewLocalInvite} from './local-rooms';
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
