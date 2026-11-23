/** TM 2: bar in tension/compression — Hooke's law, thermal strain, statically indeterminate bar between walls. */

import { Tex } from '@/components/balance/Tex';
import { VIZ } from '@/components/analysis/vizTokens';
import { EeLayout, Idea } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, Diagram, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { solveBar } from '@/engine/mechanics/elasto';

type Mat = 'steel' | 'aluminium' | 'copper';
const MAT: Record<Mat, { E: number; alpha: number; sy: number; label: string }> = {
  steel: { E: 210, alpha: 12, sy: 235, label: 'Steel' },
  aluminium: { E: 70, alpha: 23, sy: 160, label: 'Aluminium' },
  copper: { E: 120, alpha: 17, sy: 70, label: 'Copper' },
};

const useBar = paramStore('tm-bar', { m1: 'steel' as Mat, m2: 'aluminium' as Mat, l1: 400, A1: 200, l2: 600, A2: 300, F: 30, dT: 40, wall: true, gap: 0.2 });

export default function BarPage() {
  const s = useBar();
  const M1 = MAT[s.m1];
  const M2 = MAT[s.m2];
  const r = solveBar({
    segs: [
      { l: s.l1, A: s.A1, E: M1.E, alpha: M1.alpha },
      { l: s.l2, A: s.A2, E: M2.E, alpha: M2.alpha },
    ],
    F: s.F,
    dT: s.dT,
    rightWall: s.wall,
    gap: s.gap,
  });
  if (!r) return null;
  const L = (s.l1 + s.l2) / 1000;
  const step = (v1: number, v2: number) => [
    { x: 0, v: v1 },
    { x: s.l1 / 1000, v: v1 },
    { x: s.l1 / 1000, v: v2 },
    { x: L, v: v2 },
  ];
  const u = [
    { x: 0, u: 0 },
    { x: s.l1 / 1000, u: r.u1 },
    { x: L, u: r.u2 },
  ];
  const overload = [Math.abs(r.sigma[0]) > M1.sy, Math.abs(r.sigma[1]) > M2.sy];

  // drawing
  const W = 600;
  const x0 = 50;
  const k = 440 / (s.l1 + s.l2);
  const hA = (A: number) => 12 + Math.sqrt(A) * 2.2;
  const xJ = x0 + s.l1 * k;
  const xE = xJ + s.l2 * k;
  const amp = 40 / Math.max(Math.abs(r.u1), Math.abs(r.u2), s.gap, 0.05);
  const segColor = (sig: number, sy: number) => {
    const q = Math.min(1, Math.abs(sig) / sy);
    return sig >= 0 ? `rgba(239,90,80,${0.25 + 0.6 * q})` : `rgba(80,150,239,${0.25 + 0.6 * q})`;
  };
  const eps = Array.from({ length: 2 }, (_, i) => (i === 0 ? r.dl[0] / s.l1 : r.dl[1] / s.l2));

  return (
    <EeLayout
      aside={
        <>
          <Card title="Bars in tension and compression">
            <Idea>
              {t(
                "In a bar the normal force N spreads evenly over the area: σ = N/A. Hooke's law σ = E·ε links stress to strain, so a segment lengthens by Δl = N·l/(E·A). Heating adds the free thermal strain α_T·ΔT. If the bar cannot expand freely (wall on both sides), equilibrium alone is not enough: the compatibility condition — total length change equals the gap — gives the missing equation.",
              )}
            </Idea>
          </Card>
          <Card title="Segment 1 (left)">
            <div className="space-y-3">
              <Segmented value={s.m1} onChange={(m1) => s.set({ m1 })} options={(Object.keys(MAT) as Mat[]).map((m) => ({ value: m, label: t(MAT[m].label) }))} />
              <ParamSlider label="Length" symbol="l₁" unit="mm" value={s.l1} min={100} max={1500} step={10} digits={0} onChange={(l1) => s.set({ l1 })} />
              <ParamSlider label="Area" symbol="A₁" unit="mm²" value={s.A1} min={20} max={1000} step={10} digits={0} onChange={(A1) => s.set({ A1 })} />
            </div>
          </Card>
          <Card title="Segment 2 (right)">
            <div className="space-y-3">
              <Segmented value={s.m2} onChange={(m2) => s.set({ m2 })} options={(Object.keys(MAT) as Mat[]).map((m) => ({ value: m, label: t(MAT[m].label) }))} />
              <ParamSlider label="Length" symbol="l₂" unit="mm" value={s.l2} min={100} max={1500} step={10} digits={0} onChange={(l2) => s.set({ l2 })} />
              <ParamSlider label="Area" symbol="A₂" unit="mm²" value={s.A2} min={20} max={1000} step={10} digits={0} onChange={(A2) => s.set({ A2 })} />
            </div>
          </Card>
          <Card title="Load">
            <div className="space-y-3">
              <ParamSlider label="Force at the joint" symbol="F" unit="kN" value={s.F} min={-100} max={100} step={1} digits={0} onChange={(F) => s.set({ F })} />
              <ParamSlider label="Temperature change" symbol="ΔT" unit="K" value={s.dT} min={-100} max={150} step={1} digits={0} onChange={(dT) => s.set({ dT })} />
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-plant-300">
                <input type="checkbox" checked={s.wall} onChange={(e) => s.set({ wall: e.target.checked })} />
                {t('Wall on the right (statically indeterminate)')}
              </label>
              <ParamSlider label="Gap to the wall" symbol="s" unit="mm" value={s.gap} min={0} max={2} step={0.01} digits={2} disabled={!s.wall} onChange={(gap) => s.set({ gap })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="N₁ / N₂" value={`${nf(r.N[0], 2)} / ${nf(r.N[1], 2)}`} unit="kN" />
        <Kpi label="σ₁ / σ₂" value={`${nf(r.sigma[0], 1)} / ${nf(r.sigma[1], 1)}`} unit="MPa" />
        <Kpi label="Δl₁ / Δl₂" value={`${nf(r.dl[0], 3)} / ${nf(r.dl[1], 3)}`} unit="mm" />
        <Kpi label="End displacement" value={nf(r.u2, 3)} unit="mm" />
        <Kpi label="Wall reaction" value={s.wall ? nf(r.RB, 2) : '–'} unit={s.wall ? 'kN' : undefined} sub={s.wall ? (r.contact ? t('gap closed') : t('gap still open')) : undefined} />
      </div>
      {(overload[0] || overload[1]) && <Notice tone="warning">{t('The stress exceeds the yield strength of the material: Hooke\'s law no longer applies.')}</Notice>}
      <Card title="Bar, deformation (exaggerated) and stress">
        <svg viewBox={`0 0 ${W} 200`} className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Bar with two segments')}>
          {/* walls */}
          <rect x={x0 - 14} y={30} width={14} height={140} fill="url(#hatch)" stroke={TM.ground} />
          {s.wall && <rect x={xE + s.gap * amp} y={30} width={14} height={140} fill="url(#hatch)" stroke={TM.ground} />}
          <defs>
            <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--plant-500))" strokeWidth="1.5" />
            </pattern>
          </defs>
          {/* undeformed outline */}
          <rect x={x0} y={100 - hA(s.A1) / 2} width={s.l1 * k} height={hA(s.A1)} fill="none" stroke={TM.muted} strokeDasharray="4 3" />
          <rect x={xJ} y={100 - hA(s.A2) / 2} width={s.l2 * k} height={hA(s.A2)} fill="none" stroke={TM.muted} strokeDasharray="4 3" />
          {/* deformed, coloured by stress */}
          <rect x={x0} y={100 - hA(s.A1) / 2} width={s.l1 * k + r.u1 * amp} height={hA(s.A1)} fill={segColor(r.sigma[0], M1.sy)} stroke={TM.body} />
          <rect x={xJ + r.u1 * amp} y={100 - hA(s.A2) / 2} width={s.l2 * k + (r.u2 - r.u1) * amp} height={hA(s.A2)} fill={segColor(r.sigma[1], M2.sy)} stroke={TM.body} />
          {s.F !== 0 && (
            <Arrow
              a={[xJ + r.u1 * amp + (s.F > 0 ? -10 : 70), 100 - hA(Math.max(s.A1, s.A2)) / 2 - 16]}
              b={[xJ + r.u1 * amp + (s.F > 0 ? 60 : 0), 100 - hA(Math.max(s.A1, s.A2)) / 2 - 16]}
              color={TM.load}
              label={`F = ${nf(s.F, 0)} kN`}
            />
          )}
          <Label x={(x0 + xJ) / 2} y={186} color={TM.muted}>{`1: ${t(M1.label)}`}</Label>
          <Label x={(xJ + xE) / 2} y={186} color={TM.muted}>{`2: ${t(M2.label)}`}</Label>
        </svg>
        <Caption>{t('Dashed: original length. Red: tension, blue: compression (intensity relative to the yield strength). Displacements strongly enlarged.')}</Caption>
      </Card>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="Normal force, stress and displacement">
          <Diagram data={step(r.N[0], r.N[1]).map((p) => ({ x: p.x, N: p.v }))} dataKey="N" label={t('Normal force N(x)')} unit="kN" color={VIZ.equilibrium} xMax={L} digits={1} />
          <Diagram data={step(r.sigma[0], r.sigma[1]).map((p) => ({ x: p.x, s: p.v }))} dataKey="s" label={t('Stress σ(x)')} unit="MPa" color={VIZ.operating} xMax={L} digits={0} />
          <Diagram data={u} dataKey="u" label={t('Displacement u(x)')} unit="mm" color={VIZ.qLine} xMax={L} digits={3} />
        </Card>
        <Card title="Hooke's law: σ over ε">
          <LineChartBox
            height={300}
            series={[
              { name: `${t(M1.label)} (E = ${M1.E} GPa)`, data: [{ x: -2, y: -2 * M1.E }, { x: 2, y: 2 * M1.E }], color: TM.load },
              { name: `${t(M2.label)} (E = ${M2.E} GPa)`, data: [{ x: -2, y: -2 * M2.E }, { x: 2, y: 2 * M2.E }], color: TM.v },
            ]}
            xLabel="ε [‰]"
            yLabel="σ [MPa]"
            xDomain={[-2, 2]}
            yDomain={[-300, 300]}
            refX={[
              { x: r.sigma[0] / M1.E, label: 'ε₁' },
              { x: r.sigma[1] / M2.E, label: 'ε₂' },
            ]}
            digits={1}
          />
          <Caption>
            {t('Total strain = mechanical part σ/E + thermal part α_T·ΔT.')} ε₁ = {nf(eps[0]! * 1000, 3)} ‰, ε₂ = {nf(eps[1]! * 1000, 3)} ‰
          </Caption>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`\\Delta l_i = \\frac{N_i\\,l_i}{E_i A_i} + \\alpha_{T,i}\\,\\Delta T\\,l_i`} />
          <Tex block math={`\\text{${t('Equilibrium at the joint')}}:\\ N_1 = N_2 + F`} />
          {s.wall ? (
            <>
              <Tex block math={`\\text{${t('free elongation')}}:\\ \\Delta l_{frei} = \\frac{F l_1}{E_1A_1} + \\alpha_{T,1}\\Delta T l_1 + \\alpha_{T,2}\\Delta T l_2 = ${nf(r.contact ? (s.F * s.l1) / (M1.E * s.A1) + (M1.alpha * s.l1 + M2.alpha * s.l2) * 1e-6 * s.dT : r.u2, 4)}\\,\\mathrm{mm}`} />
              <Tex block math={r.contact ? `\\text{${t('Compatibility')}}:\\ \\Delta l_1 + \\Delta l_2 = s \\Rightarrow N_2 = ${nf(r.N[1], 3)}\\,\\mathrm{kN}` : `\\Delta l_{frei} < s = ${nf(s.gap, 2)}\\,\\mathrm{mm} \\Rightarrow N_2 = 0`} />
            </>
          ) : (
            <Tex block math={`\\text{${t('free end')}}:\\ N_2 = 0,\\ N_1 = F = ${nf(s.F, 1)}\\,\\mathrm{kN}`} />
          )}
          <Tex block math={`\\sigma_1 = \\frac{N_1}{A_1} = ${nf(r.sigma[0], 2)}\\,\\mathrm{MPa},\\quad \\sigma_2 = \\frac{N_2}{A_2} = ${nf(r.sigma[1], 2)}\\,\\mathrm{MPa}`} />
          <Tex block math={`u_{end} = \\Delta l_1 + \\Delta l_2 = ${nf(r.dl[0], 4)} + ${nf(r.dl[1], 4)} = ${nf(r.u2, 4)}\\,\\mathrm{mm}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
