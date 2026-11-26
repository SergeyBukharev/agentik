import { describe, it, expect } from 'vitest';
import { catalog, filterAssistants } from './catalog';
import { emptyState, loadState, readState, saveState } from './state';
describe('catalog', () => {
  it('contains 30 practical assistants and 6 characters', () => {
    expect(catalog.filter(a=>a.kind==='assistant')).toHaveLength(30);
    expect(catalog.filter(a=>a.kind==='character')).toHaveLength(6);
    expect(new Set(catalog.map(a=>a.id)).size).toBe(36);
  });
  it('normalizes Russian search and intersects category', () => {
    expect(filterAssistants(catalog, '  РЕЗЮМЕ  ', 'Работа').map(a=>a.id)).toContain('career');
    expect(filterAssistants(catalog, 'резюме', 'Дом')).toEqual([]);
  });
});
describe('persistence', () => {
  it('round trips favorites, custom assistants and conversations', () => {
    const s = {...emptyState(), favorites:['career'], conversations:[{id:'c',assistantId:'career',title:'Мое резюме',updatedAt:1,messages:[{role:'user' as const,content:'Привет'}]}]};
    expect(saveState(localStorage,s)).toBe(true);
    expect(loadState(localStorage)).toEqual(s);
  });
  it('recovers from corrupt and structurally malformed records', () => {
    localStorage.setItem('agentik:v1','{broken');
    expect(loadState(localStorage)).toEqual(emptyState());
    localStorage.setItem('agentik:v1',JSON.stringify({version:1, favorites:[2],custom:[{}],conversations:[{messages:null}]}));
    expect(loadState(localStorage)).toEqual(emptyState());
  });
  it('reports unavailable storage', () => {
    expect(saveState({setItem(){throw new Error('quota')}},emptyState())).toBe(false);
    expect(loadState({getItem(){throw new Error('denied')}})).toEqual(emptyState());
  });
  it('retains valid records and flags a partly corrupted cache',()=>{
    localStorage.setItem('agentik:state:alice',JSON.stringify({...emptyState(),expiresAt:Date.now()+10000,favorites:['writer',2],conversations:[{id:'c',assistantId:'writer',title:'Письмо',updatedAt:1,messages:[]},{messages:null}]}));
    const result=readState(localStorage,'alice');expect(result.state.conversations.map(c=>c.id)).toEqual(['c']);expect(result.status).toBe('corrupt');
  });
});
