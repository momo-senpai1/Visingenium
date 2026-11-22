import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, newId, nf, Num, NumRow, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { colebrook, solvePipe, velocityProfile, type FluidId, type PipeResult, type Regime, type Segment } from '@/engine/fluid/pipe';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface S {
  fluid: FluidId;
  T: number;
  Q: number;
  pIn: number;
  k: number;
  segments: Segment[];
  sel: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const seg = (L: number, d: number, inlet: Segment['inlet'] = 'sudden', dz = 0, zeta = 0): Segment => ({ id: newId('s'), L, d, dz, zeta, inlet });
const PRESETS: Record<string, { label: string; v: Partial<S> }> = {
  venturi: { label: 'Venturi tube (try Q ≈ 6 L/s: cavitation)', v: { fluid: 'water', T: 20, Q: 3, pIn: 1.5, k: 0.01, segments: [seg(1, 50), seg(0.15, 20, 'smooth'), seg(1.5, 50, 'smooth')], sel: 1 } },
  orifice: { label: 'Sudden contraction and expansion', v: { fluid: 'water', T: 20, Q: 2, pIn: 2, k: 0.05, segments: [seg(2, 50), seg(0.5, 25), seg(2, 50)], sel: 1 } },
  laminar: { label: 'Oil line (laminar ↔ turbulent)', v: { fluid: 'oil', T: 40, Q: 0.5, pIn: 5, k: 0.02, segments: [seg(20, 25)], sel: 0 } },
  riser: { label: 'Water supply with height difference', v: { fluid: 'water', T: 15, Q: 1.2, pIn: 4, k: 0.1, segments: [seg(30, 40, 'sudden', 0, 1.5), seg(12, 32, 'sudden', 10, 0.9), seg(15, 25, 'sudden', 0, 2)], sel: 0 } },
};
const usePipe = create<S>()(
  persist((set) => ({ ...(PRESETS.venturi!.v as Omit<S, 'set'>), set: (p) => set(p) }), { name: 'ts-fluid-pipe', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, ...r }) => r }),
);

const REG_COLOR: Record<Regime, string> = { laminar: 'rgb(var(--sig-liquid))', transitional: 'rgb(var(--sig-heat))', turbulent: 'rgb(var(--sig-vapor))' };

