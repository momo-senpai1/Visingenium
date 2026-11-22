/**
 * Tutor mode for a solution path: either the whole solution at once, or step by step with three
 * hint levels (idea → formula → approach), an optional answer check with error diagnosis, and
 * "show step" to reveal the solution of the current step.
 */

import { CheckCircle2, Eye, Lightbulb, ListOrdered, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Tex } from '@/components/balance/Tex';
import { t } from '@/i18n';
import { diagnose, parseAnswer, type Diagnosis, type Mistake } from '@/lib/diagnose';
import { cn } from '@/lib/utils';

export interface TutorStep {
  /** short task of the step, e.g. "Combine R1 and R2" */
  title: string;
  /** hint 1: idea (text), hint 2: formula (LaTeX), hint 3: approach (text) */
  hints: [string, string, string];
  /** the worked solution of the step */
  solution: ReactNode;
  /** optional numeric answer the student can check */
  answer?: { value: number; unit: string; mistakes?: Mistake[] };
}

export function StepTutor({ steps, final, resetKey }: { steps: TutorStep[]; final?: ReactNode; resetKey: string }) {
  const [mode, setMode] = useState<'all' | 'tutor'>('all');
  const [shown, setShown] = useState(0);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    // a different task: start again
    setKey(resetKey);
    setShown(0);
  }
  const done = mode === 'all' || shown >= steps.length;
  return (
    <div className="space-y-2">
      <div role="group" aria-label={t('Solution mode')} className="flex w-fit rounded border border-white/[0.08] p-0.5 text-[11px]">
        {(
          [
            ['all', 'Full solution', Eye],
            ['tutor', 'Step by step (tutor)', ListOrdered],
          ] as const
        ).map(([m, l, Icon]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => (setMode(m), setShown(0))} className={cn('flex items-center gap-1 rounded-sm px-2 py-0.5', mode === m ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-300 hover:text-plant-100')}>
            <Icon className="h-3 w-3" /> {t(l)}
          </button>
        ))}
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) =>
          mode === 'all' || i < shown ? (
            <li key={i} className="flex gap-2 rounded border border-white/[0.04] px-2 py-1">
              <span className="mt-1 font-mono text-[10px] text-plant-500">{i + 1}.</span>
              <div className="min-w-0 flex-1">{s.solution}</div>
            </li>
          ) : i === shown ? (
            <CurrentStep key={`${resetKey}-${i}`} n={i + 1} total={steps.length} step={s} onReveal={() => setShown(i + 1)} />
          ) : null,
        )}
      </ol>
      {done ? final : <p className="text-[10px] text-plant-500">{t('{n} more steps to the result.', { n: steps.length - shown })}</p>}
    </div>
  );
}

function CurrentStep({ n, total, step, onReveal }: { n: number; total: number; step: TutorStep; onReveal: () => void }) {
  const [hints, setHints] = useState(0);
  const [text, setText] = useState('');
  const [res, setRes] = useState<Diagnosis | null>(null);
  const check = () => step.answer && setRes(diagnose(parseAnswer(text), step.answer.value, step.answer.mistakes));
  return (
    <li className="space-y-2 rounded-md border border-signal-liquid/30 bg-signal-liquid/[0.04] px-3 py-2">
      <p className="text-[12px] font-medium text-plant-100">
        <span className="mr-1 font-mono text-[10px] text-signal-liquid">
          {t('Step')} {n}/{total}
        </span>
        {step.title}
      </p>
      {hints > 0 && (
        <div className="space-y-1 rounded border border-signal-heat/25 bg-signal-heat/[0.05] px-2 py-1.5 text-[11px] text-plant-200">
          <p>
            <span className="text-signal-heat">{t('Hint 1 (idea)')}: </span>
            {step.hints[0]}
          </p>
          {hints > 1 && (
            <div>
              <span className="text-signal-heat">{t('Hint 2 (formula)')}: </span>
              <Tex math={step.hints[1]} />
            </div>
          )}
          {hints > 2 && (
            <p>
              <span className="text-signal-heat">{t('Hint 3 (approach)')}: </span>
              {step.hints[2]}
            </p>
          )}
        </div>
      )}
      {step.answer && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-plant-300">
          <label className="flex items-center gap-1">
            {t('Your result')}
            <input
              aria-label={t('Your result')}
              value={text}
              onChange={(e) => (setText(e.target.value), setRes(null))}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              placeholder={`… ${step.answer.unit}`}
              className="w-28 rounded border border-white/[0.1] bg-plant-950/70 px-2 py-0.5 font-mono text-plant-100 outline-none focus:border-signal-liquid/50"
            />
          </label>
          <button type="button" onClick={check} className="rounded border border-signal-liquid/40 px-2 py-0.5 text-signal-liquid hover:bg-signal-liquid/10">
            {t('Check')}
          </button>
          {res && (
            <span className={cn('flex items-center gap-1', res.ok ? 'text-signal-ok' : 'text-signal-alarm')} role="status">
              {res.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {t(res.key, res.vars)}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {hints < 3 && (
          <button type="button" onClick={() => setHints((h) => h + 1)} className="flex items-center gap-1 rounded border border-signal-heat/40 px-2 py-0.5 text-signal-heat hover:bg-signal-heat/10">
            <Lightbulb className="h-3 w-3" /> {t(hints === 0 ? 'Hint' : 'Next hint')} ({hints + 1}/3)
          </button>
        )}
        <button type="button" onClick={onReveal} className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-0.5 text-plant-200 hover:text-signal-liquid">
          <Eye className="h-3 w-3" /> {res?.ok ? t('Next step') : t('Show solution of this step')}
        </button>
      </div>
    </li>
  );
}
