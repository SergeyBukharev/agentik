import {it,expect} from 'vitest';
import {renderHook,act} from '@testing-library/react';
import {useProfileState} from './useProfileState';
import {loadState} from './state';
it('applies sequential actions from stale tabs to latest persisted profile data',()=>{
 localStorage.clear();const first=renderHook(()=>useProfileState('same-user')),second=renderHook(()=>useProfileState('same-user'));
 act(()=>first.result.current.update(s=>({...s,favorites:[...s.favorites,'writer']})));
 act(()=>second.result.current.update(s=>({...s,favorites:[...s.favorites,'chef']})));
 expect(loadState(localStorage,'same-user').favorites).toEqual(['writer','chef']);
});
it('does not overwrite a corrupt original cache on mount or edits',()=>{
 const raw='{broken';localStorage.setItem('agentik:state:broken-user',raw);
 const hook=renderHook(()=>useProfileState('broken-user'));
 expect(hook.result.current.saved).toBe(false);
 act(()=>hook.result.current.update(s=>({...s,favorites:['writer']})));
 expect(localStorage.getItem('agentik:state:broken-user')).toBe(raw);
});
