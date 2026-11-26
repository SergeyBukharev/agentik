import {useUi} from '../language';
import {FamilyBudget} from './FamilyBudget';
import {Modal} from './Modal';

export function FamilyBudgetDialog({profileId, onClose, returnFocus}: {
  profileId: string;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const {t} = useUi();
  return <Modal title={t('Семейный бюджет', 'Family budget')}
    description={t('Данные сохраняются в этом браузере.', 'Your data is saved in this browser.')}
    onClose={onClose} returnFocus={returnFocus}>
    <FamilyBudget key={profileId} profileId={profileId}/>
  </Modal>;
}
