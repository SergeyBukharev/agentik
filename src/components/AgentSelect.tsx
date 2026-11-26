import * as Select from '@radix-ui/react-select';
import {Check, ChevronDown, ChevronUp} from 'lucide-react';
import type {ReactNode} from 'react';
import './agent-select.css';

type Option<Value extends string> = {
  value: Value;
  label: string;
  icon?: ReactNode;
};

export function AgentSelect<Value extends string>({id, label, value, options, onChange, disabled, side = 'bottom', fullWidth}: {
  id?: string;
  label: string;
  value: Value;
  options: readonly Option<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  side?: 'top' | 'bottom';
  fullWidth?: boolean;
}) {
  const selected = options.find(option => option.value === value);

  return (
    <Select.Root value={value} disabled={disabled} onValueChange={choice => {
      const option = options.find(item => item.value === choice);
      if (option) onChange(option.value);
    }}>
      <Select.Trigger id={id} className="agent-select__trigger" data-agentik-select="" data-full-width={fullWidth || undefined}
        aria-label={label}>
        <Select.Value data-select-value="">
          <span className="agent-select__selection">
            {selected?.icon}<span className="agent-select__label">{selected?.label}</span>
          </span>
        </Select.Value>
        <Select.Icon asChild><ChevronDown className="agent-select__chevron" size={15} aria-hidden="true"/></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="agent-select__content" aria-label={label} position="popper" align="start"
          side={side} sideOffset={6} collisionPadding={10}>
          <Select.ScrollUpButton className="agent-select__scroll"><ChevronUp size={15}/></Select.ScrollUpButton>
          <Select.Viewport className="agent-select__options">
            {options.map(option => (
              <Select.Item key={option.value} value={option.value} textValue={option.label} className="agent-select__option">
                <span className="agent-select__selection">
                  {option.icon}<Select.ItemText>{option.label}</Select.ItemText>
                </span>
                <span className="agent-select__indicator" aria-hidden="true">
                  <Select.ItemIndicator asChild><Check size={16}/></Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="agent-select__scroll"><ChevronDown size={15}/></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
