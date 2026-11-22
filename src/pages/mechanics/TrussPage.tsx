import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { VIZ } from '@/components/analysis/vizTokens';
import { Card, fieldCls, MECH, newId, nf, NumRow, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { geometry, held, solveTruss, type TBar, type TNode, type TSupport } from '@/engine/mechanics/truss';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

type Tool = 'select' | 'node' | 'bar' | 'force' | 'delete';

/** a point load on a bar at the fraction u of its length (from node a); the solver sees its equivalent nodal loads */
interface BarLoad {
  id: string;
  bar: string;
  u: number;
  Fx: number;
  Fy: number;
}

interface TrussState {
  nodes: TNode[];
  bars: TBar[];
  barLoads: BarLoad[];
  EA: number; // kN
  set: (p: Partial<Pick<TrussState, 'nodes' | 'bars' | 'barLoads' | 'EA'>>) => void;
  load: (id: ExampleId) => void;
}

type ExampleId = 'roof' | 'warren' | 'crane';
const mk = (name: string, x: number, y: number, support: TSupport = 'none', Fx = 0, Fy = 0): TNode => ({ id: name, name, x, y, support, Fx, Fy });
const bars = (pairs: string): TBar[] => pairs.split(' ').map((p) => ({ id: p, a: p[0]!, b: p[1]! }));
const EXAMPLES: Record<ExampleId, { label: string; nodes: TNode[]; bars: TBar[] }> = {
  roof: {
    label: 'Roof truss',
    nodes: [mk('A', 0, 0, 'pinned'), mk('B', 3, 0, 'none', 0, -10), mk('C', 6, 0, 'none', 0, -10), mk('D', 9, 0, 'rollerX'), mk('E', 3, 2), mk('F', 6, 2), mk('G', 4.5, 3, 'none', 0, -5)],
    bars: bars('AB BC CD AE EB EG GF FC FD BG GC'),
  },
  warren: {
    label: 'Warren bridge truss',
    nodes: [mk('A', 0, 0, 'pinned'), mk('B', 4, 0, 'none', 0, -20), mk('C', 8, 0, 'none', 0, -20), mk('D', 12, 0, 'rollerX'), mk('E', 2, 3), mk('F', 6, 3, 'none', 0, -10), mk('G', 10, 3)],
    bars: bars('AB BC CD EF FG AE EB BF FC CG GD'),
  },
  crane: {
    label: 'Wall crane (cantilever truss)',
    nodes: [mk('A', 0, 0, 'pinned'), mk('B', 0, 3, 'pinned'), mk('C', 3, 0), mk('D', 3, 1.5), mk('E', 6, 0, 'none', 0, -15)],
    bars: bars('AC BD CD AD CE DE'),
  },
};

const useTruss = create<TrussState>()(
  persist(
    (set) => ({
      nodes: EXAMPLES.warren.nodes,
      bars: EXAMPLES.warren.bars,
      barLoads: [],
      EA: 2.1e5 * 20, // 210 GPa · 20 cm² in kN
      set: (p) => set(p),
      load: (id) => set({ nodes: EXAMPLES[id].nodes, bars: EXAMPLES[id].bars, barLoads: [] }),
    }),
    { name: 'ts-truss', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ nodes, bars: b, barLoads, EA }) => ({ nodes, bars: b, barLoads, EA }) },
  ),
);

const SUPPORTS: { id: TSupport; label: string }[] = [
  { id: 'none', label: 'Free node' },
  { id: 'pinned', label: 'Pinned support (x and y held)' },
  { id: 'rollerX', label: 'Roller, rolls along x (y held)' },
  { id: 'rollerY', label: 'Roller, rolls along y (x held)' },
];

