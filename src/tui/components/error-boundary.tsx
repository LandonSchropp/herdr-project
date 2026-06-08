import { Component } from "react";
import type { ReactNode } from "react";

type ErrorBoundaryProps = {
  /** Fires with the thrown value when a descendant throws during render. */
  onError: (error: unknown) => void;
  /** The tree to render and guard. */
  children: ReactNode;
};

type ErrorBoundaryState = {
  /** Whether a descendant has thrown, in which case the children are no longer rendered. */
  crashed: boolean;
};

/**
 * Catches errors thrown while rendering its children and reports them through `onError`, rendering
 * nothing in their place. Only catches render-time crashes, not async failures.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { crashed: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.crashed ? null : this.props.children;
  }
}
