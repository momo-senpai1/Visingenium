import { Component, type ReactNode } from 'react';
import { t } from '@/i18n';

/**
 * Last line of defence: an error while rendering one page shows a message with a way out
 * instead of a blank screen. `resetKey` (the route) clears the error when the user navigates.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(p: { resetKey: string }, s: { error: Error | null; key: string }) {
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null;
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="glass mx-auto mt-10 max-w-xl space-y-3 p-6">
        <p className="text-sm font-semibold text-signal-alarm">{t('This page ran into an error.')}</p>
        <p className="text-[12px] leading-relaxed text-plant-300">
          {t('Usually an input outside the valid range causes this. Try again, or reset the working data of the simulators (language, theme and your saved sheets are kept).')}
        </p>
        <pre className="overflow-x-auto rounded bg-plant-950/70 p-2 font-mono text-[10px] text-plant-400">{error.message}</pre>
        <div className="flex gap-2">
          <button type="button" onClick={() => this.setState({ error: null })} className="rounded border border-white/[0.1] px-3 py-1 text-[12px] text-plant-200 hover:text-signal-liquid">
            {t('Try again')}
          </button>
          <button
            type="button"
            onClick={() => {
              // working data of the pages persists under keys starting with "ts-"; keep language, theme and saved sheets
              try {
                for (const k of Object.keys(localStorage)) if (k.startsWith('ts-') && !['ts-lang', 'ts-theme'].includes(k)) localStorage.removeItem(k);
              } catch {
                /* storage blocked */
              }
              window.location.reload();
            }}
            className="rounded border border-signal-alarm/40 px-3 py-1 text-[12px] text-signal-alarm hover:bg-signal-alarm/10"
          >
            {t('Reset working data and reload')}
          </button>
        </div>
      </div>
    );
  }
}
