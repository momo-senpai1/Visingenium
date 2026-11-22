import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { ExamChecks } from '@/components/control/ExamChecks';
import { ALL, SpecEditor } from '@/components/control/SpecEditor';
import { StepTutor, type TutorStep } from '@/components/StepTutor';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, newId, nf, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { BLOCK_INFO, blockTF, type BlockSpec, type LoopBlock, type LoopSpec, type ReduceStep } from '@/engine/control/loop';
import { bode, cTex, freq, margins, normalize, roots, routh, stepInfo, stepResponse, tfTex, type C } from '@/engine/control/poly';
import { t } from '@/i18n';
import { reduceLoopEx, usesDelay } from '@/lib/loopEx';
import { nyquist } from '@/lib/nyquist';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

const EXAMPLES: Record<string, { label: string; loop: LoopSpec }> = {
  examH23: {
    label: 'Exam example (like RT H23): PI 0.2(1 + 1/(2s)) + PT2 K = 5, ω₀ = 2, D = 1',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PI', K: 0.2, Ti: 2 } },
        { id: 'g', name: 'G', spec: { kind: 'PT2', K: 5, T: 0.5, zeta: 1 } },
      ],
    },
  },
  examF22: {
    label: 'Exam example (like RT F22): PI 1 + 1/s, plant 5/(1 + 5s) with dead time',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PI', K: 1, Ti: 1 } },
        { id: 'g', name: 'G', spec: { kind: 'PT1', K: 5, T: 5 } },
        { id: 'd', name: 'Tt', spec: { kind: 'custom', num: [1], den: [1], Tt: 0.5 } },
      ],
    },
  },
  examH21: {
    label: 'Exam example (like RT H21): P controller + integrator with all-pass 2(1 − 2s)/(s(1 + 2s))',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'P', K: 0.1036 } },
        { id: 'g', name: 'G', spec: { kind: 'custom', num: [2, -4], den: [0, 1, 2] } },
      ],
    },
  },
  examPD: {
    label: 'Exam example (like RT H25): ideal PD K_R(1 + T_v s), T_v = 2/3 s, on a PT2 plant',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PD', K: 0.5, Td: 0.667, ideal: true } as BlockSpec },
        { id: 'g', name: 'G', spec: { kind: 'PT2', K: 4, T: 0.6, zeta: 0.4 } },
      ],
    },
  },
  unstable: {
    label: 'Unstable plant 1/(s − 1) with P controller (full Nyquist criterion)',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'P', K: 3 } },
        { id: 'g', name: 'G', spec: { kind: 'custom', num: [1], den: [-1, 1] } },
      ],
    },
  },
  pipt1: {
    label: 'PI controller + PT1 plant',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PI', K: 2, Ti: 2 } },
        { id: 'g', name: 'G', spec: { kind: 'PT1', K: 1, T: 2 } },
      ],
    },
  },
  pidpt3: {
    label: 'PID controller + PT3 plant',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PID', K: 3, Ti: 2.5, Td: 0.6 } },
        { id: 'g', name: 'G', spec: { kind: 'PTn', K: 1, T: 1, n: 3 } },
      ],
    },
  },
  pit1: {
    label: 'P controller + IT1 plant (motor position)',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'P', K: 2 } },
        { id: 'g', name: 'G', spec: { kind: 'IT1', K: 1, T: 0.5 } },
      ],
    },
  },
  deadtime: {
    label: 'PI + PT1 with dead time',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PI', K: 0.8, Ti: 3 } },
        { id: 'g', name: 'G', spec: { kind: 'PTt', K: 1, T: 3, Tt: 1 } },
      ],
    },
  },
  sensor: {
    label: 'Loop with sensor lag in the feedback path',
    loop: {
      sign: -1,
      feedback: [{ id: 'h', name: 'H', spec: { kind: 'PT1', K: 1, T: 0.2 } }],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PI', K: 1.5, Ti: 1.5 } },
        { id: 'g', name: 'G', spec: { kind: 'PT2', K: 1, T: 1, zeta: 0.7 } },
      ],
    },
  },
  cascade: {
    label: 'Inner loop (local feedback) and parallel feed-forward',
    loop: {
      sign: -1,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'P', K: 4 }, parallel: { kind: 'D', K: 0.5, T: 0.05 } },
        { id: 'g', name: 'G', spec: { kind: 'I', K: 1 }, local: { spec: { kind: 'P', K: 0.5 }, sign: -1 } },
        { id: 'g2', name: 'G2', spec: { kind: 'PT1', K: 1, T: 0.5 } },
      ],
    },
  },
};

