import type {ReactElement} from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import './tooltip.css';

export function Tooltip({label, children, side = 'top'}: {label: string; children: ReactElement; side?: 'top' | 'bottom'}) {
  return <RadixTooltip.Provider delayDuration={400}>
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="ui-tooltip" side={side} sideOffset={7} collisionPadding={12}>
          {label}
          <RadixTooltip.Arrow className="ui-tooltip__arrow"/>
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>;
}
