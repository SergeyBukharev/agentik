import {Component, type ReactNode} from 'react';
import {PageState} from './components/PageState';

export class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    return this.state.failed ? <main className="state-page"><PageState kind="failure"/></main> : this.props.children;
  }
}
