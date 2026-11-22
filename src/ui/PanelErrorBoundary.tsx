import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps one broken panel from blanking the whole screen: shows what failed and lets the DM retry. */
export default class PanelErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Panel crashed:", this.props.label, error, info.componentStack); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="panel-error">
        <p><strong>{this.props.label ?? "This panel"} hit an error.</strong></p>
        <p className="muted">{error.message}</p>
        <button onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