export default function PipePage() {
  const s = usePipe();
  const r = useMemo(() => solvePipe(s), [s]);
  const sel = Math.min(s.sel, s.segments.length - 1);
  const sr = r.segs[sel];
  const upd = (i: number, g: Segment | null) => {
    const a = [...s.segments];
    if (g) a[i] = g;
    else a.splice(i, 1);
    s.set({ segments: a.length ? a : [seg(1, 50)], sel: Math.min(s.sel, Math.max(0, a.length - 1)) });
  };
  const logQ = Math.log10(Math.max(s.Q, 1e-3));
  return (
    <div className="grid gap-2 xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Flow">
          <select aria-label={t('Examples')} className={fieldCls} value="" onChange={(e) => e.target.value && s.set({ ...PRESETS[e.target.value]!.v, segments: PRESETS[e.target.value]!.v.segments!.map((g) => ({ ...g, id: newId('s') })) })}>
            <option value="">{t('Load an example…')}</option>
            {Object.entries(PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {t(p.label)}
              </option>
            ))}
          </select>
          <div className="mt-2 space-y-1.5">
            <label className="block text-[11px] text-plant-300">
              {t('Volume flow Q')}: <span className="font-mono text-plant-100">{nf(s.Q, 4)} L/s</span>
              <input aria-label={t('Volume flow Q')} type="range" min={-3} max={2} step={0.01} value={logQ} onChange={(e) => s.set({ Q: Number((10 ** Number(e.target.value)).toPrecision(3)) })} className="mt-1 w-full accent-[rgb(var(--sig-liquid))]" />
            </label>
            <NumRow label={t('Volume flow Q')} unit="L/s" value={s.Q} onChange={(v) => s.set({ Q: Math.max(1e-4, v) })} />
            <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-[11px] text-plant-300">
              {t('Fluid')}
              <select className={fieldCls} value={s.fluid} onChange={(e) => s.set({ fluid: e.target.value as FluidId })}>
                <option value="water">{t('Water')}</option>
                <option value="air">{t('Air')}</option>
                <option value="oil">{t('Oil (ISO VG 46)')}</option>
              </select>
            </label>
            <NumRow label={t('Temperature T')} unit="°C" value={s.T} onChange={(v) => s.set({ T: v })} />
            <NumRow label={t('Inlet pressure (absolute)')} unit="bar" value={s.pIn} onChange={(v) => s.set({ pIn: Math.max(0.01, v) })} />
            <NumRow label={t('Wall roughness k')} unit="mm" value={s.k} onChange={(v) => s.set({ k: Math.max(0, v) })} />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-plant-500">
            ρ = {nf(r.fluid.rho, 2)} kg/m³ · η = {nf(r.fluid.mu * 1000, 4)} mPa·s{r.fluid.pv > 0 ? ` · p_v = ${nf(r.fluid.pv / 1000, 3)} kPa` : ''}
          </p>
        </Card>
        <Card title="Pipe segments">
          <div className="space-y-1.5">
            {s.segments.map((g, i) => (
              <div key={g.id} className={cn('space-y-1 rounded border p-1.5', i === sel ? 'border-signal-liquid/40' : 'border-white/[0.06]')} onClick={() => s.set({ sel: i })}>
                <div className="flex items-center gap-1 text-[10px] text-plant-400">
                  <span className="font-mono text-plant-200">#{i + 1}</span>
                  {i > 0 && (
                    <select aria-label={t('Transition')} className={cn(fieldCls, 'w-auto')} value={g.inlet} onChange={(e) => upd(i, { ...g, inlet: e.target.value as Segment['inlet'] })}>
                      <option value="sudden">{t('sudden change')}</option>
                      <option value="smooth">{t('smooth (nozzle/diffuser)')}</option>
                    </select>
                  )}
                  <span className="flex-1" />
                  <button type="button" aria-label={t('Delete')} onClick={() => upd(i, null)} className="text-plant-500 hover:text-signal-alarm">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[9px] uppercase tracking-wider text-plant-500">
                  <label>
                    L [m]
                    <Num ariaLabel="L" value={g.L} onChange={(v) => upd(i, { ...g, L: Math.max(1e-4, v) })} />
                  </label>
                  <label>
                    d [mm]
                    <Num ariaLabel="d" value={g.d} onChange={(v) => upd(i, { ...g, d: Math.max(0.5, v) })} />
                  </label>
                  <label>
                    Δz [m]
                    <Num ariaLabel="dz" value={g.dz} onChange={(v) => upd(i, { ...g, dz: v })} />
                  </label>
                  <label>
                    Σζ
                    <Num ariaLabel="zeta" value={g.zeta} onChange={(v) => upd(i, { ...g, zeta: Math.max(0, v) })} />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => s.set({ segments: [...s.segments, seg(1, s.segments.at(-1)?.d ?? 50)] })} className="flex items-center gap-1 text-[11px] text-signal-heat hover:underline">
              <Plus className="h-3 w-3" /> {t('Add segment')}
            </button>
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
          <Kpi label={t('Pressure loss Δp_V')} value={nf(r.dpLoss / 1e5, 4)} unit="bar" />
          <Kpi label={t('Outlet pressure')} value={nf(r.pOut / 1e5, 4)} unit="bar" />
          <Kpi label={t('Minimum static pressure')} value={nf(r.pMin.p / 1e5, 4)} unit="bar" sub={`x = ${nf(r.pMin.x, 3)} m`} />
          <Kpi label={t('Power loss')} value={nf(r.powerLoss, 2)} unit="W" sub="P = Q · Δp_V" />
          <Kpi label={`Re (#${sel + 1})`} value={sr ? nf(sr.Re, 0) : '–'} sub={sr ? t(sr.regime) : ''} />
          <Kpi label={`w (#${sel + 1})`} value={sr ? nf(sr.w, 3) : '–'} unit="m/s" />
        </div>
        {r.cavitation && <Notice tone="error">{t('Cavitation: the static pressure falls below the vapour pressure ({pv} kPa) at x = {x} m. Vapour bubbles form and implode further downstream (noise, erosion). Lower the flow, widen the constriction or raise the pressure.', { pv: nf(r.fluid.pv / 1000, 2), x: nf(r.pMin.x, 3) })}</Notice>}
        {r.pOut < 0 && <Notice tone="error">{t('The outlet pressure would be negative: the inlet pressure cannot drive this flow.')}</Notice>}
        <Card title="Pipe (colour: static pressure, flow animated)">
          <PipeView r={r} segs={s.segments} sel={sel} onSel={(i) => s.set({ sel: i })} />
        </Card>
        <div className="grid gap-2 2xl:grid-cols-2">
          <Card title="Pressure along the pipe (extended Bernoulli)">
            <LineChartBox
              series={[
                { name: t('static pressure p'), data: r.profile.map((q) => ({ x: q.x, y: q.p / 1e5 })), color: 'rgb(var(--sig-liquid))' },
                { name: t('total pressure p + ρw²/2 + ρgz (energy line)'), data: r.profile.map((q) => ({ x: q.x, y: q.pt / 1e5 })), color: 'rgb(var(--sig-heat))', dashed: true },
                ...(r.fluid.pv > 0 ? [{ name: t('vapour pressure p_v'), data: [{ x: 0, y: r.fluid.pv / 1e5 }, { x: r.profile.at(-1)?.x ?? 1, y: r.fluid.pv / 1e5 }], color: 'rgb(var(--sig-alarm))', dashed: true }] : []),
              ]}
              xLabel="x [m]"
              yLabel="p [bar]"
              height={240}
              digits={3}
            />
            <div className="mt-1 text-[12px] text-plant-100">
              <Tex block math="p_1 + \frac{\rho}{2} w_1^2 + \rho g z_1 = p_2 + \frac{\rho}{2} w_2^2 + \rho g z_2 + \Delta p_V,\quad \Delta p_V = \left(\lambda \frac{L}{d} + \sum\zeta\right)\frac{\rho}{2} w^2" />
            </div>
          </Card>
          <Card title={`${t('Velocity profile')} #${sel + 1}`}>{sr && <ProfileView regime={sr.regime} Re={sr.Re} w={sr.w} />}</Card>
        </div>
        <div className="grid gap-2 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card title="Segments">
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-right text-[10px] uppercase tracking-wider text-plant-500">
                    <th className="py-1 pr-2 text-left">#</th>
                    <th className="pr-2">w [m/s]</th>
                    <th className="pr-2">Re</th>
                    <th className="pr-2">{t('Regime')}</th>
                    <th className="pr-2">λ</th>
                    <th className="pr-2">Δp_λ [mbar]</th>
                    <th className="pr-2">Δp_trans [mbar]</th>
                    <th>Δp_ζ [mbar]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-right text-plant-100">
                  {r.segs.map((g, i) => (
                    <tr key={g.id} className={cn('cursor-pointer', i === sel && 'bg-signal-liquid/[0.06]')} onClick={() => s.set({ sel: i })}>
                      <td className="py-1 pr-2 text-left">{i + 1}</td>
                      <td className="pr-2">{nf(g.w, 3)}</td>
                      <td className="pr-2">{nf(g.Re, 0)}</td>
                      <td className="pr-2 font-sans" style={{ color: REG_COLOR[g.regime] }}>
                        {t(g.regime)}
                      </td>
                      <td className="pr-2">{nf(g.lambda, 5)}</td>
                      <td className="pr-2">{nf(g.dpF / 100, 2)}</td>
                      <td className="pr-2">{nf(g.dpIn / 100, 2)}</td>
                      <td>{nf(g.dpZ / 100, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[10px] text-plant-500">{t('Laminar below Re = 2300 (λ = 64/Re), turbulent above ≈ 4000 (Colebrook–White); in between the flow switches unpredictably. Transitions: Borda–Carnot loss for expansions, ζ ≈ 0.5(1 − A₂/A₁)^0.75 for sudden contractions.')}</p>
          </Card>
          <Card title="Moody diagram">
            <Moody r={r} segs={s.segments} k={s.k} />
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Pipe drawing: diameter to scale (vertical), colour = static pressure, moving dashes = flow. */
function PipeView({ r, segs, sel, onSel }: { r: PipeResult; segs: Segment[]; sel: number; onSel: (i: number) => void }) {
  const W = 900;
  const H = 170;
  const Ltot = segs.reduce((a, g) => a + g.L, 0);
  // equal visual weight per segment (long and short segments both visible), plus length proportion
  const widths = segs.map((g) => 0.5 / segs.length + (0.5 * g.L) / Ltot);
  const dMax = Math.max(...segs.map((g) => g.d));
  const ps = r.profile.map((q) => q.p);
  const pLo = Math.min(...ps);
  const pHi = Math.max(...ps);
  const color = (p: number) => {
    if (r.fluid.pv > 0 && p < r.fluid.pv) return 'rgb(var(--sig-alarm))';
    const f = pHi > pLo ? (p - pLo) / (pHi - pLo) : 0.5;
    return `hsl(${220 - 200 * f} 70% ${45 + 10 * f}%)`;
  };
  let x0 = 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Pipe')}>
      <style>{'@keyframes pe-flow { to { stroke-dashoffset: -40; } }'}</style>
      {segs.map((g, i) => {
        const w = (W - 40) * widths[i]!;
        const h = 20 + (100 * g.d) / dMax;
        const y = H / 2 - h / 2;
        const sr = r.segs[i]!;
        const pts = r.profile.filter((q) => q.seg === i);
        const pMid = pts[Math.floor(pts.length / 2)]?.p ?? pLo;
        const dur = Math.max(0.15, Math.min(8, 2 / Math.max(sr.w, 1e-3)));
        const xs = x0;
        x0 += w;
        const cav = r.fluid.pv > 0 && Math.min(...pts.map((q) => q.p)) < r.fluid.pv;
        return (
          <g key={g.id} onClick={() => onSel(i)} className="cursor-pointer">
            <rect x={xs} y={y} width={w} height={h} fill={color(pMid)} fillOpacity={0.35} stroke={i === sel ? 'rgb(var(--sig-liquid))' : 'rgb(var(--plant-300))'} strokeWidth={i === sel ? 2 : 1} />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={xs + 4} x2={xs + w - 4} y1={y + h * f} y2={y + h * f} stroke="rgb(var(--plant-100))" strokeOpacity={0.7} strokeWidth={1.4} strokeDasharray="6 14" style={{ animation: `pe-flow ${dur}s linear infinite` }} />
            ))}
            {cav &&
              [0.2, 0.45, 0.7].map((f, k) => <circle key={k} cx={xs + w * f} cy={y + h * (0.3 + 0.2 * k)} r={3 + k} fill="none" stroke="rgb(var(--sig-alarm))" />)}
            <text x={xs + w / 2} y={y - 6} textAnchor="middle" className="fill-plant-300 font-mono text-[10px]">
              #{i + 1} · d = {nf(g.d, 3)} mm
            </text>
            <text x={xs + w / 2} y={y + h + 14} textAnchor="middle" className="font-mono text-[10px]" style={{ fill: REG_COLOR[sr.regime] }}>
              {nf(sr.w, 2)} m/s · Re {nf(sr.Re, 0)}
            </text>
          </g>
        );
      })}
      <text x={6} y={H / 2 + 4} className="fill-plant-400 text-[16px]">
        →
      </text>
    </svg>
  );
}

/** Velocity profile across the pipe: the current regime solid, the other one dashed for comparison. */
function ProfileView({ regime, Re, w }: { regime: Regime; Re: number; w: number }) {
  const W = 420;
  const H = 230;
  const umax = 2.05;
  const pts = (reg: Regime) =>
    Array.from({ length: 81 }, (_, i) => {
      const r = -1 + (2 * i) / 80;
      return `${40 + (velocityProfile(reg, Re, r) / umax) * (W - 80)},${H / 2 + r * (H / 2 - 20)}`;
    }).join(' ');
  const other: Regime = regime === 'laminar' ? 'turbulent' : 'laminar';
  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Velocity profile')}>
        <line x1={40} y1={20} x2={W - 20} y2={20} stroke="rgb(var(--plant-300))" strokeWidth={2} />
        <line x1={40} y1={H - 20} x2={W - 20} y2={H - 20} stroke="rgb(var(--plant-300))" strokeWidth={2} />
        <line x1={40} y1={20} x2={40} y2={H - 20} stroke="rgb(var(--plant-500))" />
        {Array.from({ length: 13 }, (_, i) => {
          const r = -1 + (2 * (i + 0.5)) / 13;
          const u = velocityProfile(regime, Re, r);
          const y = H / 2 + r * (H / 2 - 20);
          return <line key={i} x1={40} y1={y} x2={40 + (u / umax) * (W - 80)} y2={y} stroke={REG_COLOR[regime]} strokeOpacity={0.6} markerEnd="url(#pe-arr)" />;
        })}
        <defs>
          <marker id="pe-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="rgb(var(--plant-300))" />
          </marker>
        </defs>
        <polyline points={pts(other)} fill="none" stroke="rgb(var(--plant-500))" strokeDasharray="4 3" />
        <polyline points={pts(regime)} fill="none" stroke={REG_COLOR[regime]} strokeWidth={2.4} />
        <line x1={40 + (1 / umax) * (W - 80)} y1={20} x2={40 + (1 / umax) * (W - 80)} y2={H - 20} stroke="rgb(var(--sig-heat))" strokeDasharray="2 3" />
        <text x={44 + (1 / umax) * (W - 80)} y={32} className="fill-plant-300 text-[9px]">
          w̄
        </text>
      </svg>
      <p className="text-[11px] text-plant-300">
        <span className="font-semibold" style={{ color: REG_COLOR[regime] }}>
          {t(regime)}
        </span>{' '}
        · Re = {nf(Re, 0)} · w̄ = {nf(w, 3)} m/s · u_max = {nf(velocityProfile(regime, Re, 0) * w, 3)} m/s
      </p>
      <p className="text-[10px] text-plant-500">
        {regime === 'laminar'
          ? t('Laminar (Hagen–Poiseuille): parabola, u_max = 2 w̄. Increase Q until Re > 2300 to see the profile flatten.')
          : t('Turbulent: flat power-law profile u ~ (1 − r/R)^(1/n) with n ≈ 6…10; strong mixing makes the core almost uniform. The dashed line is the laminar parabola for comparison.')}
      </p>
    </div>
  );
}

function Moody({ r, segs, k }: { r: PipeResult; segs: Segment[]; k: number }) {
  const [rels] = useState([0, 1e-4, 1e-3, 5e-3, 0.02, 0.05]);
  const series = useMemo(() => {
    const out = [{ name: '64/Re', data: Array.from({ length: 20 }, (_, i) => ({ x: 500 * (2300 / 500) ** (i / 19), y: 64 / (500 * (2300 / 500) ** (i / 19)) })), color: 'rgb(var(--sig-liquid))' }];
    rels.forEach((rel, j) =>
      out.push({
        name: rel === 0 ? t('smooth') : `k/d = ${rel}`,
        data: Array.from({ length: 40 }, (_, i) => {
          const Re = 4000 * (1e8 / 4000) ** (i / 39);
          return { x: Re, y: colebrook(Re, rel) };
        }),
        color: `rgb(var(--plant-${[300, 400, 400, 500, 500, 500][j]}))`,
      }),
    );
    return out;
  }, [rels]);
  const ops = r.segs.map((g, i) => ({
    name: `#${i + 1} (k/d = ${nf(k / segs[i]!.d, 5)})`,
    data: [
      { x: g.Re * 0.93, y: g.lambda },
      { x: g.Re * 1.07, y: g.lambda },
    ],
    color: 'rgb(var(--sig-alarm))',
  }));
  return <LineChartBox series={[...series, ...ops]} xLabel="Re" yLabel="λ" logX logY height={260} digits={3} />;
}
