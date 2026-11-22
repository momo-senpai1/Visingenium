import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Card, Diagram, fieldCls, ListEditor, MECH, newId, nf, Num, NumRow, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { VIZ } from '@/components/analysis/vizTokens';
import { lineResultant, pointComponents, sectionProps, solveBeam, type BeamModel, type LineLoad, type MomentLoad, type PointLoad, type Section, type Support, type SupportType } from '@/engine/mechanics/beam';
import { t } from '@/i18n';

interface BeamState {
  L: number;
  supports: Support[];
  hinges: { id: string; x: number }[];
  points: PointLoad[];
  moments: MomentLoad[];
  lines: LineLoad[];
  E: number; // GPa
  section: Section;
  sigmaAllow: number; // MPa
  set: (p: Partial<Omit<BeamState, 'set' | 'load'>>) => void;
  load: (ex: ExampleId) => void;
}

type ExampleId = 'simple' | 'cantilever' | 'continuous' | 'gerber' | 'overhang';
const EXAMPLES: Record<ExampleId, { label: string; s: Partial<BeamState> }> = {
  simple: {
    label: 'Simply supported beam, point load + line load',
    s: {
      L: 6,
      supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }],
      hinges: [],
      points: [{ id: 'F1', x: 2, F: 20, angle: 90 }],
      moments: [],
      lines: [{ id: 'q1', x1: 3, x2: 6, q1: 5, q2: 5 }],
    },
  },
  cantilever: {
    label: 'Cantilever with inclined force',
    s: { L: 3, supports: [{ id: 'A', x: 0, type: 'fixed' }], hinges: [], points: [{ id: 'F1', x: 3, F: 10, angle: 60 }], moments: [], lines: [{ id: 'q1', x1: 0, x2: 3, q1: 2, q2: 2 }] },
  },
  continuous: {
    label: 'Continuous beam over three supports (indeterminate)',
    s: {
      L: 10,
      supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 5, type: 'roller' }, { id: 'C', x: 10, type: 'roller' }],
      hinges: [],
      points: [],
      moments: [],
      lines: [{ id: 'q1', x1: 0, x2: 10, q1: 8, q2: 8 }],
    },
  },
  gerber: {
    label: 'Gerber beam with hinge',
    s: {
      L: 9,
      supports: [{ id: 'A', x: 0, type: 'fixed' }, { id: 'B', x: 9, type: 'roller' }],
      hinges: [{ id: 'G', x: 4 }],
      points: [{ id: 'F1', x: 6.5, F: 15, angle: 90 }],
      moments: [],
      lines: [{ id: 'q1', x1: 0, x2: 4, q1: 3, q2: 3 }],
    },
  },
  overhang: {
    label: 'Beam with overhang, triangular load and moment',
    s: {
      L: 8,
      supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }],
      hinges: [],
      points: [{ id: 'F1', x: 8, F: 6, angle: 90 }],
      moments: [{ id: 'M1', x: 3, M: 10 }],
      lines: [{ id: 'q1', x1: 0, x2: 6, q1: 0, q2: 6 }],
    },
  },
};

const useBeam = create<BeamState>()(
  persist(
    (set) => ({
      ...(EXAMPLES.simple.s as Omit<BeamState, 'set' | 'load' | 'E' | 'section' | 'sigmaAllow'>),
      E: 210,
      section: { kind: 'I', h: 240, b: 120, tw: 6.2, tf: 9.8 },
      sigmaAllow: 160,
      set: (p) => set(p),
      load: (ex) => set(EXAMPLES[ex].s),
    }),
    { name: 'ts-beam', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, load: _l, ...rest }) => rest },
  ),
);

const SUPPORT_LABEL: Record<SupportType, string> = { pinned: 'Pinned support', roller: 'Roller support', fixed: 'Fixed support' };

