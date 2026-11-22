import { AlertTriangle, CheckCircle2, Gauge, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COMPONENTS } from '@/engine/components';
import { cn, fmt, kToC } from '@/lib/utils';
import { useFlowsheet, type UnitNode } from '@/store/flowsheetStore';
import { buildMcCabeThiele, buildStageTable, buildTxy } from './chartData';
import { McCabeThieleChart, McCabeThieleLegend } from './McCabeThieleChart';
import { TxyChart, TxyLegend, type TxyMarker } from './TxyChart';

function refluxBadge(ratio: number) {
  // heuristic: optimum reflux typically 1.2–1.5 × Rmin
  if (ratio < 1.1) return { color: 'amber', label: 'Near pinch', Icon: AlertTriangle } as const;
  if (ratio <= 1.5) return { color: 'emerald', label: 'Near optimum (1.1–1.5)', Icon: CheckCircle2 } as const;
  return { color: 'slate', label: 'Above optimum (> 1.5)', Icon: Gauge } as const;
}

const BADGE = { amber: 'bg-signal-heat/15 text-signal-heat', emerald: 'bg-signal-ok/15 text-signal-ok', slate: 'bg-white/[0.06] text-plant-300' } as const;

function Kpi({ title, value, unit, children }: { title: string; value: string; unit?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-plant-950/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-plant-400">{title}</p>
      <p className="readout mt-0.5 text-xl text-plant-100">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-plant-400">{unit}</span>}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-signal-liquid" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

const Small = ({ children }: { children: React.ReactNode }) => <p className="readout mt-1 text-[10px] text-plant-400">{children}</p>;

export default function ColumnAnalysisPanel({ node, onClose }: { node: UnitNode; onClose: () => void }) {
  const c = node.data.column;
  const D = node.data.state.topProduct;
  const B = node.data.state.bottomProduct;
  const feedEdge = useFlowsheet((s) => s.edges.find((e) => e.target === node.id));
  const P = D?.pressure ?? 101.325;

  const mt = useMemo(() => (c ? buildMcCabeThiele(c) : null), [c]);
  const system = useFlowsheet((st) => st.system);
  const txy = useMemo(() => buildTxy(system, P), [system, P]);
  const stages = useMemo(() => (c ? buildStageTable(c, system, P) : []), [c, system, P]);

  const sys = `${COMPONENTS[system.A].name} / ${COMPONENTS[system.B].name}`;
  const { refluxRatio: R, theoreticalStages: N, condenserType = 'total' } = node.data.params;
  const [tab, setTab] = useState(0);

  return (
    <section
      aria-label={`${node.data.tag} McCabe–Thiele analysis`}
      className="glass flex h-[44%] min-h-[260px] shrink-0 flex-col overflow-hidden duration-200 animate-in fade-in slide-in-from-bottom-4"
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] px-4 py-2">
        <div>
          <p className="tag text-signal-liquid">{node.data.tag} · Rectification analysis</p>
          <p className="mt-0.5 font-mono text-[10px] text-plant-400">
            {sys} · {fmt(P, 1)} kPa · {N} stages + {condenserType} condenser
            {c && <> · α = {fmt(c.alpha, 3)}</>}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close analysis panel" className="rounded p-1 text-plant-400 transition-colors hover:bg-white/5 hover:text-plant-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      {!c || !mt || !D || !B ? (
        <div className="p-4 text-[11px] leading-relaxed text-plant-400">
          <p className="tag mb-1 text-plant-500">No solution</p>
          {node.data.diag?.messages.map((m) => <p key={m}>{m}</p>) ?? <p>Connect a feed stream to the column.</p>}
        </div>
      ) : (
        <div className="grid flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <div className="grid grid-cols-2 content-start gap-2">
            <Kpi title={`Distillate purity · ${COMPONENTS[system.A].name}`} value={fmt(c.xD * 100, 2)} unit="mol %">
              <Bar value={c.xD * 100} />
              <Small>
                D = {fmt(c.D, 1)} kmol/h · {fmt(kToC(D.temperature), 1)} °C
              </Small>
            </Kpi>
            <Kpi title={`Bottoms purity · ${COMPONENTS[system.B].name}`} value={fmt((1 - c.xB) * 100, 2)} unit="mol %">
              <Bar value={(1 - c.xB) * 100} />
              <Small>
                B = {fmt(c.B, 1)} kmol/h · {fmt(kToC(B.temperature), 1)} °C · x<sub>B</sub> = {fmt(c.xB, 4)}
              </Small>
            </Kpi>
            <Kpi title="Reflux / minimum" value={fmt(R / c.Rmin, 2)} unit="× Rmin">
              {(() => {
                const b = refluxBadge(R / c.Rmin);
                return (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]', BADGE[b.color])}>
                    <b.Icon className="h-3 w-3" />
                    {b.label}
                  </span>
                );
              })()}
              <Small>
                R = {fmt(R, 2)} · Rmin = {fmt(c.Rmin, 3)} · Nmin = {fmt(c.Nmin, 2)}
              </Small>
            </Kpi>
            <Kpi title="Reboiler duty" value={fmt(c.Qr, 0)} unit="kW">
              <Small>Condenser Qc = {fmt(c.Qc, 0)} kW</Small>
              <Small>
                Feed stage {c.feedStage} of {N} · q = {fmt(c.q, 3)}
              </Small>
            </Kpi>
          </div>

          <div className="min-w-0">
            <div role="tablist" className="flex gap-1 border-b border-white/[0.06]">
              {['McCabe–Thiele', 'T–x–y', 'Stage table'].map((l, k) => (
                <button
                  key={l}
                  role="tab"
                  type="button"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={cn('-mb-px border-b-2 px-3 py-1.5 text-[11px]', tab === k ? 'border-signal-liquid text-signal-liquid' : 'border-transparent text-plant-400 hover:text-plant-200')}
                >
                  {l}
                </button>
              ))}
            </div>
            {tab === 0 && (
              <div className="mt-3 space-y-2">
                <McCabeThieleLegend real={!!c.curve} />
                <div className="mx-auto max-w-[420px]">
                  <McCabeThieleChart s={mt} />
                </div>
                <p className="text-[10px] leading-relaxed text-plant-500">
                  Steps drawn from x<sub>D</sub> down to x<sub>B</sub>; hover a stage corner for its compositions.
                  {condenserType === 'partial' && ' The first step is the partial condenser (an equilibrium stage).'}{' '}
                  {c.curve ? 'CMO assumed; stages stepped on the real equilibrium curve.' : 'CMO and constant α assumed.'}
                </p>
              </div>
            )}
            {tab === 1 && (
              <div className="mt-3 space-y-2">
                <TxyLegend />
                <div className="mx-auto max-w-[460px]">
                  <TxyChart
                    rows={txy}
                    markers={
                      [
                        { label: 'D', x: c.xD, T: kToC(D.temperature) },
                        { label: 'B', x: c.xB, T: kToC(B.temperature) },
                        feedEdge?.data?.resolved ? { label: 'F', x: feedEdge.data.molarFractions.compA, T: kToC(feedEdge.data.temperature) } : null,
                      ].filter(Boolean) as TxyMarker[]
                    }
                  />
                </div>
                <p className="text-[10px] leading-relaxed text-plant-500">Rigorous Raoult&apos;s-law envelope at {fmt(P, 1)} kPa. Between the lines the mixture is two-phase.</p>
              </div>
            )}
            {tab === 2 && (
              <div className="mt-3">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['Stage', 'Role', 'x', 'y', 'T [°C]'].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-plant-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {stages.map((r) => (
                      <tr key={r.stage} className={r.stage === c.feedStage ? 'bg-signal-liquid/[0.06]' : ''}>
                        <td className="readout px-2 py-1 text-[11px] text-plant-200">{r.stage}</td>
                        <td className="px-2 py-1 text-[11px] text-plant-300">{r.section}</td>
                        <td className="readout px-2 py-1 text-right text-[11px] text-plant-100">{fmt(r.x, 4)}</td>
                        <td className="readout px-2 py-1 text-right text-[11px] text-plant-100">{fmt(r.y, 4)}</td>
                        <td className="readout px-2 py-1 text-right text-[11px] text-plant-100">{fmt(r.T, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
