import {it,expect,vi} from 'vitest';
import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Rooms} from './Rooms';
it('shows storage failures inside the active create-room dialog',async()=>{
 localStorage.clear();const u=userEvent.setup();render(<Rooms profile={{id:'p',name:'Анна',createdAt:1,expiresAt:Date.now()+100000}}/>);
 await u.click(screen.getByRole('button',{name:'Создать комнату'}));
 const dialog=within(screen.getByRole('dialog'));await u.type(dialog.getByRole('textbox',{name:'Название комнаты'}),'Поездка');
 const fail=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
 try{await u.click(dialog.getByRole('button',{name:'Создать комнату'}));expect(dialog.getByRole('alert')).toHaveTextContent('не смог сохранить');}finally{fail.mockRestore();}
});