export default function BeamPage() {
  const st = useBeam();
  const sec = sectionProps(st.section);
  const model: BeamModel = useMemo(
    () => ({
      L: st.L,
      supports: st.supports,
      hinges: st.hinges.map((h) => h.x),
      points: st.points,
      moments: st.moments,
      lines: st.lines,
      EI: st.E * 1e6 * sec.I * 1e-12, // GPa·mm⁴ → kN·m²
      EA: st.E * 1e6 * sec.A * 1e-6,
    }),
    [st.L, st.supports, st.hinges, st.points, st.moments, st.lines, st.E, sec.I, sec.A],
  );
  const r = useMemo(() => solveBeam(model), [model]);
  const data = r.x.map((x, i) => ({ x, N: r.N[i]!, Q: r.Q[i]!, M: r.M[i]!, w: r.w[i]! * 1000 }));
  const sigma = r.ok ? (Math.abs(r.max.M.v) * 1e6) / sec.W + (Math.abs(r.max.N.v) * 1e3) / sec.A : 0; // MPa

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Beam">
          <div className="space-y-2">
            <select aria-label={t('Examples')} value="" onChange={(e) => e.target.value && st.load(e.target.value as ExampleId)} className={fieldCls}>
              <option value="">{t('Load an example…')}</option>
              {(Object.keys(EXAMPLES) as ExampleId[]).map((k) => (
                <option key={k} value={k}>
                  {t(EXAMPLES[k].label)}
                </option>
              ))}
            </select>
            <NumRow label={t('Length L')} unit="m" value={st.L} onChange={(L) => L > 0 && st.set({ L })} />
          </div>
        </Card>
        <Card title="Supports & hinges">
          <ListEditor
            items={st.supports}
            cols={[t('Type'), 'x [m]']}
            addLabel={t('Add support')}
            onAdd={() => st.set({ supports: [...st.supports, { id: newId('S'), x: st.L, type: 'roller' }] })}
            onRemove={(id) => st.set({ supports: st.supports.filter((s) => s.id !== id) })}
            render={(s) => [
              <select key="t" aria-label={t('Type')} value={s.type} onChange={(e) => st.set({ supports: st.supports.map((o) => (o.id === s.id ? { ...o, type: e.target.value as SupportType } : o)) })} className={fieldCls}>
                {(Object.keys(SUPPORT_LABEL) as SupportType[]).map((k) => (
                  <option key={k} value={k}>
                    {t(SUPPORT_LABEL[k])}
                  </option>
                ))}
              </select>,
              <Num key="x" ariaLabel="x" value={s.x} onChange={(x) => st.set({ supports: st.supports.map((o) => (o.id === s.id ? { ...o, x } : o)) })} />,
            ]}
          />
          <div className="mt-2 border-t border-white/[0.04] pt-2">
            <ListEditor
              items={st.hinges}
              cols={[t('Hinge at x [m]')]}
              addLabel={t('Add hinge')}
              onAdd={() => st.set({ hinges: [...st.hinges, { id: newId('G'), x: st.L / 2 }] })}
              onRemove={(id) => st.set({ hinges: st.hinges.filter((h) => h.id !== id) })}
              render={(h) => [<Num key="x" ariaLabel="x" value={h.x} onChange={(x) => st.set({ hinges: st.hinges.map((o) => (o.id === h.id ? { ...o, x } : o)) })} />]}
            />
          </div>
        </Card>
        <Card title="Loads">
          <p className="mb-1 text-[10px] text-plant-500">{t('Point forces: angle to the beam axis, 90° = downward, 270° = upward.')}</p>
          <ListEditor
            items={st.points}
            cols={['F [kN]', 'α [°]', 'x [m]']}
            addLabel={t('Add point force')}
            onAdd={() => st.set({ points: [...st.points, { id: newId('F'), x: st.L / 2, F: 10, angle: 90 }] })}
            onRemove={(id) => st.set({ points: st.points.filter((p) => p.id !== id) })}
            render={(p) => [
              <Num key="F" ariaLabel="F" value={p.F} onChange={(F) => st.set({ points: st.points.map((o) => (o.id === p.id ? { ...o, F } : o)) })} />,
              <Num key="a" ariaLabel="α" value={p.angle} onChange={(angle) => st.set({ points: st.points.map((o) => (o.id === p.id ? { ...o, angle } : o)) })} />,
              <Num key="x" ariaLabel="x" value={p.x} onChange={(x) => st.set({ points: st.points.map((o) => (o.id === p.id ? { ...o, x } : o)) })} />,
            ]}
          />
          <div className="mt-2 border-t border-white/[0.04] pt-2">
            <p className="mb-1 text-[10px] text-plant-500">{t('Line loads: q₁ at x₁ to q₂ at x₂, downward positive (trapezoid or triangle).')}</p>
            <ListEditor
              items={st.lines}
              cols={['q₁ [kN/m]', 'q₂', 'x₁ [m]', 'x₂']}
              addLabel={t('Add line load')}
              onAdd={() => st.set({ lines: [...st.lines, { id: newId('q'), x1: 0, x2: st.L, q1: 5, q2: 5 }] })}
              onRemove={(id) => st.set({ lines: st.lines.filter((l) => l.id !== id) })}
              render={(l) => [
                <Num key="q1" ariaLabel="q1" value={l.q1} onChange={(q1) => st.set({ lines: st.lines.map((o) => (o.id === l.id ? { ...o, q1 } : o)) })} />,
                <Num key="q2" ariaLabel="q2" value={l.q2} onChange={(q2) => st.set({ lines: st.lines.map((o) => (o.id === l.id ? { ...o, q2 } : o)) })} />,
                <Num key="x1" ariaLabel="x1" value={l.x1} onChange={(x1) => st.set({ lines: st.lines.map((o) => (o.id === l.id ? { ...o, x1 } : o)) })} />,
                <Num key="x2" ariaLabel="x2" value={l.x2} onChange={(x2) => st.set({ lines: st.lines.map((o) => (o.id === l.id ? { ...o, x2 } : o)) })} />,
              ]}
            />
          </div>
          <div className="mt-2 border-t border-white/[0.04] pt-2">
            <ListEditor
              items={st.moments}
              cols={[t('M [kNm] ↺'), 'x [m]']}
              addLabel={t('Add moment')}
              onAdd={() => st.set({ moments: [...st.moments, { id: newId('M'), x: st.L / 2, M: 10 }] })}
              onRemove={(id) => st.set({ moments: st.moments.filter((m) => m.id !== id) })}
              render={(m) => [
                <Num key="M" ariaLabel="M" value={m.M} onChange={(M) => st.set({ moments: st.moments.map((o) => (o.id === m.id ? { ...o, M } : o)) })} />,
                <Num key="x" ariaLabel="x" value={m.x} onChange={(x) => st.set({ moments: st.moments.map((o) => (o.id === m.id ? { ...o, x } : o)) })} />,
              ]}
            />
          </div>
        </Card>
        <SectionCard />
      </aside>

      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
          <Kpi label="System" value={r.error === 'mechanism' ? t('unstable') : r.degree === 0 ? t('determinate') : r.degree > 0 ? t('{n}× indeterminate', { n: r.degree }) : t('unstable')} sub={`r = ${r.r}, g = ${r.g} → n = r − 3 − g = ${r.degree}`} small />
          <Kpi label="max |M|" value={nf(Math.abs(r.max.M.v), 2)} unit="kNm" sub={`x = ${nf(r.max.M.x, 2)} m`} />
          <Kpi label="max |Q|" value={nf(Math.abs(r.max.Q.v), 2)} unit="kN" sub={`x = ${nf(r.max.Q.x, 2)} m`} />
          <Kpi label="max |N|" value={nf(Math.abs(r.max.N.v), 2)} unit="kN" sub={`x = ${nf(r.max.N.x, 2)} m`} />
          <Kpi label="σ_max" value={nf(sigma, 1)} unit="MPa" sub={`${t('utilisation')} ${nf((sigma / st.sigmaAllow) * 100, 0)} %`} tone={sigma > st.sigmaAllow ? 'muted' : 'default'} />
          <Kpi label="w_max" value={nf(Math.abs(r.max.w.v) * 1000, 2)} unit="mm" sub={`x = ${nf(r.max.w.x, 2)} m · L/${nf(Math.abs(r.max.w.v) > 0 ? st.L / Math.abs(r.max.w.v) : 0, 0)}`} />
        </div>
        {r.error === 'nosupport' && <Notice tone="error">{t('Add at least one support.')}</Notice>}
        {r.error === 'mechanism' && <Notice tone="error">{t('The beam can move as a mechanism (kinematically unstable): add or change supports, or remove a hinge.')}</Notice>}
        {r.ok && sigma > st.sigmaAllow && <Notice tone="warning">{t('The bending stress exceeds the allowable stress.')}</Notice>}
        <Card title="System and loads" aside={<span className="text-[10px] text-plant-500">{t('Drag supports and loads along the beam')}</span>}>
          <BeamDrawing r={r} />
        </Card>
        {r.ok && (
          <div className="grid gap-2 lg:grid-cols-2">
            <Card title="Internal forces">
              <div className="space-y-1">
                <Diagram data={data} dataKey="N" label={t('Normal force N(x)')} unit="kN" color={VIZ.qLine} xMax={st.L} />
                <Diagram data={data} dataKey="Q" label={t('Shear force Q(x)')} unit="kN" color={VIZ.operating} xMax={st.L} />
                <Diagram data={data} dataKey="M" label={t('Bending moment M(x)')} unit="kNm" color={VIZ.equilibrium} xMax={st.L} reversed />
              </div>
            </Card>
            <div className="space-y-2">
              <Card title="Deflection curve">
                <Diagram data={data} dataKey="w" label={t('Deflection w(x)')} unit="mm" color={VIZ.text} xMax={st.L} reversed height={170} />
                <p className="mt-1 text-[10px] text-plant-500">
                  EI = {nf(model.EI, 0)} kNm² · E = {nf(st.E, 0)} GPa · I_y = {nf(sec.I / 1e4, 1)} cm⁴
                </p>
              </Card>
              <Equilibrium r={r} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard() {
  const st = useBeam();
  const s = st.section;
  const p = sectionProps(s);
  const setS = (patch: Partial<Section>) => st.set({ section: { ...s, ...patch } as Section });
  return (
    <Card title="Material & cross-section">
      <div className="space-y-2">
        <label className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-2 text-[11px] text-plant-300">
          <span>{t('Material')}</span>
          <select
            className={fieldCls}
            value={st.E === 210 ? 'steel' : st.E === 70 ? 'alu' : st.E === 11 ? 'wood' : st.E === 30 ? 'concrete' : 'own'}
            onChange={(e) => {
              const m = { steel: [210, 160], alu: [70, 100], wood: [11, 10], concrete: [30, 12] }[e.target.value];
              if (m) st.set({ E: m[0], sigmaAllow: m[1] });
            }}
          >
            <option value="steel">{t('Steel S235')}</option>
            <option value="alu">{t('Aluminium')}</option>
            <option value="wood">{t('Softwood')}</option>
            <option value="concrete">{t('Concrete')}</option>
            <option value="own">{t('Own values')}</option>
          </select>
        </label>
        <NumRow label={t('Young’s modulus E')} unit="GPa" value={st.E} onChange={(E) => E > 0 && st.set({ E })} />
        <NumRow label={t('Allowable stress σ_zul')} unit="MPa" value={st.sigmaAllow} onChange={(sigmaAllow) => sigmaAllow > 0 && st.set({ sigmaAllow })} />
        <select
          aria-label={t('Cross-section')}
          className={fieldCls}
          value={s.kind}
          onChange={(e) => {
            const k = e.target.value as Section['kind'];
            st.set({ section: k === 'rect' ? { kind: 'rect', b: 100, h: 200 } : k === 'circle' ? { kind: 'circle', d: 60 } : k === 'tube' ? { kind: 'tube', D: 80, d: 70 } : { kind: 'I', h: 200, b: 100, tw: 5.6, tf: 8.5 } });
          }}
        >
          <option value="rect">{t('Rectangle')}</option>
          <option value="circle">{t('Solid circle')}</option>
          <option value="tube">{t('Tube')}</option>
          <option value="I">{t('I-section (e.g. IPE 200)')}</option>
        </select>
        {s.kind === 'rect' && (
          <>
            <NumRow label={t('Width b')} unit="mm" value={s.b} onChange={(b) => b > 0 && setS({ b })} />
            <NumRow label={t('Height h')} unit="mm" value={s.h} onChange={(h) => h > 0 && setS({ h })} />
          </>
        )}
        {s.kind === 'circle' && <NumRow label={t('Diameter d')} unit="mm" value={s.d} onChange={(d) => d > 0 && setS({ d })} />}
        {s.kind === 'tube' && (
          <>
            <NumRow label={t('Outer diameter D')} unit="mm" value={s.D} onChange={(D) => D > 0 && setS({ D })} />
            <NumRow label={t('Inner diameter d')} unit="mm" value={s.d} onChange={(d) => d >= 0 && setS({ d })} />
          </>
        )}
        {s.kind === 'I' && (
          <>
            <NumRow label={t('Height h')} unit="mm" value={s.h} onChange={(h) => h > 0 && setS({ h })} />
            <NumRow label={t('Flange width b')} unit="mm" value={s.b} onChange={(b) => b > 0 && setS({ b })} />
            <NumRow label={t('Web thickness t_w')} unit="mm" value={s.tw} onChange={(tw) => tw > 0 && setS({ tw })} />
            <NumRow label={t('Flange thickness t_f')} unit="mm" value={s.tf} onChange={(tf) => tf > 0 && setS({ tf })} />
          </>
        )}
        <p className="font-mono text-[10px] text-plant-400">
          A = {nf(p.A / 100, 2)} cm² · I_y = {nf(p.I / 1e4, 1)} cm⁴ · W_y = {nf(p.W / 1e3, 1)} cm³
        </p>
      </div>
    </Card>
  );
}

const W = 1000;
const PAD = 70;

function BeamDrawing({ r }: { r: ReturnType<typeof solveBeam> }) {
  const st = useBeam();
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ kind: 'support' | 'point' | 'moment' | 'hinge'; id: string } | null>(null);
  const sx = (x: number) => PAD + ((W - 2 * PAD) * x) / st.L;
  const Y = 120;
  const qmax = Math.max(1e-9, ...st.lines.flatMap((l) => [Math.abs(l.q1), Math.abs(l.q2)]));
  const toX = (e: RPointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const x = ((px - PAD) / (W - 2 * PAD)) * st.L;
    return Math.round(Math.min(st.L, Math.max(0, x)) * 20) / 20;
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    const x = toX(e);
    if (drag.kind === 'support') st.set({ supports: st.supports.map((s) => (s.id === drag.id ? { ...s, x } : s)) });
    if (drag.kind === 'point') st.set({ points: st.points.map((s) => (s.id === drag.id ? { ...s, x } : s)) });
    if (drag.kind === 'moment') st.set({ moments: st.moments.map((s) => (s.id === drag.id ? { ...s, x } : s)) });
    if (drag.kind === 'hinge') st.set({ hinges: st.hinges.map((s) => (s.id === drag.id ? { ...s, x } : s)) });
  };
  const grab = (kind: NonNullable<typeof drag>['kind'], id: string) => (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ kind, id });
  };
  const react = new Map(r.reactions.map((re) => [re.supportId, re]));
  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} 250`}
      className="h-auto w-full touch-none select-none"
      onPointerMove={onMove}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
      role="img"
      aria-label={t('Beam with supports and loads')}
    >
      <defs>
        <marker id="arrL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={MECH.load} />
        </marker>
        <marker id="arrR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={MECH.reaction} />
        </marker>
      </defs>
      {/* line loads */}
      {st.lines.map((l) => {
        const h = (q: number) => (Math.abs(q) / qmax) * 45;
        const a = sx(l.x1);
        const b = sx(l.x2);
        const n = Math.max(2, Math.round(Math.abs(b - a) / 40));
        return (
          <g key={l.id}>
            <path d={`M${a},${Y - 6}L${a},${Y - 6 - h(l.q1)}L${b},${Y - 6 - h(l.q2)}L${b},${Y - 6}`} fill={MECH.load} fillOpacity={0.08} stroke={MECH.load} strokeWidth={1} />
            {Array.from({ length: n + 1 }, (_, k) => {
              const x = a + ((b - a) * k) / n;
              const q = l.q1 + ((l.q2 - l.q1) * k) / n;
              if (h(q) < 6) return null;
              return <line key={k} x1={x} y1={Y - 6 - h(q)} x2={x} y2={Y - 7} stroke={MECH.load} strokeWidth={1} markerEnd="url(#arrL)" />;
            })}
            <text x={(a + b) / 2} y={Y - 12 - Math.max(h(l.q1), h(l.q2))} textAnchor="middle" className="fill-current text-[11px]" style={{ fill: MECH.load }}>
              {l.q1 === l.q2 ? `q = ${nf(l.q1, 2)} kN/m` : `${nf(l.q1, 2)} … ${nf(l.q2, 2)} kN/m`}
            </text>
          </g>
        );
      })}
      {/* beam */}
      <rect x={sx(0)} y={Y - 5} width={sx(st.L) - sx(0)} height={10} rx={2} fill="rgb(var(--plant-700))" stroke={MECH.beam} strokeWidth={1.2} />
      {st.hinges.map((h) => (
        <circle key={h.id} cx={sx(h.x)} cy={Y} r={6} fill="rgb(var(--plant-950))" stroke={MECH.beam} strokeWidth={1.5} className="cursor-ew-resize" onPointerDown={grab('hinge', h.id)} />
      ))}
      {/* supports */}
      {st.supports.map((s) => {
        const x = sx(s.x);
        const re = react.get(s.id);
        return (
          <g key={s.id} className="cursor-ew-resize" onPointerDown={grab('support', s.id)}>
            {s.type === 'fixed' ? (
              <g stroke={MECH.beam} strokeWidth={1.4}>
                <line x1={x} y1={Y - 26} x2={x} y2={Y + 26} />
                {Array.from({ length: 6 }, (_, k) => (
                  <line key={k} x1={x} y1={Y - 22 + k * 9} x2={x + (s.x < st.L / 2 ? -9 : 9)} y2={Y - 13 + k * 9} />
                ))}
              </g>
            ) : (
              <g stroke={MECH.beam} strokeWidth={1.4} fill="rgb(var(--plant-950))">
                <path d={`M${x},${Y + 5}L${x - 12},${Y + 25}L${x + 12},${Y + 25}Z`} />
                {s.type === 'roller' ? <line x1={x - 16} y1={Y + 31} x2={x + 16} y2={Y + 31} /> : <line x1={x - 16} y1={Y + 25} x2={x + 16} y2={Y + 25} />}
                {s.type === 'pinned' && Array.from({ length: 4 }, (_, k) => <line key={k} x1={x - 14 + k * 8} y1={Y + 25} x2={x - 20 + k * 8} y2={Y + 32} />)}
              </g>
            )}
            <rect x={x - 18} y={Y - 30} width={36} height={66} fill="transparent" />
            {re && r.ok && (
              <g>
                {Math.abs(re.Fz) > 1e-9 && (
                  <line x1={x} y1={re.Fz < 0 ? Y + 85 : Y + 40} x2={x} y2={re.Fz < 0 ? Y + 40 : Y + 85} stroke={MECH.reaction} strokeWidth={2} markerEnd="url(#arrR)" />
                )}
                {Math.abs(re.Fx) > 1e-9 && (
                  <line x1={re.Fx > 0 ? x - 50 : x - 8} y1={Y + 50} x2={re.Fx > 0 ? x - 8 : x - 50} y2={Y + 50} stroke={MECH.reaction} strokeWidth={2} markerEnd="url(#arrR)" />
                )}
                <text x={x} y={Y + 102} textAnchor="middle" className="text-[11px]" style={{ fill: MECH.reaction }}>
                  {s.id}: {Math.abs(re.Fz) > 1e-9 ? `${nf(Math.abs(re.Fz), 2)} kN` : ''}
                  {Math.abs(re.Fx) > 1e-9 ? ` · H ${nf(Math.abs(re.Fx), 2)}` : ''}
                  {Math.abs(re.M) > 1e-9 ? ` · M ${nf(Math.abs(re.M), 2)}` : ''}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {/* point forces */}
      {st.points.map((p) => {
        const x = sx(p.x);
        const a = (p.angle * Math.PI) / 180;
        const len = 60;
        const x0 = x - Math.cos(a) * len;
        const y0 = Y - 6 - Math.sin(a) * len;
        const up = Math.sin(a) < 0;
        return (
          <g key={p.id} className="cursor-ew-resize" onPointerDown={grab('point', p.id)}>
            <line x1={up ? x : x0} y1={up ? Y + 6 : y0} x2={up ? x + Math.cos(a) * len : x} y2={up ? Y + 6 - Math.sin(a) * len : Y - 7} stroke={MECH.load} strokeWidth={2.2} markerEnd="url(#arrL)" />
            <rect x={x - 14} y={Y - 75} width={28} height={70} fill="transparent" />
            <text x={x0} y={Math.min(y0, Y - 6) - 6} textAnchor="middle" className="text-[11px] font-semibold" style={{ fill: MECH.load }}>
              {nf(p.F, 2)} kN
            </text>
          </g>
        );
      })}
      {/* moments */}
      {st.moments.map((m) => {
        const x = sx(m.x);
        const ccw = m.M >= 0;
        return (
          <g key={m.id} className="cursor-ew-resize" onPointerDown={grab('moment', m.id)}>
            <path d={ccw ? `M${x + 18},${Y + 10} A20,20 0 1 0 ${x + 18},${Y - 10}` : `M${x - 18},${Y + 10} A20,20 0 1 1 ${x - 18},${Y - 10}`} fill="none" stroke={MECH.load} strokeWidth={2} markerEnd="url(#arrL)" />
            <rect x={x - 24} y={Y - 24} width={48} height={48} fill="transparent" />
            <text x={x} y={Y - 30} textAnchor="middle" className="text-[11px] font-semibold" style={{ fill: MECH.load }}>
              {nf(Math.abs(m.M), 2)} kNm
            </text>
          </g>
        );
      })}
      {/* dimension */}
      <g className="text-[10px]" style={{ fill: 'rgb(var(--plant-400))' }}>
        <line x1={sx(0)} y1={235} x2={sx(st.L)} y2={235} stroke="rgb(var(--plant-500))" />
        {Array.from({ length: Math.min(20, Math.floor(st.L)) + 1 }, (_, k) => (st.L <= 20 ? k : (k * st.L) / 20)).map((x) => (
          <g key={x}>
            <line x1={sx(x)} y1={231} x2={sx(x)} y2={239} stroke="rgb(var(--plant-500))" />
            <text x={sx(x)} y={228} textAnchor="middle">
              {nf(x, 1)}
            </text>
          </g>
        ))}
        <text x={sx(st.L) + 8} y={238}>
          m
        </text>
      </g>
    </svg>
  );
}

function Equilibrium({ r }: { r: ReturnType<typeof solveBeam> }) {
  const st = useBeam();
  const n = (v: number) => (nf(v, 3).startsWith('-') ? `(${nf(v, 3)})` : nf(v, 3)).replace(',', '{,}');
  // terms of ΣFx, ΣFz, ΣM about x = 0 (counter-clockwise positive)
  const fxT: string[] = [];
  const fzT: string[] = [];
  const mT: string[] = [];
  for (const re of r.reactions) {
    if (re.type !== 'roller') fxT.push(`${re.supportId}_H`);
    fzT.push(`${re.supportId}_V`);
    if (re.x !== 0) mT.push(`- ${re.supportId}_V \\cdot ${n(re.x)}`);
    if (re.type === 'fixed') mT.push(`+ M_{${re.supportId}}`);
  }
  for (const p of st.points) {
    const c = pointComponents(p);
    if (c.Fx) fxT.push(n(c.Fx));
    if (c.Fz) {
      fzT.push(n(c.Fz));
      if (p.x !== 0) mT.push(`- ${n(c.Fz)} \\cdot ${n(p.x)}`);
    }
  }
  for (const l of st.lines) {
    const { R, xc } = lineResultant(l);
    fzT.push(n(R));
    mT.push(`- ${n(R)} \\cdot ${n(xc)}`);
  }
  for (const m of st.moments) mT.push(`+ ${n(m.M)}`);
  const vals = r.reactions.flatMap((re) => [
    ...(re.type !== 'roller' ? [`${re.supportId}_H = ${n(re.Fx)}\\ \\mathrm{kN}`] : []),
    `${re.supportId}_V = ${n(re.Fz)}\\ \\mathrm{kN}`,
    ...(re.type === 'fixed' ? [`M_{${re.supportId}} = ${n(re.M)}\\ \\mathrm{kNm}`] : []),
  ]);
  return (
    <Card title="Equilibrium (solution path)">
      <div className="space-y-1 text-[13px] text-plant-100">
        <p className="text-[10px] text-plant-500">{t('Forces on the beam: H → right, V ↓ down, moments ↺ positive; line loads replaced by their resultants.')}</p>
        <Tex block math={`\\textstyle\\sum F_x = ${fxT.join(' + ') || '0'} = 0`} />
        <Tex block math={`\\textstyle\\sum F_z = ${fzT.join(' + ') || '0'} = 0`} />
        <Tex block math={`\\textstyle\\sum M^{(x=0)} = ${mT.join(' ').replace(/^\+ /, '') || '0'} = 0`} />
        {st.hinges.length > 0 && <p className="text-[10px] text-plant-500">{t('Plus one condition per hinge: M = 0 at the hinge.')}</p>}
        <div className="pt-1 text-signal-heat">
          <Tex block math={`\\Rightarrow\\ ${vals.join(',\\quad ')}`} />
        </div>
        <p className="text-[10px] text-plant-500">
          {r.degree === 0
            ? t('Statically determinate: the equilibrium conditions alone give the reactions.')
            : t('Statically indeterminate ({n}×): equilibrium is not enough; the reactions follow from the deformation (compatibility), here by the finite-element method. The equations above are then a check.', { n: r.degree })}{' '}
          {t('Check: residuals ΣF_x = {a}, ΣF_z = {b}, ΣM = {c}.', { a: nf(r.check.Fx, 6), b: nf(r.check.Fz, 6), c: nf(r.check.M0, 6) })}
        </p>
      </div>
    </Card>
  );
}
