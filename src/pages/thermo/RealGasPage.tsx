import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow, safeStorage } from '@/components/mechanics/common';
import { StateDiagram, type Line } from '@/components/thermo/StateDiagram';
import { Kpi, Notice } from '@/components/workbench/controls';
import { departure, EOS_LABEL, maxwellCheck, pressure, RB, stableZ, SUBSTANCES, temperaturePV, vaporPressure, type EOS } from '@/engine/thermo/realgas';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface S {
  sub: string;
  eos: EOS;
  T: number;
  p: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useRG = create<S>()(
  persist((set) => ({ sub: 'co2', eos: 'pr', T: 290, p: 50, set: (p) => set(p) }), { name: 'ts-thermo-realgas', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, ...r }) => r }),
);
const ALL_EOS: EOS[] = ['ideal', 'vdw', 'rk', 'pr'];
const TR = [0.75, 0.85, 0.95, 1, 1.1, 1.3, 1.6];

export default function RealGasPage() {
  const st = useRG();
  const s = SUBSTANCES.find((x) => x.id === st.sub) ?? SUBSTANCES[0]!;
  const T = Math.max(st.T, s.Tc * 0.3);
  const p = Math.max(st.p, 1e-3);
  const eos = st.eos;
  const rows = ALL_EOS.map((e) => {
    const z = stableZ(e, s, T, p);
    const v = (z.Z * RB * T) / p; // m³/kmol
    const dep = departure(e, s, T, p, z.Z);
    return { e, ...z, v, rho: s.M / v, dep };
  });
  const cur = rows.find((r) => r.e === eos)!;
  const sat = eos !== 'ideal' && T < s.Tc ? vaporPressure(eos, s, T) : null;

  // ---- p,v diagram
  const b = (0.0778 * RB * s.Tc) / s.pc;
  const vMin = b * 1.15;
  const vMax = (RB * s.Tc * 2.2) / (s.pc * 0.05);
  const isotherm = (TT: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 300; i++) {
      const v = vMin * (vMax / vMin) ** (i / 300);
      pts.push({ x: v, y: pressure(eos, s, TT, v) });
    }
    return pts;
  };
  const dome = useMemo(() => {
    if (eos === 'ideal') return null;
    const L: { x: number; y: number }[] = [];
    const V: { x: number; y: number }[] = [];
    for (let i = 0; i <= 50; i++) {
      const TT = s.Tc * (0.55 + 0.4499 * (1 - (1 - i / 50) ** 2));
      const r = vaporPressure(eos, s, TT);
      if (r) {
        L.push({ x: r.vL, y: r.p });
        V.push({ x: r.vV, y: r.p });
      }
    }
    return [...L, ...V.reverse()];
  }, [eos, s]);
  const lines: Line[] = [];
  if (dome) lines.push({ pts: dome, color: 'rgb(var(--plant-300))', width: 1.4 });
  for (const tr of TR) lines.push({ pts: isotherm(tr * s.Tc), color: tr === 1 ? 'rgb(var(--sig-heat)/0.8)' : 'rgb(var(--plant-500)/0.6)', dashed: tr !== 1, label: `T_r = ${tr}` });
  const curIso = isotherm(T);
  const paths: Line[] = [{ pts: curIso, color: 'rgb(var(--sig-liquid))', width: 2 }];
  if (sat) {
    // equal areas between the isotherm and the Maxwell line
    const lobe = curIso.filter((q) => q.x >= sat.vL && q.x <= sat.vV);
    lines.push({ pts: [{ x: sat.vL, y: sat.p }, ...lobe, { x: sat.vV, y: sat.p }], color: '', fill: 'rgb(var(--sig-vapor)/0.25)' });
    paths.push({ pts: [{ x: sat.vL, y: sat.p }, { x: sat.vV, y: sat.p }], color: 'rgb(var(--sig-vapor))', width: 2 });
  }
  const pMax = s.pc * 2.2;

  // ---- Z chart
  const zChart = useMemo(
    () =>
      [1, 1.1, 1.2, 1.5, 2, 3].map((tr, k) => ({
        name: `T_r = ${tr}`,
        data: Array.from({ length: 80 }, (_, i) => {
          const pr = 0.05 + (10 * i) / 79;
          return { x: pr, y: stableZ(eos === 'ideal' ? 'pr' : eos, s, tr * s.Tc, pr * s.pc).Z };
        }),
        color: ['rgb(var(--sig-alarm))', 'rgb(var(--sig-heat))', 'rgb(var(--sig-vapor))', 'rgb(var(--sig-liquid))', 'rgb(var(--plant-300))', 'rgb(var(--plant-500))'][k],
      })),
    [eos, s],
  );
  const mx = maxwellCheck(eos, s, T, cur.v);

  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Substance and model">
          <div className="space-y-1.5">
            <select aria-label={t('Substance')} className={fieldCls} value={s.id} onChange={(e) => st.set({ sub: e.target.value })}>
              {SUBSTANCES.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(x.name)}
                </option>
              ))}
            </select>
            <p className="font-mono text-[10px] text-plant-400">
              T_c = {nf(s.Tc, 2)} K · p_c = {nf(s.pc, 2)} bar · ω = {nf(s.omega, 3)} · M = {nf(s.M, 2)} kg/kmol
            </p>
            <div className="grid grid-cols-2 gap-1">
              {ALL_EOS.map((e) => (
                <button key={e} type="button" aria-pressed={eos === e} onClick={() => st.set({ eos: e })} className={cn('rounded px-2 py-1 text-[11px]', eos === e ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-300 hover:bg-white/[0.04]')}>
                  {t(EOS_LABEL[e])}
                </button>
              ))}
            </div>
            <NumRow label={t('Temperature T')} unit="K" value={st.T} onChange={(v) => st.set({ T: v })} />
            <NumRow label={t('Pressure p')} unit="bar" value={st.p} onChange={(v) => st.set({ p: v })} />
            <p className="text-[10px] text-plant-500">
              T_r = {nf(T / s.Tc, 3)} · p_r = {nf(p / s.pc, 3)}
            </p>
          </div>
        </Card>
        <Card title="Equations of state">
          <div className="space-y-1 text-[12px] text-plant-100">
            <Tex block math="p\,v = R\,T" />
            <Tex block math="p = \frac{RT}{v - b} - \frac{a}{v^2}" />
            <Tex block math="p = \frac{RT}{v - b} - \frac{a}{\sqrt{T}\,v (v + b)}" />
            <Tex block math="p = \frac{RT}{v - b} - \frac{a\,\alpha(T)}{v^2 + 2bv - b^2}" />
          </div>
          <p className="mt-1 text-[10px] text-plant-500">{t('ideal gas, van der Waals, Redlich–Kwong, Peng–Robinson (a, b from T_c, p_c; α(T) from ω)')}</p>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label={t('Compressibility factor Z')} value={nf(cur.Z, 4)} sub={t(EOS_LABEL[eos])} />
          <Kpi label={t('Density ρ')} value={nf(cur.rho, 3)} unit="kg/m³" sub={cur.liquid ? t('liquid-like root') : t('gas-like root')} />
          <Kpi label={t('Deviation from ideal gas')} value={nf((1 / cur.Z - 1) * 100, 1)} unit="%" sub={t('in density')} />
          <Kpi label={t('Vapour pressure (EOS)')} value={sat ? nf(sat.p, 3) : '–'} unit={sat ? 'bar' : undefined} sub={T >= s.Tc ? t('supercritical: no phase change') : t('Maxwell construction')} />
        </div>
        {cur.roots.length === 3 && <Notice tone="info">{t('Three real roots of the cubic: the middle one is unstable; the stable phase is the root with the lower fugacity (lower Gibbs energy).')}</Notice>}
        <div className="grid gap-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card title="p,v diagram with Maxwell construction">
            <StateDiagram
              title={t('p,v diagram with Maxwell construction')}
              x={{ label: 'v [L/mol] (log)', min: vMin, max: vMax, log: true }}
              y={{ label: 'p [bar]', min: 0, max: pMax }}
              lines={lines}
              paths={paths}
              points={[{ id: 'S', x: cur.v, y: p, label: t('state'), draggable: true }]}
              onDrag={(_, v, pp) => {
                const pn = Math.min(pMax, Math.max(0.01, pp));
                st.set({ p: pn, T: Math.min(s.Tc * 3, Math.max(s.Tc * 0.5, temperaturePV(eos, s, pn, v))) });
              }}
            />
            <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
              {t('Green: isotherm at T (drag the state point). Below T_c the cubic isotherm forms a loop; the horizontal Maxwell line is placed so that both shaded areas are equal. That line is the vapour pressure, its ends are boiling liquid and saturated vapour.')}
            </p>
          </Card>
          <Card title="Compressibility chart Z(p_r, T_r)">
            <LineChartBox series={zChart} xLabel="p_r = p/p_c" yLabel="Z" height={300} digits={2} />
            <p className="mt-1 text-[10px] text-plant-500">{t('Generalised chart from the selected EOS (Peng–Robinson for the ideal gas). Z < 1: attraction dominates, Z > 1: repulsion (own volume) dominates.')}</p>
          </Card>
        </div>
        <Card title="Comparison of the models at T, p">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-right text-[10px] uppercase tracking-wider text-plant-500">
                  <th className="py-1 pr-3 text-left">{t('Model')}</th>
                  <th className="pr-3">Z</th>
                  <th className="pr-3">v [L/mol]</th>
                  <th className="pr-3">ρ [kg/m³]</th>
                  <th className="pr-3">h − h_ig [kJ/kmol]</th>
                  <th>s − s_ig [kJ/(kmol·K)]</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-right text-plant-100">
                {rows.map((r) => (
                  <tr key={r.e} className={cn(r.e === eos && 'text-signal-liquid')}>
                    <td className="py-1 pr-3 text-left font-sans">{t(EOS_LABEL[r.e])}</td>
                    <td className="pr-3">{nf(r.Z, 4)}</td>
                    <td className="pr-3">{nf(r.v, 5)}</td>
                    <td className="pr-3">{nf(r.rho, 3)}</td>
                    <td className="pr-3">{nf(r.dep.h, 1)}</td>
                    <td>{nf(r.dep.s, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-plant-500">{t('Departure functions: how much enthalpy and entropy of the real fluid differ from the ideal gas at the same T and p.')}</p>
        </Card>
        <Card title="Maxwell relations">
          <div className="grid gap-1 text-[13px] text-plant-100 md:grid-cols-2">
            <Tex block math="\left(\frac{\partial T}{\partial v}\right)_s = -\left(\frac{\partial p}{\partial s}\right)_v" />
            <Tex block math="\left(\frac{\partial T}{\partial p}\right)_s = \left(\frac{\partial v}{\partial s}\right)_p" />
            <Tex block math="\left(\frac{\partial s}{\partial v}\right)_T = \left(\frac{\partial p}{\partial T}\right)_v" />
            <Tex block math="\left(\frac{\partial s}{\partial p}\right)_T = -\left(\frac{\partial v}{\partial T}\right)_p" />
          </div>
          <p className="mt-2 text-[11px] text-plant-300">
            {t('Check with the selected EOS at the current state')}: (∂s/∂v)_T = <span className="font-mono text-plant-100">{nf(mx.dsdv * 100, 5)}</span> kPa/K · (∂p/∂T)_v ={' '}
            <span className="font-mono text-plant-100">{nf(mx.dpdT * 100, 5)}</span> kPa/K
          </p>
          <p className="text-[10px] text-plant-500">{t('Both follow from the Helmholtz energy f(T, v): the entropy change of a real gas can be computed from the measurable p,v,T behaviour.')}</p>
        </Card>
      </div>
    </div>
  );
}
