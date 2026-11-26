import {useUi} from '../language';
import * as Dialog from '@radix-ui/react-dialog';
import {useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,description,onClose,children}:{title:string;description:string;onClose:()=>void;children:ReactNode}){
  const {t} = useUi();
 const trigger=useRef(document.activeElement as HTMLElement|null);
 return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="modal__overlay"/><Dialog.Content className="modal" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus();}}><Dialog.Title className="modal__title">{title}</Dialog.Title><Dialog.Description className="modal__description">{description}</Dialog.Description><Dialog.Close className="icon-button modal__close" aria-label={t('Закрыть','Close')}><X size={20}/></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
