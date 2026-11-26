import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyState,readState,saveState,type AppState} from './state';
function initial(id:string){try{return readState(localStorage,id);}catch{return{state:emptyState(),status:'unavailable' as const};}}
export function useProfileState(id:string){
 const[first]=useState(()=>initial(id));const[state,setState]=useState(first.state),[saved,setSaved]=useState(first.status==='ok'||first.status==='missing');const current=useRef(state);current.current=state;
 const writable=useRef(first.status==='ok'||first.status==='missing');
 useEffect(()=>{if(writable.current)try{setSaved(saveState(localStorage,current.current,id));}catch{setSaved(false);}const receive=(e:StorageEvent)=>{if(e.key!==`agentik:state:${id}`)return;const loaded=initial(id);if(loaded.status==='ok'||loaded.status==='missing'){current.current=loaded.state;setState(loaded.state);}else{writable.current=false;setSaved(false);}};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);},[id]);
 const update=useCallback((fn:(s:AppState)=>AppState)=>{
  let base=current.current;
  if(writable.current){const loaded=initial(id);if(loaded.status==='ok')base=loaded.state;else if(loaded.status!=='missing'){writable.current=false;setSaved(false);}}
  const next=fn(base);current.current=next;setState(next);
  if(writable.current)try{setSaved(saveState(localStorage,next,id));}catch{setSaved(false);}
 },[id]);
 return{state,saved,update};
}