const useLoop = create<{ loop: LoopSpec; set: (l: LoopSpec) => void }>()(
  persist((set) => ({ loop: EXAMPLES.pidpt3!.loop, set: (loop) => set({ loop }) }), {
    name: 'ts-control-loop',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: (s) => ({ loop: s.loop }),
  }),
);

function BlockCard({ b, onChange, onRemove }: { b: LoopBlock; onChange: (b: LoopBlock) => void; onRemove: () => void }) {
  return (
    <div className="space-y-1.5 rounded-md border border-white/[0.06] p-2">
      <div className="flex items-center gap-1">
        <input aria-label={t('Name')} className={cn(fieldCls, 'w-20 font-sans')} value={b.name} onChange={(e) => onChange({ ...b, name: e.target.value })} />
        <span className="flex-1" />
        <button type="button" aria-label={t('Delete')} onClick={onRemove} className="grid h-6 w-6 place-items-center rounded text-plant-500 hover:text-signal-alarm">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <SpecEditor spec={b.spec} kinds={ALL} extras="all" onChange={(spec) => onChange({ ...b, spec })} />
      <label className="flex items-center gap-1.5 text-[10px] text-plant-400">
        <input type="checkbox" checked={!!b.parallel} onChange={(e) => onChange({ ...b, parallel: e.target.checked ? { kind: 'P', K: 1 } : null })} />
        {t('Parallel branch (outputs added)')}
      </label>
      {b.parallel && (
        <div className="ml-3 border-l border-white/[0.06] pl-2">
          <SpecEditor spec={b.parallel} kinds={ALL} extras="ideal" onChange={(parallel) => onChange({ ...b, parallel })} />
        </div>
      )}
      <label className="flex items-center gap-1.5 text-[10px] text-plant-400">
        <input type="checkbox" checked={!!b.local} onChange={(e) => onChange({ ...b, local: e.target.checked ? { spec: { kind: 'P', K: 1 }, sign: -1 } : null })} />
        {t('Local feedback around this block')}
      </label>
      {b.local && (
        <div className="ml-3 space-y-1 border-l border-white/[0.06] pl-2">
          <SpecEditor spec={b.local.spec} kinds={ALL} extras="ideal" onChange={(spec) => onChange({ ...b, local: { ...b.local!, spec } })} />
          <select className={fieldCls} value={b.local.sign} onChange={(e) => onChange({ ...b, local: { ...b.local!, sign: Number(e.target.value) as 1 | -1 } })}>
            <option value={-1}>{t('negative feedback')}</option>
            <option value={1}>{t('positive feedback')}</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default function ControlLoopPage() {
  const { loop, set } = useLoop();
  const r = useMemo(() => reduceLoopEx(loop), [loop]);
  const [resp, setResp] = useState<'step' | 'impulse'>('step');
  const [pzOf, setPzOf] = useState<'T' | 'L' | 'F'>('T');
  const T = normalize(r.T);
  const L = r.L;
  const hasDelay = usesDelay(loop);
  const polesT = useMemo(() => roots(T.den), [T]);
  const zerosT = useMemo(() => roots(T.num), [T]);
  const stable = polesT.every((p) => p.re < -1e-9);
  const T0 = freq(T, 1e-9).mag * Math.sign(freq(T, 1e-9).re || 1);
  const slowest = Math.max(1e-3, ...polesT.filter((p) => p.re < 0).map((p) => 1 / Math.max(-p.re, 1e-6)));
  const tEnd = Math.min(1e4, Math.max(5, 8 * slowest + (T.delay ?? 0) * 3));
  const step = useMemo(() => stepResponse(r.T, tEnd, 1200), [r.T, tEnd]);
  const imp = useMemo(() => (resp === 'impulse' ? stepResponse(r.T, tEnd, 1200, true) : null), [r.T, tEnd, resp]);
  const nq = useMemo(() => nyquist(L), [L]);
  const pzTF = pzOf === 'T' ? T : normalize(pzOf === 'L' ? L : r.F);
  const pzPoles = useMemo(() => (pzOf === 'T' ? polesT : roots(pzTF.den)), [pzOf, pzTF, polesT]);
  const pzZeros = useMemo(() => (pzOf === 'T' ? zerosT : roots(pzTF.num)), [pzOf, pzTF, zerosT]);
  const info = stable ? stepInfo(step.t, step.y, T0) : null;
  const mg = useMemo(() => margins(L), [L]);
  const allW = [...roots(L.den), ...roots(L.num)].map((p) => Math.hypot(p.re, p.im)).filter((v) => v > 1e-9);
  const wMin = Math.max(1e-4, Math.min(1, ...allW) / 100);
  const wMax = Math.min(1e5, Math.max(1, ...allW) * 100);
  const bd = useMemo(() => bode(L, wMin, wMax, 400), [L, wMin, wMax]);
  const rt = useMemo(() => routh(T.den), [T]);
  const n = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : nf(v, d));
  const upd = (path: 'forward' | 'feedback', i: number, b: LoopBlock | null) => {
    const arr = [...loop[path]];
    if (b) arr[i] = b;
    else arr.splice(i, 1);
    set({ ...loop, [path]: arr });
  };

  return (
    <div className="grid gap-2 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Control loop">
          <select aria-label={t('Examples')} className={fieldCls} value="" onChange={(e) => e.target.value && set(EXAMPLES[e.target.value]!.loop)}>
            <option value="">{t('Load an example…')}</option>
            {Object.entries(EXAMPLES).map(([k, ex]) => (
              <option key={k} value={k}>
                {t(ex.label)}
              </option>
            ))}
          </select>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-plant-300">
            {t('Main feedback')}
            <select className={fieldCls} value={loop.sign} onChange={(e) => set({ ...loop, sign: Number(e.target.value) as 1 | -1 })}>
              <option value={-1}>{t('negative')}</option>
              <option value={1}>{t('positive')}</option>
            </select>
          </label>
        </Card>
        <Card title="Forward path (controller, plant …)">
          <div className="space-y-2">
            {loop.forward.map((b, i) => (
              <BlockCard key={b.id} b={b} onChange={(nb) => upd('forward', i, nb)} onRemove={() => upd('forward', i, null)} />
            ))}
            <button
              type="button"
              onClick={() => set({ ...loop, forward: [...loop.forward, { id: newId('b'), name: `G${loop.forward.length + 1}`, spec: { kind: 'PT1', K: 1, T: 1 } }] })}
              className="flex items-center gap-1 text-[11px] text-signal-heat hover:underline"
            >
              <Plus className="h-3 w-3" /> {t('Add block')}
            </button>
          </div>
        </Card>
        <Card title="Feedback path (sensor …)">
          <div className="space-y-2">
            {!loop.feedback.length && <p className="text-[10px] text-plant-500">{t('Empty = unity feedback (H = 1).')}</p>}
            {loop.feedback.map((b, i) => (
              <BlockCard key={b.id} b={b} onChange={(nb) => upd('feedback', i, nb)} onRemove={() => upd('feedback', i, null)} />
            ))}
            <button
              type="button"
              onClick={() => set({ ...loop, feedback: [...loop.feedback, { id: newId('h'), name: `H${loop.feedback.length + 1}`, spec: { kind: 'PT1', K: 1, T: 0.1 } }] })}
              className="flex items-center gap-1 text-[11px] text-signal-heat hover:underline"
            >
              <Plus className="h-3 w-3" /> {t('Add block')}
            </button>
          </div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-8">
          <Kpi label={t('Stability')} value={stable ? t('stable') : t('unstable')} sub={`${polesT.length} ${t('poles')}`} small tone={stable ? 'default' : 'muted'} />
          <Kpi label="T(0)" value={n(T0, 4)} sub={t('final value of the step')} />
          <Kpi label="e_∞" value={stable ? n(1 - T0, 4) : '–'} sub={t('steady-state error')} />
          <Kpi label={t('Overshoot')} value={info ? n(info.overshoot, 1) : '–'} unit={info ? '%' : undefined} />
          <Kpi label={t('Rise time')} value={info?.rise ? n(info.rise, 3) : '–'} unit="s" sub="10–90 %" />
          <Kpi label={t('Settling time')} value={info ? n(info.settling, 2) : '–'} unit="s" sub="± 2 %" />
          <Kpi label={t('Phase margin')} value={n(mg.pm, 1)} unit="°" sub={mg.wc ? `ω_c = ${n(mg.wc, 3)} 1/s` : ''} />
          <Kpi label={t('Gain margin')} value={n(mg.gm, 1)} unit="dB" sub={mg.w180 ? `ω₁₈₀ = ${n(mg.w180, 3)} 1/s` : ''} />
        </div>
        {!stable && <Notice tone="error">{t('The closed loop is unstable: at least one pole lies in the right half plane (or on the imaginary axis).')}</Notice>}
        {hasDelay && <Notice tone="info">{t('Dead time: exact in the Bode and Nyquist plots of L; the closed loop (step response, poles) uses a 3rd-order Padé approximation.')}</Notice>}
        <Card title="Block diagram">
          <LoopDiagram loop={loop} />
        </Card>
        <Card title="Block diagram reduction (solution path)">
          <div className="text-[13px] text-plant-100">
            <StepTutor
              resetKey={JSON.stringify(loop)}
              steps={r.steps.map((s) => loopTutorStep(s))}
              final={<p className="text-[10px] text-plant-500">{t('Done: T(s) describes how the output follows the reference.')}</p>}
            />
          </div>
        </Card>
        <div className="grid gap-2 lg:grid-cols-2">
          <Card
            title={resp === 'step' ? 'Step response' : 'Impulse response (weighting function)'}
            aside={
              <div className="w-48">
                <Segmented<'step' | 'impulse'>
                  value={resp}
                  onChange={setResp}
                  options={[
                    { value: 'step', label: t('Step h(t)') },
                    { value: 'impulse', label: t('Impulse g(t)') },
                  ]}
                />
              </div>
            }
          >
            {resp === 'impulse' && imp ? (
              <>
                <LineChartBox series={[{ name: t('weighting function g(t) = dh/dt'), data: imp.t.map((tt, i) => ({ x: tt, y: imp.y[i]! })) }]} xLabel="t [s]" yLabel="g" digits={3} />
                <p className="mt-1 font-mono text-[10px] text-plant-400">
                  g(0⁺) = {n(imp.y[1] ?? imp.y[0], 4)} · {t('initial slope of h(t)')} · g(t_end) = {n(imp.y.at(-1), 4)}
                </p>
              </>
            ) : (
              <LineChartBox
                series={[
                  { name: t('output y(t)'), data: step.t.map((tt, i) => ({ x: tt, y: step.y[i]! })) },
                  {
                    name: t('reference w = 1'),
                    data: [
                      { x: 0, y: 1 },
                      { x: tEnd, y: 1 },
                    ],
                    dashed: true,
                    color: 'rgb(var(--plant-400))',
                  },
                ]}
                xLabel="t [s]"
                yLabel="y"
                digits={2}
              />
            )}
          </Card>
          <Card title="Bode diagram of the open loop L(jω)">
            <LineChartBox
              series={[{ name: '|L| [dB]', data: bd.map((p) => ({ x: p.w, y: p.db })) }]}
              xLabel="ω [1/s]"
              yLabel="dB"
              logX
              height={150}
              refX={mg.wc ? [{ x: mg.wc, label: 'ω_c' }] : undefined}
              digits={0}
            />
            <LineChartBox
              series={[{ name: 'φ [°]', data: bd.map((p) => ({ x: p.w, y: p.deg })), color: 'rgb(var(--sig-vapor))' }]}
              xLabel="ω [1/s]"
              yLabel="°"
              logX
              height={150}
              refX={mg.w180 ? [{ x: mg.w180, label: 'ω₁₈₀' }] : undefined}
              digits={0}
            />
          </Card>
          <Card title="Nyquist plot of L(jω)">
            <NyquistView nq={nq} />
          </Card>
          <Card
            title="Poles and zeros"
            aside={
              <div className="w-52">
                <Segmented<'T' | 'L' | 'F'>
                  value={pzOf}
                  onChange={setPzOf}
                  options={[
                    { value: 'T', label: 'T(s)', hint: 'closed loop' },
                    { value: 'L', label: 'L(s)', hint: 'open loop' },
                    { value: 'F', label: 'G_F(s)', hint: 'forward path (controller · plant)' },
                  ]}
                />
              </div>
            }
          >
            <PZMap poles={pzPoles} zeros={pzZeros} />
            <p className="mt-1 font-mono text-[10px] text-plant-400">
              {t('poles')}: {pzPoles.map((p) => `${nf(p.re, 3)}${p.im ? ` ${p.im > 0 ? '+' : '−'} ${nf(Math.abs(p.im), 3)}j` : ''}`).join(' · ')}
            </p>
          </Card>
        </div>
        <ExamChecks L={L} />
        <Card title="Routh–Hurwitz criterion">
          <div className="text-[13px] text-plant-100">
            <Tex block math={`\\text{${t('characteristic polynomial')}}:\\ ${tfTex({ num: T.den, den: [1] }).replace(/\\frac\{(.*)\}\{1\}/, '$1')} = 0`} />
          </div>
          <table className="mt-1 font-mono text-[11px]">
            <tbody>
              {rt.rows.map((row, i) => (
                <tr key={i}>
                  <td className="pr-3 text-plant-500">s^{rt.rows.length - 1 - i}</td>
                  {row.map((v, j) => (
                    <td key={j} className={cn('px-2 text-right', j === 0 ? (v < 0 ? 'text-signal-alarm' : 'text-signal-heat') : 'text-plant-300')}>
                      {nf(v, 4)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-plant-500">
            {rt.changes === 0
              ? t('No sign change in the first column: all roots in the left half plane.')
              : t('{n} sign changes in the first column = {n} roots in the right half plane.', { n: rt.changes })}
          </p>
        </Card>
        <Card title="Transfer functions">
          <div className="space-y-1 text-[13px] text-plant-100">
            {loop.forward.map((b) => (
              <Tex key={b.id} block math={`G_{${b.name}}(s) = ${tfTex(normalize(blockTF(b.spec)))}`} />
            ))}
            <Tex block math={`L(s) = ${tfTex(normalize(L))}`} />
            <Tex block math={`T(s) = ${tfTex(T)}`} />
            <p className="text-[10px] text-plant-500">
              {t('Closed-loop poles')}: {polesT.map((p) => cTex(p)).join(', ')}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

const RULE_HINTS: Record<ReduceStep['rule'], [string, string, string]> = {
  parallel: ['Both blocks get the same input and their outputs are added.', 'G = G_1 + G_2', 'Bring both fractions to a common denominator and add the numerators.'],
  feedback: [
    'The output of the block is fed back to its own input: a loop inside the loop.',
    'G_{cl} = \\frac{G}{1 \\pm G\\,H}',
    'For negative feedback the denominator is 1 + G·H. Multiply numerator and denominator by the denominators of G and H.',
  ],
  series: ['The blocks follow one after the other: the output of one is the input of the next.', 'G = G_1 \\cdot G_2 \\cdots', 'Multiply all numerators and all denominators.'],
  open: ['Cut the loop at the summing point and go once around it.', 'L(s) = G_F(s)\\,G_R(s)', 'Multiply the forward path by the feedback path.'],
  closed: [
    'From the reference w to the output y, with the main feedback closed.',
    'T(s) = \\frac{G_F}{1 + G_F\\,G_R} = \\frac{G_F}{1 + L}',
    'Insert G_F and L and simplify to one fraction. Check: T(0) is the static gain.',
  ],
};

/** Tutor version of a reduction step; the closed loop can be checked by its static gain T(0). */
function loopTutorStep(s: ReduceStep): TutorStep {
  const h = RULE_HINTS[s.rule];
  const g = normalize(s.result);
  const static0 = g.den[0] && Number.isFinite(g.num[0]! / g.den[0]!) ? g.num[0]! / g.den[0]! : null;
  return {
    title: s.rule === 'closed' ? `${stepTitle(s.title)} — ${t('enter the static gain T(0)')}` : stepTitle(s.title),
    hints: [t(h[0]), h[1], t(h[2])],
    solution: (
      <>
        <p className="text-[10px] text-plant-500">
          {stepTitle(s.title)}
          {s.rule === 'parallel' || s.rule === 'feedback' || s.rule === 'series' ? ` · ${t({ parallel: 'rule: G₁ + G₂', feedback: 'rule: G / (1 ± G·H)', series: 'rule: G₁ · G₂' }[s.rule])}` : ''}
        </p>
        <Tex math={s.formula} block />
      </>
    ),
    answer:
      s.rule === 'closed' && static0 !== null
        ? { value: static0, unit: '', mistakes: [{ value: static0 === 0 ? NaN : 1 / static0, key: 'You inverted the fraction: T = G_F/(1 + L), not (1 + L)/G_F.' }] }
        : undefined,
  };
}

/** "R: parallel branch" → block name kept, rest translated. */
function stepTitle(s: string) {
  const m = /^(.*?): (.*)$/.exec(s);
  return m ? `${m[1]}: ${t(m[2]!)}` : t(s);
}

function PZMap({ poles, zeros }: { poles: C[]; zeros: C[] }) {
  const all = [...poles, ...zeros];
  const R = Math.max(1, ...all.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im)))) * 1.2;
  const W = 400;
  const H = 260;
  const sx = (x: number) => W / 2 + (x / R) * (W / 2 - 20);
  const sy = (y: number) => H / 2 - (y / R) * (H / 2 - 20);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Pole-zero map')}>
      <rect x={sx(0)} y={0} width={W - sx(0)} height={H} fill="rgb(var(--sig-alarm)/0.05)" />
      <line x1={0} y1={sy(0)} x2={W} y2={sy(0)} stroke="rgb(var(--plant-500))" />
      <line x1={sx(0)} y1={0} x2={sx(0)} y2={H} stroke="rgb(var(--plant-500))" />
      <text x={W - 6} y={sy(0) - 4} textAnchor="end" className="text-[10px]" style={{ fill: 'rgb(var(--plant-400))' }}>
        Re
      </text>
      <text x={sx(0) + 4} y={12} className="text-[10px]" style={{ fill: 'rgb(var(--plant-400))' }}>
        Im
      </text>
      <text x={W - 6} y={H - 6} textAnchor="end" className="text-[10px]" style={{ fill: 'rgb(var(--sig-alarm))' }}>
        {t('unstable')}
      </text>
      {zeros.map((z, i) => (
        <circle key={`z${i}`} cx={sx(z.re)} cy={sy(z.im)} r={5} fill="none" stroke="rgb(var(--sig-liquid))" strokeWidth={2} />
      ))}
      {poles.map((p, i) => (
        <path key={`p${i}`} d={`M${sx(p.re) - 5},${sy(p.im) - 5}l10,10m0,-10l-10,10`} stroke="rgb(var(--sig-vapor))" strokeWidth={2} />
      ))}
      <text x={6} y={H - 6} className="text-[10px]" style={{ fill: 'rgb(var(--plant-400))' }}>
        × {t('poles')} · ○ {t('zeros')} · {t('axis ±')}
        {nf(R, 2)}
      </text>
    </svg>
  );
}

function LoopDiagram({ loop }: { loop: LoopSpec }) {
  const bw = 120;
  const gap = 40;
  const x0 = 110;
  const y = 60;
  const items = loop.forward;
  const width = x0 + items.length * (bw + gap) + 120;
  const fbY = 170;
  const label = (s: BlockSpec) => BLOCK_INFO[s.kind].label.split(' (')[0] ?? '';
  return (
    <svg viewBox={`0 0 ${Math.max(width, 600)} 220`} className="mx-auto h-auto max-h-60 w-full" role="img" aria-label={t('Block diagram')}>
      <defs>
        <marker id="la" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="rgb(var(--plant-300))" />
        </marker>
      </defs>
      <g stroke="rgb(var(--plant-300))" fill="none" strokeWidth={1.4} className="text-[11px]">
        <text x={10} y={y + 4} style={{ fill: 'rgb(var(--plant-200))', stroke: 'none' }}>
          w
        </text>
        <line x1={24} y1={y} x2={62} y2={y} markerEnd="url(#la)" />
        <circle cx={74} cy={y} r={12} />
        <text x={74} y={y + 4} textAnchor="middle" style={{ fill: 'rgb(var(--plant-200))', stroke: 'none' }}>
          Σ
        </text>
        <text x={66} y={y + 28} style={{ fill: 'rgb(var(--plant-300))', stroke: 'none' }}>
          {loop.sign < 0 ? '−' : '+'}
        </text>
        <line x1={86} y1={y} x2={x0 - 2} y2={y} markerEnd="url(#la)" />
        <text x={92} y={y - 6} style={{ fill: 'rgb(var(--plant-400))', stroke: 'none' }}>
          e
        </text>
        {items.map((b, i) => {
          const x = x0 + i * (bw + gap);
          return (
            <g key={b.id}>
              <rect x={x} y={y - 22} width={bw} height={44} rx={4} fill="rgb(var(--plant-900))" />
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" style={{ fill: 'rgb(var(--plant-100))', stroke: 'none' }}>
                {b.name}
              </text>
              <text x={x + bw / 2} y={y + 12} textAnchor="middle" style={{ fill: 'rgb(var(--plant-400))', stroke: 'none' }} className="text-[9px]">
                {t(label(b.spec))}
              </text>
              {b.parallel && (
                <>
                  <rect x={x + 10} y={y - 58} width={bw - 20} height={22} rx={3} fill="rgb(var(--plant-900))" strokeDasharray="3 2" />
                  <text x={x + bw / 2} y={y - 43} textAnchor="middle" style={{ fill: 'rgb(var(--plant-400))', stroke: 'none' }} className="text-[9px]">
                    ∥ {t(label(b.parallel))}
                  </text>
                </>
              )}
              {b.local && (
                <>
                  <path d={`M${x + bw - 10},${y + 22}V${y + 40}H${x + 10}V${y + 22}`} strokeDasharray="3 2" markerEnd="url(#la)" />
                  <text x={x + bw / 2} y={y + 52} textAnchor="middle" style={{ fill: 'rgb(var(--plant-400))', stroke: 'none' }} className="text-[9px]">
                    ↺ {t(label(b.local.spec))}
                  </text>
                </>
              )}
              <line x1={x + bw} y1={y} x2={x + bw + gap - 2} y2={y} markerEnd="url(#la)" />
            </g>
          );
        })}
        <text x={x0 + items.length * (bw + gap) + 6} y={y + 4} style={{ fill: 'rgb(var(--plant-200))', stroke: 'none' }}>
          y
        </text>
        {/* feedback path */}
        <path d={`M${x0 + items.length * (bw + gap) - gap / 2},${y}V${fbY}H${74}V${y + 12}`} markerEnd="url(#la)" />
        {loop.feedback.length > 0 && (
          <>
            <rect x={x0 + 40} y={fbY - 18} width={Math.max(120, loop.feedback.length * 90)} height={36} rx={4} fill="rgb(var(--plant-900))" />
            <text x={x0 + 40 + Math.max(120, loop.feedback.length * 90) / 2} y={fbY + 4} textAnchor="middle" style={{ fill: 'rgb(var(--plant-100))', stroke: 'none' }}>
              {loop.feedback.map((b) => b.name).join(' · ')}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

/** Nyquist plot (ω ≥ 0 solid, ω < 0 mirrored) with the full criterion Z = P + N */
function NyquistView({ nq }: { nq: ReturnType<typeof nyquist> }) {
  const Rc = 4; // larger values are drawn on this circle (arcs of integrators), radially compressed
  const clamp = (p: { re: number; im: number }) => {
    const m = Math.hypot(p.re, p.im);
    return m > Rc ? { x: (p.re / m) * Rc, y: (p.im / m) * Rc } : { x: p.re, y: p.im };
  };
  const pos = nq.path.map(clamp);
  const neg = nq.path.map((p) => clamp({ re: p.re, im: -p.im })).reverse();
  return (
    <>
      <LineChartBox
        series={[
          { name: 'L(jω), ω > 0', data: pos },
          { name: 'ω < 0', data: neg, dashed: true, color: 'rgb(var(--plant-400))' },
          {
            name: t('critical point −1'),
            data: [
              { x: -1, y: -0.08 },
              { x: -1, y: 0.08 },
            ],
            color: 'rgb(var(--sig-alarm))',
          },
        ]}
        xLabel="Re"
        yLabel="Im"
        digits={2}
      />
      <div className="mt-1 space-y-1 text-[11px] leading-relaxed text-plant-300">
        <Tex math={`P = ${nq.P},\\quad N = ${nq.N}\\ (\\text{${t('clockwise around −1')}}),\\quad Z = P + N = ${nq.Z}`} />
        <p className={nq.stable ? 'text-signal-ok' : 'text-signal-alarm'}>
          {nq.stable ? t('Full Nyquist criterion: closed loop stable (Z = 0).') : t('Full Nyquist criterion: {z} closed-loop pole(s) in the right half-plane — unstable.', { z: nq.Z })}
        </p>
        <p className="text-[10px] text-plant-500">
          {t(
            'P: open-loop poles in the right half-plane; poles on the imaginary axis ({a} of them, {o} at the origin) are bypassed on the right, which gives the large arcs. Points with |L| > 4 are drawn on the circle |L| = 4.',
            { a: nq.onAxis, o: nq.atOrigin },
          )}
        </p>
        {nq.improper && <p className="text-[10px] text-signal-heat">{t('L(s) is improper (more zeros than poles): the result is not reliable.')}</p>}
      </div>
    </>
  );
}
