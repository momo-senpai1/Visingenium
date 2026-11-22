import type { BlockKind } from '@/engine/control/loop';
import { t } from '@/i18n';

/** What each controller parameter does (rules of thumb for a stable loop). */
const HELP: { param: string; kinds: BlockKind[]; up: string }[] = [
  { param: 'K', kinds: ['P', 'PI', 'PD', 'PID'], up: 'Larger K: faster and smaller steady-state error, but more overshoot; too large makes the loop oscillate or unstable (phase margin shrinks).' },
  { param: 'T_i', kinds: ['PI', 'PID'], up: 'Smaller T_i: stronger integral action, removes the steady-state error faster, but adds phase lag: more overshoot and oscillation. The I part is what makes e_∞ = 0.' },
  { param: 'T_d', kinds: ['PD', 'PID'], up: 'Larger T_d: damps the response (phase lead, less overshoot), but amplifies measurement noise; the D part reacts to the rate of change of the error.' },
];

export function ControllerHelp({ kind }: { kind: BlockKind }) {
  const rows = HELP.filter((h) => h.kinds.includes(kind));
  if (!rows.length) return null;
  return (
    <div className="space-y-1 rounded border border-white/[0.06] bg-plant-950/40 p-2 text-[10px] leading-relaxed text-plant-300">
      <p className="tag text-plant-500">{t('What the parameters do')}</p>
      {rows.map((r) => (
        <p key={r.param}>
          <span className="font-mono text-signal-liquid">{r.param}</span> · {t(r.up)}
        </p>
      ))}
      <p className="text-plant-500">{t('Watch the step response and the phase margin while you change a value; about 45–60° phase margin is a good compromise.')}</p>
    </div>
  );
}
