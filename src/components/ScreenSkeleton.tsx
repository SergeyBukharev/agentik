import {useUi} from '../language';

export function ScreenSkeleton({compact = false}: {compact?: boolean}) {
  const {t} = useUi();
  return (
    <div className={`screen-skeleton screen-skeleton--layered${compact ? ' screen-skeleton--compact' : ''}`} role="status" aria-label={t('Загрузка экрана', 'Loading screen')}>
      <div className="screen-skeleton__title" data-skeleton-level="surface"/>
      <div className="screen-skeleton__row" data-skeleton-level="surface"/>
      <div className="screen-skeleton__items" aria-hidden="true">
        {Array.from({length: compact ? 2 : 3}, (_, index) => (
          <div key={index} className="screen-skeleton__card" data-skeleton-level="surface">
            <span className="screen-skeleton__media" data-skeleton-level="media"/>
            <span className="screen-skeleton__labels"><i/><i/></span>
          </div>
        ))}
      </div>
    </div>
  );
}
