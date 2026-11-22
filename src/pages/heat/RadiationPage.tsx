import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow } from '@/components/mechanics/common';
import { Kpi } from '@/components/workbench/controls';
import { alphaRad, bandFraction, exchange, planck, shields, SIGMA, viewFactor, WIEN, type Arrangement } from '@/engine/heat/radiation';
import { t } from '@/i18n';

const ARR: { id: Arrangement; label: string }[] = [
  { id: 'plates', label: 'Parallel plates' },
  { id: 'cylinders', label: 'Concentric cylinders' },
  { id: 'spheres', label: 'Concentric spheres' },
  { id: 'enclosed', label: 'Small body in a large room' },
];

export default function RadiationPage() {
  const [T1, setT1] = useState(800);
  const [T2, setT2] = useState(300);
  const [e1, setE1] = useState(0.8);
  const [e2, setE2] = useState(0.6);
  const [arr, setArr] = useState<Arrangement>('plates');
  const [r1, setR1] = useState(0.05);
  const [r2, setR2] = useState(0.1);
  const [n, setN] = useState(1);
  const [es, setEs] = useState(0.1);
  const [vf, setVf] = useState<'disks' | 'parallelRect' | 'perpRect'>('disks');
  const [va, setVa] = useState(1);
  const [vb, setVb] = useState(1);
  const [vc, setVc] = useState(1);
  const T1K = T1 + 273.15;
  const T2K = T2 + 273.15;
  const ratio = arr === 'cylinders' ? r1 / r2 : arr === 'spheres' ? (r1 / r2) ** 2 : 1;
  const ex = exchange(arr, T1K, T2K, e1, e2, ratio);
  const qs = shields(T1K, T2K, e1, e2, n, es);
  const spectrum = useMemo(
    () =>
      [T1K, T2K, 5778].map((T) => ({
        name: T === 5778 ? t('Sun (5778 K)') : `T = ${nf(T - 273.15, 0)} °C`,
        data: Array.from({ length: 200 }, (_, i) => {
          const l = 0.1 * 1.04 ** i;
          return { x: l, y: planck(l, T) };
        }).filter((p) => p.y > 1e-3),
      })),
    [T1K, T2K],
  );
  const F = viewFactor(vf, va, vb, vc);
  const N = (v: number, k = 3) => nf(v, k).replace(',', '{,}');
  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Surfaces">
          <div className="space-y-2">
            <NumRow label={t('Temperature surface 1')} unit="°C" value={T1} onChange={setT1} />
            <NumRow label={t('Emissivity ε₁')} value={e1} onChange={(v) => v > 0 && v <= 1 && setE1(v)} />
            <NumRow label={t('Temperature surface 2')} unit="°C" value={T2} onChange={setT2} />
            <NumRow label={t('Emissivity ε₂')} value={e2} onChange={(v) => v > 0 && v <= 1 && setE2(v)} />
            <select aria-label={t('Arrangement')} className={fieldCls} value={arr} onChange={(e) => setArr(e.target.value as Arrangement)}>
              {ARR.map((a) => (
                <option key={a.id} value={a.id}>
                  {t(a.label)}
                </option>
              ))}
            </select>
            {(arr === 'cylinders' || arr === 'spheres') && (
              <>
                <NumRow label={t('Inner radius r₁')} unit="m" value={r1} onChange={(v) => v > 0 && setR1(v)} />
                <NumRow label={t('Outer radius r₂')} unit="m" value={r2} onChange={(v) => v > r1 && setR2(v)} />
              </>
            )}
            <p className="text-[10px] text-plant-500">{t('ε: polished metal 0.03–0.1, oxidised steel 0.8, paint/brick 0.9, black body 1.')}</p>
          </div>
        </Card>
        <Card title="Radiation shields (parallel plates)">
          <div className="space-y-2">
            <NumRow label={t('Number of shields n')} value={n} onChange={(v) => v >= 0 && setN(Math.round(v))} />
            <NumRow label={t('Shield emissivity ε_S')} value={es} onChange={(v) => v > 0 && v <= 1 && setEs(v)} />
          </div>
        </Card>
        <Card title="View factor">
          <div className="space-y-2">
            <select aria-label={t('View factor')} className={fieldCls} value={vf} onChange={(e) => setVf(e.target.value as typeof vf)}>
              <option value="disks">{t('Coaxial parallel disks (r₁, r₂, distance)')}</option>
              <option value="parallelRect">{t('Aligned parallel rectangles (a, b, distance)')}</option>
              <option value="perpRect">{t('Perpendicular rectangles, common edge (edge, width 1, width 2)')}</option>
            </select>
            <NumRow label={vf === 'perpRect' ? t('Common edge') : vf === 'disks' ? 'r₁' : 'a'} unit="m" value={va} onChange={(v) => v > 0 && setVa(v)} />
            <NumRow label={vf === 'perpRect' ? t('Width of surface 1') : vf === 'disks' ? 'r₂' : 'b'} unit="m" value={vb} onChange={(v) => v > 0 && setVb(v)} />
            <NumRow label={vf === 'perpRect' ? t('Width of surface 2') : t('Distance')} unit="m" value={vc} onChange={(v) => v > 0 && setVc(v)} />
            <p className="font-mono text-[12px] text-signal-heat">F₁₂ = {nf(F, 4)}</p>
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi label={t('Black body σT₁⁴')} value={nf((SIGMA * T1K ** 4) / 1000, 2)} unit="kW/m²" />
          <Kpi label="λ_max (Wien)" value={nf(WIEN / T1K, 3)} unit="µm" sub={`T₁ = ${nf(T1K, 0)} K`} />
          <Kpi label={t('Net exchange q̇₁₂')} value={nf(ex.q, 1)} unit="W/m²" sub={t('per m² of surface 1')} />
          <Kpi label={t('With shields')} value={nf(qs, 1)} unit="W/m²" sub={`${nf((qs / exchange('plates', T1K, T2K, e1, e2).q) * 100, 0)} %`} />
          <Kpi label="α_Str" value={nf(alphaRad(e1, T1K, T2K), 2)} unit="W/m²K" sub={t('radiative heat transfer coefficient')} />
        </div>
        <Card title="Planck spectrum">
          <LineChartBox series={spectrum} xLabel="λ [µm]" yLabel="E_bλ [W/(m²·µm)]" logX logY xDomain={[0.1, 100]} refX={[{ x: 0.38, label: t('visible') }, { x: WIEN / T1K, label: 'λ_max' }]} />
          <p className="text-[10px] text-plant-500">
            {t('Share of the emission below 0.78 µm (visible and shorter) at T₁: {f} %.', { f: nf(bandFraction(0.78 * T1K) * 100, 3) })}
          </p>
        </Card>
        <Card title="Solution path">
          <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
            <div>
              <Tex block math={`\\dot q_{12} = \\frac{\\sigma (T_1^4 - T_2^4)}{\\frac{1}{\\varepsilon_1} + \\frac{A_1}{A_2}\\left(\\frac{1}{\\varepsilon_2} - 1\\right)}`} />
              <Tex block math={`= \\frac{5{,}67\\cdot10^{-8}\\,(${N(T1K, 2)}^4 - ${N(T2K, 2)}^4)}{${N(1 / e1)} + ${N(ex.A12)}\\cdot ${N(1 / e2 - 1)}} = ${N(ex.q, 1)}\\ \\mathrm{W/m^2}`} />
            </div>
            <div>
              <Tex block math={`\\dot q_{n\\,S} = \\frac{\\sigma (T_1^4 - T_2^4)}{\\frac{1}{\\varepsilon_1} + \\frac{1}{\\varepsilon_2} - 1 + n\\left(\\frac{2}{\\varepsilon_S} - 1\\right)} = ${N(qs, 1)}\\ \\mathrm{W/m^2}`} />
              <Tex block math={`\\text{${t('two-surface network')}}: \\frac{1-\\varepsilon_1}{\\varepsilon_1 A_1} + \\frac{1}{A_1 F_{12}} + \\frac{1-\\varepsilon_2}{\\varepsilon_2 A_2}`} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
