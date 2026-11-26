import {render,screen,fireEvent,act,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {ACCESS_DURATION_MS} from '../access-contract';
import CodeGate from './CodeGate';

it('checks completed IME input once and ignores late change events until verification finishes',async()=>{
  let finish!:(result:Response)=>void;
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));
  vi.stubGlobal('fetch',fetcher);
  try {
    const unlock=vi.fn();
    const enter=vi.fn();
    render(<CodeGate notice="" onUnlock={unlock} onAccept={enter}/>);
    const field=screen.getByRole('textbox',{name:'Код доступа'});
    fireEvent.input(field,{target:{value:'TEST4'},isComposing:true});
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.input(field,{target:{value:'TEST42'},isComposing:true});
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.compositionEnd(field);
    expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.input(field,{target:{value:'TEST4'}});
    expect(field).toHaveValue('TEST42');
    expect(screen.getByRole('status')).toHaveTextContent('Проверяем код');
    await act(async ()=>{
      finish(Response.json({accountId:'e'.repeat(32),token:'v1.fixture.'+'s'.repeat(43),expiresAt:Date.now()+ACCESS_DURATION_MS}));
    });
    await waitFor(()=>expect(enter).toHaveBeenCalledOnce());
    expect(unlock).toHaveBeenCalledOnce();
  } finally {vi.unstubAllGlobals();}
});
