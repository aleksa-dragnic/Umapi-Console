import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/ui/Button';
import { CodeWindow } from '@/ui/CodeWindow';

/**
 * The `error-boundary` screen (inventory section 3.11): a rendering failure,
 * not an HTTP one. It sits below the shell, so the navigation survives a crash
 * in a feature, and the shell gives it the path as its key, so moving to
 * another screen leaves the crash behind.
 *
 * Development shows the component stack; a production build shows only a short
 * id, which is what a reader can quote in an issue without the page exposing
 * the application's structure.
 */

export const CRASHED_COPY = 'Something in the console failed to render.';
export const ISSUES_URL = 'https://github.com/aleksa-dragnic/Umapi-Console/issues';

interface Crash {
  id: string;
  stack: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { crash: Crash | null }> {
  override state: { crash: Crash | null } = { crash: null };

  static getDerivedStateFromError(): { crash: Crash } {
    return { crash: { id: crypto.randomUUID().slice(0, 8), stack: '' } };
  }

  override componentDidCatch(_error: unknown, info: ErrorInfo): void {
    const stack = info.componentStack ?? '';
    this.setState(({ crash }) => (crash === null ? null : { crash: { ...crash, stack } }));
  }

  override render(): ReactNode {
    const { crash } = this.state;
    if (crash === null) return this.props.children;

    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-app-3 p-app-4">
        <h1 tabIndex={-1} className="text-app-title text-fg-emphasis">
          {CRASHED_COPY}
        </h1>
        {import.meta.env.DEV ? (
          <div className="w-full">
            <CodeWindow title="Component stack">{crash.stack.trim() || '(none)'}</CodeWindow>
          </div>
        ) : (
          <p className="font-mono text-app-meta text-fg-secondary">Error id {crash.id}</p>
        )}
        <div className="flex flex-wrap items-center gap-app-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <a
            href={ISSUES_URL}
            className="text-fg-secondary underline underline-offset-4 hover:text-fg-primary"
          >
            Report it on GitHub
          </a>
        </div>
      </main>
    );
  }
}
