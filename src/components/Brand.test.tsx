import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {AgentIcon} from './Brand';
it('renders a safe fallback for prototype property names in saved assistant icons',()=>{
 const view=render(<span data-testid="icon"><AgentIcon name="__proto__"/></span>);
 expect(screen.getByTestId('icon').querySelector('svg')).not.toBeNull();view.unmount();
 render(<AgentIcon name="constructor"/>);
});
