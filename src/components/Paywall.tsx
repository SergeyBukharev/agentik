import {Crown} from 'lucide-react';
import {useUi} from '../language';
import {Modal} from './Modal';

export function Paywall({active,exhausted,onClose,onContinue}: {active?:boolean;exhausted:boolean;onClose: () => void;onContinue:()=>void}) {
  const {t} = useUi();
  const checkout = import.meta.env.VITE_PRO_CHECKOUT_URL || '';
  return <Modal title={active?'Agentik PRO':t('Продолжайте с Agentik PRO','Keep chatting with Agentik PRO')}
    description={active?t('Ваш PRO активен.','Your PRO plan is active.'):exhausted
      ? t('Два пробных сообщения отправлены. Подключите PRO, чтобы продолжить отправку.','Your two trial messages have been sent. Get PRO to keep sending.')
      : t('В пробном доступе два сообщения. С PRO отправка включена.','Your trial includes two messages. Sending is included with PRO.')} onClose={onClose}>
    <div className="paywall__actions">
      {active ? null : /^https:\/\//i.test(checkout) ? <a className="button button--pro" href={checkout}><Crown size={18}/>{t('Купить PRO','Get PRO')}</a>
        : <p className="notice" role="status">{t('Покупка PRO пока недоступна.','PRO checkout is not available yet.')}</p>}
      <button className="button button--secondary" onClick={active ? onClose : onContinue}>{active?t('Готово','Done'):t('К чатам','Back to chats')}</button>
    </div>
  </Modal>;
}
