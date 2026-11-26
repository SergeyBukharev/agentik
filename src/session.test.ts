import {it,expect,beforeEach} from 'vitest';
import {activeProfile,createProfile,resumeProfile,SESSION_MS,saveProfile,listProfiles} from './session';
import {emptyState,loadState,saveState} from './state';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
it('keeps each local profile valid for at least 90 days',()=>{
 expect(SESSION_MS).toBeGreaterThanOrEqual(90*24*60*60*1000);
 const p=createProfile('Анна',1000);saveProfile(localStorage,p);
 expect(resumeProfile(localStorage,p.id,1000+91*86400000)).toBeNull();
 expect(resumeProfile(localStorage,p.id,1000+89*86400000)?.name).toBe('Анна');
});
it('renews a resumed session for 90 more days',()=>{
 const p=createProfile('Анна',1000);saveProfile(localStorage,p);const now=1000+80*86400000;
 const resumed=resumeProfile(localStorage,p.id,now)!;
 expect(resumed.expiresAt).toBe(now+SESSION_MS);
 expect(listProfiles(localStorage,now)).toHaveLength(1);
});
it('isolates cached history and favorites by profile',()=>{
 saveState(localStorage,{...emptyState(),favorites:['writer']},'alice',1000);
 saveState(localStorage,{...emptyState(),favorites:['chef']},'bob',1000);
 expect(loadState(localStorage,'alice',2000).favorites).toEqual(['writer']);
 expect(loadState(localStorage,'bob',2000).favorites).toEqual(['chef']);
 expect(loadState(localStorage,'alice',1000+89*86400000).favorites).toEqual(['writer']);
 expect(loadState(localStorage,'alice',1000+91*86400000).favorites).toEqual([]);
});
it('pins a newly opened tab to the resumed profile',()=>{
 const a=createProfile('Анна'),b=createProfile('Борис');saveProfile(localStorage,a);saveProfile(localStorage,b);
 localStorage.setItem('agentik:active',a.id);
 expect(activeProfile().id).toBe(a.id);
 localStorage.setItem('agentik:active',b.id);
 expect(activeProfile().id).toBe(a.id);
});
it('renews profile metadata when cached user activity is saved',()=>{
 const p=createProfile('Анна',1000);saveProfile(localStorage,p);
 saveState(localStorage,emptyState(),p.id,1000+89*86400000);
 expect(listProfiles(localStorage,1000+91*86400000).map(p=>p.name)).toEqual(['Анна']);
});