export default function TrussPage() {
  const st = useTruss();
  const eqNodes = useMemo(() => withBarLoads(st.nodes, st.bars, st.barLoads), [st.nodes, st.bars, st.barLoads]);
  const r = useMemo(() => solveTruss({ nodes: eqNodes, bars: st.bars, EA: st.EA }), [eqNodes, st.bars, st.EA]);
  const [sel, setSel] = useState<{ kind: 'node' | 'bar'; id: string } | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [deformed, setDeformed] = useState(false);
  const node = sel?.kind === 'node' ? st.nodes.find((n) => n.id === sel.id) : undefined;
  const bar = sel?.kind === 'bar' ? st.bars.find((b) => b.id === sel.id) : undefined;
  const maxN = Math.max(0, ...[...r.N.values()].map(Math.abs));
  const zeroBars = [...r.N.entries()].filter(([, v]) => Math.abs(v) < 1e-6 * Math.max(1, maxN)).map(([id]) => id);

  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi
            label="System"
            value={r.error === 'mechanism' ? t('unstable') : r.degree === 0 ? t('determinate') : r.degree > 0 ? t('{n}× indeterminate', { n: r.degree }) : t('unstable')}
            sub={`2k = ${2 * r.k} · s + r = ${r.s} + ${r.r}`}
            small
          />
          <Kpi label={t('max tension')} value={nf(Math.max(0, ...[...r.N.values()]), 2)} unit="kN" />
          <Kpi label={t('max compression')} value={nf(Math.abs(Math.min(0, ...[...r.N.values()])), 2)} unit="kN" />
          <Kpi label={t('zero-force members')} value={String(zeroBars.length)} sub={zeroBars.join(', ') || '–'} />
        </div>
        {r.error === 'mechanism' && (
          <Notice tone="error">{t('The truss is a mechanism (kinematically unstable): add bars or supports. A determinate truss needs 2k = s + r and a stable arrangement.')}</Notice>
        )}
        <Card
          title="Truss"
          aside={
            <div className="flex items-center gap-1">
              {(['select', 'node', 'bar', 'force', 'delete'] as Tool[]).map((tl) => (
                <button
                  key={tl}
                  type="button"
                  aria-pressed={tool === tl}
                  onClick={() => setTool(tl)}
                  className={cn('rounded px-2 py-0.5 text-[11px]', tool === tl ? 'bg-signal-heat/15 text-signal-heat' : 'text-plant-300 hover:bg-white/[0.04]')}
                >
                  {t({ select: 'Select / move', node: 'Add node', bar: 'Add bar', force: 'Add force', delete: 'Delete' }[tl])}
                </button>
              ))}
              <label className="ml-2 flex items-center gap-1 text-[11px] text-plant-300">
                <input type="checkbox" checked={deformed} onChange={(e) => setDeformed(e.target.checked)} /> {t('deformed shape')}
              </label>
            </div>
          }
        >
          {tool === 'force' && (
            <p className="mb-1 rounded border border-signal-heat/25 bg-signal-heat/[0.06] px-2 py-1 text-[11px] text-plant-200">
              {t(
                'Add force: press on a node or anywhere on a bar and drag in the direction of the force — the longer the drag, the larger the force (10 kN per metre). A force on a bar is passed to its two end nodes by the lever rule; the bar then also bends.',
              )}
            </p>
          )}
          <TrussDrawing r={r} tool={tool} sel={sel} setSel={setSel} deformed={deformed} zero={zeroBars} />
          <p className="mt-1 text-[10px] text-plant-500">
            <span style={{ color: VIZ.equilibrium }}>■</span> {t('tension')} · <span style={{ color: VIZ.operating }}>■</span> {t('compression')} · <span className="text-plant-500">┄</span>{' '}
            {t('zero-force member')} · {t('green arrows: support reactions')}
          </p>
        </Card>
        {r.ok && <NodeEquations r={r} eqNodes={eqNodes} focus={node?.id} />}
      </div>

      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Truss">
          <div className="space-y-2">
            <select aria-label={t('Examples')} value="" onChange={(e) => e.target.value && (st.load(e.target.value as ExampleId), setSel(null))} className={fieldCls}>
              <option value="">{t('Load an example…')}</option>
              {(Object.keys(EXAMPLES) as ExampleId[]).map((k) => (
                <option key={k} value={k}>
                  {t(EXAMPLES[k].label)}
                </option>
              ))}
            </select>
            <NumRow label={t('Axial stiffness EA')} unit="kN" value={st.EA} onChange={(EA) => EA > 0 && st.set({ EA })} />
            <p className="text-[10px] leading-relaxed text-plant-500">{t('EA only matters for the deformation and for indeterminate trusses.')}</p>
          </div>
        </Card>
        {node && (
          <Card title="Node">
            <div className="space-y-2">
              <input aria-label={t('Name')} className={fieldCls} value={node.name} onChange={(e) => st.set({ nodes: st.nodes.map((n) => (n.id === node.id ? { ...n, name: e.target.value } : n)) })} />
              <NumRow label="x" unit="m" value={node.x} onChange={(x) => st.set({ nodes: st.nodes.map((n) => (n.id === node.id ? { ...n, x } : n)) })} />
              <NumRow label="y" unit="m" value={node.y} onChange={(y) => st.set({ nodes: st.nodes.map((n) => (n.id === node.id ? { ...n, y } : n)) })} />
              <select
                aria-label={t('Support')}
                className={fieldCls}
                value={node.support}
                onChange={(e) => st.set({ nodes: st.nodes.map((n) => (n.id === node.id ? { ...n, support: e.target.value as TSupport } : n)) })}
              >
                {SUPPORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
              <NumRow label={t('Load F_x (→ +)')} unit="kN" value={node.Fx} onChange={(Fx) => st.set({ nodes: st.nodes.map((n) => (n.id === node.id ? { ...n, Fx } : n)) })} />
              <NumRow label={t('Load F_y (↑ +)')} unit="kN" value={node.Fy} onChange={(Fy) => st.set({ nodes: st.nodes.map((n) => (n.id === node.id ? { ...n, Fy } : n)) })} />
              {r.R.get(node.id) && (
                <p className="font-mono text-[11px] text-signal-ok">
                  R_x = {nf(r.R.get(node.id)!.Rx, 3)} kN · R_y = {nf(r.R.get(node.id)!.Ry, 3)} kN
                </p>
              )}
            </div>
          </Card>
        )}
        {bar && (
          <Card title="Bar">
            <p className="font-mono text-[11px] text-plant-200">
              {nameOf(st.nodes, bar.a)}–{nameOf(st.nodes, bar.b)} · L = {nf(geometry({ nodes: st.nodes, bars: st.bars, EA: st.EA }, bar).L, 3)} m
            </p>
            {r.N.has(bar.id) && (
              <p className="mt-1 font-mono text-[12px]" style={{ color: r.N.get(bar.id)! >= 0 ? VIZ.equilibrium : VIZ.operating }}>
                S = {nf(r.N.get(bar.id)!, 3)} kN ({t(Math.abs(r.N.get(bar.id)!) < 1e-9 ? 'zero-force member' : r.N.get(bar.id)! > 0 ? 'tension' : 'compression')})
              </p>
            )}
          </Card>
        )}
        <LoadsCard r={r} eqNodes={eqNodes} sel={sel} setSel={setSel} />
        <Card title="Bar forces">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-plant-500">
                <th className="py-0.5 text-left font-normal">{t('Bar')}</th>
                <th className="py-0.5 text-right font-normal">L [m]</th>
                <th className="py-0.5 text-right font-normal">S [kN]</th>
                <th className="py-0.5 text-right font-normal" />
              </tr>
            </thead>
            <tbody>
              {st.bars.map((b) => {
                const N = r.N.get(b.id);
                return (
                  <tr key={b.id} className={cn('cursor-pointer border-t border-white/[0.03] font-mono', sel?.id === b.id && 'bg-white/[0.04]')} onClick={() => setSel({ kind: 'bar', id: b.id })}>
                    <td className="py-0.5 text-plant-100">
                      {nameOf(st.nodes, b.a)}–{nameOf(st.nodes, b.b)}
                    </td>
                    <td className="py-0.5 text-right text-plant-400">{nf(geometry({ nodes: st.nodes, bars: st.bars, EA: st.EA }, b).L, 2)}</td>
                    <td className="py-0.5 text-right" style={{ color: N === undefined ? undefined : N >= 0 ? VIZ.equilibrium : VIZ.operating }}>
                      {N === undefined ? '?' : nf(N, 2)}
                    </td>
                    <td className="py-0.5 pl-2 text-right font-sans text-[10px] text-plant-500">{N === undefined ? '' : Math.abs(N) < 1e-9 ? '0' : N > 0 ? t('T') : t('C')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-plant-500">{t('S > 0 tension (T), S < 0 compression (C).')}</p>
        </Card>
      </aside>
    </div>
  );
}

const nameOf = (nodes: TNode[], id: string) => nodes.find((n) => n.id === id)?.name ?? id;

/** magnitude and direction of a load (angle from +x, counter-clockwise, in degrees) */
const polar = (Fx: number, Fy: number) => ({ F: Math.hypot(Fx, Fy), deg: (Math.atan2(Fy, Fx) * 180) / Math.PI });
const fromPolar = (F: number, deg: number) => ({ Fx: round6(F * Math.cos((deg * Math.PI) / 180)), Fy: round6(F * Math.sin((deg * Math.PI) / 180)) });
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** equivalent nodal loads: a force F at u·L on bar a–b gives (1−u)·F at a and u·F at b (same resultant and moment) */
function withBarLoads(nodes: TNode[], bars: TBar[], loads: BarLoad[]): TNode[] {
  if (!loads.length) return nodes;
  const add = new Map<string, { Fx: number; Fy: number }>();
  for (const l of loads) {
    const b = bars.find((x) => x.id === l.bar);
    if (!b) continue;
    for (const [id, w] of [
      [b.a, 1 - l.u],
      [b.b, l.u],
    ] as const) {
      const o = add.get(id) ?? { Fx: 0, Fy: 0 };
      add.set(id, { Fx: o.Fx + w * l.Fx, Fy: o.Fy + w * l.Fy });
    }
  }
  return nodes.map((n) => {
    const a = add.get(n.id);
    return a ? { ...n, Fx: n.Fx + a.Fx, Fy: n.Fy + a.Fy } : n;
  });
}

/** All loads with magnitude and angle, and the global equilibrium check ΣF = 0, ΣM = 0. */
function LoadsCard({
  r,
  eqNodes,
  sel,
  setSel,
}: {
  r: ReturnType<typeof solveTruss>;
  eqNodes: TNode[];
  sel: { kind: 'node' | 'bar'; id: string } | null;
  setSel: (s: { kind: 'node' | 'bar'; id: string } | null) => void;
}) {
  const st = useTruss();
  const setLoad = (id: string, p: Partial<BarLoad>) => st.set({ barLoads: st.barLoads.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const loaded = st.nodes.filter((n) => n.Fx !== 0 || n.Fy !== 0);
  const setNode = (id: string, p: Partial<TNode>) => st.set({ nodes: st.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) });
  let sx = 0;
  let sy = 0;
  let sm = 0; // moment about the origin, counter-clockwise positive
  for (const n of eqNodes) {
    const R = r.R.get(n.id);
    const fx = n.Fx + (r.ok && R ? R.Rx : 0);
    const fy = n.Fy + (r.ok && R ? R.Ry : 0);
    sx += fx;
    sy += fy;
    sm += n.x * fy - n.y * fx;
  }
  return (
    <Card title="Loads">
      {loaded.length === 0 && st.barLoads.length === 0 ? (
        <p className="text-[11px] text-plant-500">{t('No loads yet — choose “Add force” and drag from a node.')}</p>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-plant-500">
              <th className="py-0.5 text-left font-normal">{t('Node')}</th>
              <th className="py-0.5 text-right font-normal">|F| [kN]</th>
              <th className="py-0.5 text-right font-normal">∠ [°]</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loaded.map((n) => {
              const { F, deg } = polar(n.Fx, n.Fy);
              return (
                <tr key={n.id} className={cn('border-t border-white/[0.03] font-mono', sel?.id === n.id && 'bg-white/[0.04]')}>
                  <td className="cursor-pointer py-0.5 text-plant-100" onClick={() => setSel({ kind: 'node', id: n.id })}>
                    {n.name}
                  </td>
                  <td className="py-0.5 text-right">
                    <input
                      aria-label={t('Force magnitude at {n}', { n: n.name })}
                      type="number"
                      step={1}
                      min={0}
                      value={nf(F, 3)}
                      onChange={(e) => setNode(n.id, fromPolar(Math.max(0, Number(e.target.value) || 0), deg))}
                      className="w-16 rounded bg-transparent text-right text-plant-100 outline-none focus:bg-white/[0.05]"
                    />
                  </td>
                  <td className="py-0.5 text-right">
                    <input
                      aria-label={t('Force angle at {n}', { n: n.name })}
                      type="number"
                      step={15}
                      value={nf(deg, 1)}
                      onChange={(e) => setNode(n.id, fromPolar(F, Number(e.target.value) || 0))}
                      className="w-14 rounded bg-transparent text-right text-plant-100 outline-none focus:bg-white/[0.05]"
                    />
                  </td>
                  <td className="py-0.5 pl-1 text-right">
                    <button type="button" aria-label={t('Remove force at {n}', { n: n.name })} onClick={() => setNode(n.id, { Fx: 0, Fy: 0 })} className="px-1 text-plant-500 hover:text-signal-alarm">
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            {st.barLoads.map((l) => {
              const b = st.bars.find((x) => x.id === l.bar);
              if (!b) return null;
              const { F, deg } = polar(l.Fx, l.Fy);
              const g = geometry({ nodes: st.nodes, bars: st.bars, EA: st.EA }, b);
              // force component across the bar → bending moment of a simply supported span, M = F⊥·a·b/L
              const Fperp = Math.abs(-l.Fx * g.s + l.Fy * g.c);
              const M = Fperp * l.u * (1 - l.u) * g.L;
              return (
                <tr key={l.id} className={cn('border-t border-white/[0.03] align-top font-mono', sel?.id === b.id && 'bg-white/[0.04]')}>
                  <td className="cursor-pointer py-0.5 text-plant-100" onClick={() => setSel({ kind: 'bar', id: b.id })}>
                    {nameOf(st.nodes, b.a)}–{nameOf(st.nodes, b.b)}
                    <label className="mt-0.5 flex items-center gap-1 font-sans text-[10px] text-plant-500">
                      u
                      <input
                        aria-label={t('Position on the bar')}
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.05}
                        value={l.u}
                        onChange={(e) => setLoad(l.id, { u: Number(e.target.value) })}
                        className="w-16 accent-[rgb(var(--sig-alarm))]"
                      />
                      {nf(l.u, 2)}
                    </label>
                  </td>
                  <td className="py-0.5 text-right">
                    <input
                      aria-label={t('Force magnitude on bar')}
                      type="number"
                      step={1}
                      min={0}
                      value={nf(F, 3)}
                      onChange={(e) => setLoad(l.id, fromPolar(Math.max(0, Number(e.target.value) || 0), deg))}
                      className="w-16 rounded bg-transparent text-right text-plant-100 outline-none focus:bg-white/[0.05]"
                    />
                    <p className="font-sans text-[10px] text-plant-500">
                      → {nameOf(st.nodes, b.a)}: {nf((1 - l.u) * F, 2)} · {nameOf(st.nodes, b.b)}: {nf(l.u * F, 2)}
                    </p>
                    {M > 1e-9 && <p className="font-sans text-[10px] text-signal-heat">M = {nf(M, 2)} kNm</p>}
                  </td>
                  <td className="py-0.5 text-right">
                    <input
                      aria-label={t('Force angle on bar')}
                      type="number"
                      step={15}
                      value={nf(deg, 1)}
                      onChange={(e) => setLoad(l.id, fromPolar(F, Number(e.target.value) || 0))}
                      className="w-14 rounded bg-transparent text-right text-plant-100 outline-none focus:bg-white/[0.05]"
                    />
                  </td>
                  <td className="py-0.5 pl-1 text-right">
                    <button
                      type="button"
                      aria-label={t('Remove force on bar')}
                      onClick={() => st.set({ barLoads: st.barLoads.filter((x) => x.id !== l.id) })}
                      className="px-1 text-plant-500 hover:text-signal-alarm"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {st.barLoads.length > 0 && (
        <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
          {t(
            'A force on a bar is shared by its end nodes in the ratio of the lever arms (1−u : u). The bar forces S then hold for the nodes; the loaded bar additionally bends with M = F⊥·u·(1−u)·L and must be checked as a beam.',
          )}
        </p>
      )}
      {r.ok && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-plant-400">
          {t('Check (loads + reactions)')}: ΣF<sub>x</sub> = {nf(Math.abs(sx) < 1e-9 ? 0 : sx, 3)} · ΣF<sub>y</sub> = {nf(Math.abs(sy) < 1e-9 ? 0 : sy, 3)} · ΣM = {nf(Math.abs(sm) < 1e-9 ? 0 : sm, 3)}{' '}
          kN
        </p>
      )}
      <p className="mt-1 text-[10px] text-plant-500">{t('Angle from +x, counter-clockwise: −90° points down.')}</p>
    </Card>
  );
}

function TrussDrawing({
  r,
  tool,
  sel,
  setSel,
  deformed,
  zero,
}: {
  r: ReturnType<typeof solveTruss>;
  tool: Tool;
  sel: { kind: 'node' | 'bar'; id: string } | null;
  setSel: (s: { kind: 'node' | 'bar'; id: string } | null) => void;
  deformed: boolean;
  zero: string[];
}) {
  const st = useTruss();
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  /** node whose load is being drawn with the force tool */
  const [fdrag, setFdrag] = useState<{ kind: 'node' | 'bar'; id: string } | null>(null);
  const xs = st.nodes.map((n) => n.x);
  const ys = st.nodes.map((n) => n.y);
  const minX = Math.min(0, ...xs) - 1.5;
  const maxX = Math.max(6, ...xs) + 1.5;
  const minY = Math.min(0, ...ys) - 1.8;
  const maxY = Math.max(3, ...ys) + 1.5;
  const W = 1000;
  const scale = W / (maxX - minX);
  const H = Math.max(260, (maxY - minY) * scale);
  const px = (x: number) => (x - minX) * scale;
  const py = (y: number) => H - (y - minY) * scale;
  const toWorld = (e: RPointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const snap = (v: number) => Math.round(v * 4) / 4;
    return { x: snap(sx / scale + minX), y: snap((H - sy) / scale + minY) };
  };
  /** force from a drag: direction of the drag (snapped to 15°), 10 kN per metre of drag (snapped to 1 kN) */
  const forceFromDrag = (n: { x: number; y: number }, e: RPointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const wx = (((e.clientX - rect.left) / rect.width) * W) / scale + minX;
    const wy = (H - ((e.clientY - rect.top) / rect.height) * H) / scale + minY;
    const dx = wx - n.x;
    const dy = wy - n.y;
    const F = Math.round(Math.hypot(dx, dy) * 10);
    if (F < 1) return { Fx: 0, Fy: 0 };
    return fromPolar(F, Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 15) * 15);
  };
  /** force tool on a bar: a new load at the (snapped) point nearest to the press */
  const addBarLoad = (b: TBar, e: RPointerEvent) => {
    const a = st.nodes.find((n) => n.id === b.a);
    const c = st.nodes.find((n) => n.id === b.b);
    if (!a || !c) return;
    const rect = svg.current!.getBoundingClientRect();
    const wx = (((e.clientX - rect.left) / rect.width) * W) / scale + minX;
    const wy = (H - ((e.clientY - rect.top) / rect.height) * H) / scale + minY;
    const L2 = (c.x - a.x) ** 2 + (c.y - a.y) ** 2;
    const u = L2 > 0 ? ((wx - a.x) * (c.x - a.x) + (wy - a.y) * (c.y - a.y)) / L2 : 0.5;
    const l: BarLoad = { id: newId('l'), bar: b.id, u: Math.min(0.95, Math.max(0.05, Math.round(u * 20) / 20)), Fx: 0, Fy: -10 };
    st.set({ barLoads: [...st.barLoads, l] });
    setSel({ kind: 'bar', id: b.id });
    setFdrag({ kind: 'bar', id: l.id });
  };
  /** point where a bar load acts */
  const loadPoint = (l: BarLoad) => {
    const b = st.bars.find((x) => x.id === l.bar);
    const a = b && st.nodes.find((n) => n.id === b.a);
    const c = b && st.nodes.find((n) => n.id === b.b);
    return a && c ? { x: a.x + l.u * (c.x - a.x), y: a.y + l.u * (c.y - a.y) } : null;
  };
  const maxU = Math.max(1e-12, ...[...r.u.values()].map((u) => Math.hypot(u.ux, u.uy)));
  const amp = deformed && r.ok ? (0.06 * (maxX - minX)) / maxU : 0;
  const pos = (n: TNode) => {
    const u = r.u.get(n.id);
    return { x: px(n.x + (u ? u.ux * amp : 0)), y: py(n.y + (u ? u.uy * amp : 0)) };
  };
  const maxF = Math.max(1e-9, ...st.nodes.map((n) => Math.hypot(n.Fx, n.Fy)), ...st.barLoads.map((l) => Math.hypot(l.Fx, l.Fy)), ...[...r.R.values()].map((v) => Math.hypot(v.Rx, v.Ry)));
  const arrowLen = (f: number) => 25 + (45 * Math.abs(f)) / maxF;

  const clickCanvas = (e: RPointerEvent) => {
    if (tool !== 'node' || (e.target as Element).closest('[data-node]')) return;
    const p = toWorld(e);
    const names = new Set(st.nodes.map((n) => n.name));
    let name = 'K1';
    for (let i = 1; names.has(name); i++) name = `K${i}`;
    const nn: TNode = { id: newId('n'), name, x: p.x, y: p.y, support: 'none', Fx: 0, Fy: 0 };
    st.set({ nodes: [...st.nodes, nn] });
    setSel({ kind: 'node', id: nn.id });
  };
  const clickNode = (id: string) => {
    if (tool === 'delete') {
      {
        const gone = new Set(st.bars.filter((b) => b.a === id || b.b === id).map((b) => b.id));
        st.set({ nodes: st.nodes.filter((n) => n.id !== id), bars: st.bars.filter((b) => !gone.has(b.id)), barLoads: st.barLoads.filter((l) => !gone.has(l.bar)) });
      }
      setSel(null);
    } else if (tool === 'bar') {
      if (!pending) setPending(id);
      else {
        if (pending !== id && !st.bars.some((b) => (b.a === pending && b.b === id) || (b.a === id && b.b === pending))) st.set({ bars: [...st.bars, { id: newId('b'), a: pending, b: id }] });
        setPending(null);
      }
    } else setSel({ kind: 'node', id });
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className={cn('h-auto max-h-[560px] w-full touch-none select-none', tool === 'node' && 'cursor-crosshair')}
      onPointerDown={clickCanvas}
      onPointerMove={(e) => {
        if (fdrag && tool === 'force') {
          if (fdrag.kind === 'node') {
            const n = st.nodes.find((x) => x.id === fdrag.id);
            if (n) st.set({ nodes: st.nodes.map((x) => (x.id === fdrag.id ? { ...x, ...forceFromDrag(n, e) } : x)) });
          } else {
            const l = st.barLoads.find((x) => x.id === fdrag.id);
            const at = l && loadPoint(l);
            if (l && at) st.set({ barLoads: st.barLoads.map((x) => (x.id === l.id ? { ...x, ...forceFromDrag(at, e) } : x)) });
          }
          return;
        }
        if (!drag || tool !== 'select') return;
        const p = toWorld(e);
        st.set({ nodes: st.nodes.map((n) => (n.id === drag ? { ...n, x: p.x, y: p.y } : n)) });
      }}
      onPointerUp={() => {
        setDrag(null);
        setFdrag(null);
      }}
      onPointerLeave={() => {
        setDrag(null);
        setFdrag(null);
      }}
      role="img"
      aria-label={t('Truss drawing')}
    >
      <defs>
        <marker id="tarrL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={MECH.load} />
        </marker>
        <marker id="tarrR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={MECH.reaction} />
        </marker>
      </defs>
      {/* grid */}
      {Array.from({ length: Math.ceil(maxX - minX) + 1 }, (_, i) => Math.ceil(minX) + i).map((x) => (
        <line key={`gx${x}`} x1={px(x)} y1={0} x2={px(x)} y2={H} stroke="rgba(148,163,184,0.06)" />
      ))}
      {Array.from({ length: Math.ceil(maxY - minY) + 1 }, (_, i) => Math.ceil(minY) + i).map((y) => (
        <line key={`gy${y}`} x1={0} y1={py(y)} x2={W} y2={py(y)} stroke="rgba(148,163,184,0.06)" />
      ))}
      {/* bars */}
      {st.bars.map((b) => {
        const a = st.nodes.find((n) => n.id === b.a);
        const c = st.nodes.find((n) => n.id === b.b);
        if (!a || !c) return null;
        const N = r.N.get(b.id);
        const isZero = zero.includes(b.id);
        const color = N === undefined || isZero ? 'rgb(var(--plant-500))' : N > 0 ? VIZ.equilibrium : VIZ.operating;
        const pa = pos(a);
        const pc = pos(c);
        const width = N === undefined || isZero ? 2 : 2 + (4 * Math.abs(N)) / Math.max(1e-9, ...[...r.N.values()].map(Math.abs));
        return (
          <g
            key={b.id}
            className="cursor-pointer"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (tool === 'delete') st.set({ bars: st.bars.filter((x) => x.id !== b.id), barLoads: st.barLoads.filter((l) => l.bar !== b.id) });
              else if (tool === 'force') {
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                addBarLoad(b, e);
              } else setSel({ kind: 'bar', id: b.id });
            }}
          >
            {deformed && <line x1={px(a.x)} y1={py(a.y)} x2={px(c.x)} y2={py(c.y)} stroke="rgb(var(--plant-600))" strokeDasharray="3 3" />}
            <line x1={pa.x} y1={pa.y} x2={pc.x} y2={pc.y} stroke="transparent" strokeWidth={14} />
            <line x1={pa.x} y1={pa.y} x2={pc.x} y2={pc.y} stroke={color} strokeWidth={width} strokeDasharray={isZero ? '6 4' : undefined} opacity={sel?.id === b.id ? 1 : 0.9} />
            {sel?.id === b.id && <line x1={pa.x} y1={pa.y} x2={pc.x} y2={pc.y} stroke="rgb(var(--white))" strokeWidth={1} strokeOpacity={0.6} />}
            {N !== undefined && (
              <text
                x={(pa.x + pc.x) / 2}
                y={(pa.y + pc.y) / 2 - 6}
                textAnchor="middle"
                className="text-[11px] font-semibold"
                style={{ fill: color, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}
              >
                {nf(N, 2)}
              </text>
            )}
          </g>
        );
      })}
      {/* forces on bars, drawn where they act */}
      {st.barLoads.map((l) => {
        const at = loadPoint(l);
        if (!at) return null;
        const F = Math.hypot(l.Fx, l.Fy);
        if (F === 0) return null;
        const x = px(at.x);
        const y = py(at.y);
        const len = arrowLen(F);
        return (
          <g key={l.id} pointerEvents="none">
            <circle cx={x} cy={y} r={3.5} fill={MECH.load} />
            <line x1={x - (l.Fx / F) * len} y1={y + (l.Fy / F) * len} x2={x} y2={y} stroke={MECH.load} strokeWidth={2.2} markerEnd="url(#tarrL)" />
            <text
              x={x - (l.Fx / F) * (len + 12)}
              y={y + (l.Fy / F) * (len + 12) + 4}
              textAnchor="middle"
              className="text-[11px] font-semibold"
              style={{ fill: MECH.load, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}
            >
              {nf(F, 3)} kN
            </text>
          </g>
        );
      })}
      {/* nodes, supports, loads, reactions */}
      {st.nodes.map((n) => {
        const p = pos(n);
        const h = held(n.support);
        const R = r.R.get(n.id);
        return (
          <g key={n.id} data-node>
            {n.support !== 'none' && (
              <g stroke={MECH.beam} strokeWidth={1.4} fill="rgb(var(--plant-950))">
                {n.support === 'rollerY' ? (
                  <>
                    <path d={`M${p.x},${p.y}L${p.x - 22},${p.y - 12}L${p.x - 22},${p.y + 12}Z`} />
                    <line x1={p.x - 28} y1={p.y - 16} x2={p.x - 28} y2={p.y + 16} />
                  </>
                ) : (
                  <>
                    <path d={`M${p.x},${p.y}L${p.x - 12},${p.y + 22}L${p.x + 12},${p.y + 22}Z`} />
                    <line x1={p.x - 16} y1={p.y + (h.x ? 22 : 28)} x2={p.x + 16} y2={p.y + (h.x ? 22 : 28)} />
                  </>
                )}
              </g>
            )}
            {(n.Fx !== 0 || n.Fy !== 0) && (
              <line
                x1={p.x - (n.Fx / Math.hypot(n.Fx, n.Fy)) * arrowLen(Math.hypot(n.Fx, n.Fy))}
                y1={p.y + (n.Fy / Math.hypot(n.Fx, n.Fy)) * arrowLen(Math.hypot(n.Fx, n.Fy))}
                x2={p.x}
                y2={p.y}
                stroke={MECH.load}
                strokeWidth={2.2}
                markerEnd="url(#tarrL)"
              />
            )}
            {(n.Fx !== 0 || n.Fy !== 0) && (
              <text
                x={p.x - (n.Fx / Math.hypot(n.Fx, n.Fy)) * (arrowLen(Math.hypot(n.Fx, n.Fy)) + 12)}
                y={p.y + (n.Fy / Math.hypot(n.Fx, n.Fy)) * (arrowLen(Math.hypot(n.Fx, n.Fy)) + 12) + 4}
                textAnchor="middle"
                pointerEvents="none"
                className="text-[11px] font-semibold"
                style={{ fill: MECH.load, paintOrder: 'stroke', stroke: 'rgb(var(--plant-950))', strokeWidth: 3 }}
              >
                {nf(Math.hypot(n.Fx, n.Fy), 3)} kN
              </text>
            )}
            {R && r.ok && (
              <>
                {Math.abs(R.Rx) > 1e-9 && (
                  <line
                    x1={p.x - Math.sign(R.Rx) * arrowLen(R.Rx) - Math.sign(R.Rx) * 8}
                    y1={p.y + 34}
                    x2={p.x - Math.sign(R.Rx) * 8}
                    y2={p.y + 34}
                    stroke={MECH.reaction}
                    strokeWidth={2}
                    markerEnd="url(#tarrR)"
                  />
                )}
                {Math.abs(R.Ry) > 1e-9 && (
                  <line x1={p.x + 22} y1={p.y + 28 + Math.sign(R.Ry) * arrowLen(R.Ry)} x2={p.x + 22} y2={p.y + 28} stroke={MECH.reaction} strokeWidth={2} markerEnd="url(#tarrR)" />
                )}
              </>
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={7}
              fill={pending === n.id ? 'rgb(var(--sig-heat))' : 'rgb(var(--plant-900))'}
              stroke={sel?.id === n.id ? 'rgb(var(--sig-heat))' : MECH.beam}
              strokeWidth={2}
              className={tool === 'select' ? 'cursor-move' : 'cursor-pointer'}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture?.(e.pointerId);
                if (tool === 'select') setDrag(n.id);
                if (tool === 'force') {
                  setSel({ kind: 'node', id: n.id });
                  if (n.Fx === 0 && n.Fy === 0) st.set({ nodes: st.nodes.map((x) => (x.id === n.id ? { ...x, Fy: -10 } : x)) });
                  setFdrag({ kind: 'node', id: n.id });
                  return;
                }
                clickNode(n.id);
              }}
            />
            <text x={p.x + 10} y={p.y - 10} className="text-[12px] font-semibold" style={{ fill: 'rgb(var(--plant-100))' }}>
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function NodeEquations({ r, eqNodes, focus }: { r: ReturnType<typeof solveTruss>; eqNodes: TNode[]; focus?: string }) {
  const st = useTruss();
  const n = (v: number) => (nf(v, 3).startsWith('-') ? `(${nf(v, 3)})` : nf(v, 3)).replace(',', '{,}');
  const list = focus ? eqNodes.filter((x) => x.id === focus) : eqNodes.slice(0, 4);
  return (
    <Card title="Method of joints (solution path)">
      <p className="mb-1 text-[10px] text-plant-500">{t('Cut free each node: bar forces S act along the bars (tension positive, pointing away from the node). Click a node to see its equations.')}</p>
      <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
        {list.map((node) => {
          const conn = st.bars.filter((b) => b.a === node.id || b.b === node.id);
          const R = r.R.get(node.id);
          const tx: string[] = [];
          const ty: string[] = [];
          for (const b of conn) {
            const g = geometry({ nodes: st.nodes, bars: st.bars, EA: st.EA }, b);
            const dir = b.a === node.id ? 1 : -1;
            const other = nameOf(st.nodes, b.a === node.id ? b.b : b.a);
            const S = `S_{${node.name}${other}}`;
            if (Math.abs(g.c) > 1e-9) tx.push(`${n(g.c * dir)}\\,${S}`);
            if (Math.abs(g.s) > 1e-9) ty.push(`${n(g.s * dir)}\\,${S}`);
          }
          if (node.Fx) tx.push(n(node.Fx));
          if (node.Fy) ty.push(n(node.Fy));
          if (R && held(node.support).x) tx.push(`R_{${node.name},x}`);
          if (R && held(node.support).y) ty.push(`R_{${node.name},y}`);
          const vals = conn.map((b) => `S_{${node.name}${nameOf(st.nodes, b.a === node.id ? b.b : b.a)}} = ${n(r.N.get(b.id) ?? 0)}`);
          if (R && held(node.support).x) vals.push(`R_{${node.name},x} = ${n(R.Rx)}`);
          if (R && held(node.support).y) vals.push(`R_{${node.name},y} = ${n(R.Ry)}`);
          return (
            <div key={node.id} className="min-w-0 py-1">
              <p className="text-[11px] text-plant-400">
                {t('Node')} {node.name}
              </p>
              <Tex block math={`\\textstyle\\sum F_x = ${tx.join(' + ') || '0'} = 0`} />
              <Tex block math={`\\textstyle\\sum F_y = ${ty.join(' + ') || '0'} = 0`} />
              <div className="text-signal-heat">
                <Tex block math={`\\Rightarrow ${vals.join(',\\ ')}\\ \\mathrm{kN}`} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
