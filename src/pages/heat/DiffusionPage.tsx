import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow } from '@/components/mechanics/common';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { fuller, GASES, penetration, psatWater, stefan, uptake } from '@/engine/heat/diffusion';
import { t } from '@/i18n';

type Mode = 'stefan' | 'transient' | 'layer';

export default function DiffusionPage() {
  const [mode, setMode] = useState<Mode>('stefan');
  const [A, setAg] = useState('H2O');
  const [B, setBg] = useState('air');
  const [TC, setTC] = useState(60);
  const [p, setP] = useState(1.01325);
  const [L, setL] = useState(0.1);
  const [y0, setY0] = useState(Math.round((psatWater(60) / 1.01325) * 1e4) / 1e4);
  const [yL, setYL] = useState(0);
  const [Dt, setDt] = useState(1e-9);
  const [cs, setCs] = useState(1);
  const [tEnd, setTEnd] = useState(3600);
  const [Dl, setDl] = useState(1e-10);
  const [s, setS] = useState(0.001);
  const [c1, setC1] = useState(10);
  const [c2, setC2] = useState(0);
  const T = TC + 273.15;
  const D = fuller(A, B, T, p);
  const r = useMemo(() => stefan(D, T, p, L, y0, yL), [D, T, p, L, y0, yL]);
  const N = (v: number, d = 4) => nf(v, d).replace(',', '{,}');
  const exp = (v: number) => v.toExponential(3).replace(/e([+-]?\d+)/, '\\cdot10^{$1}');
  const times = [0.05, 0.2, 0.5, 1].map((f) => f * tEnd);
  const depth = 4 * Math.sqrt(Dt * tEnd);
  const transient = times.map((tt) => ({
    name: `t = ${nf(tt / 60, 1)} min`,
    data: Array.from({ length: 61 }, (_, i) => {
      const x = (i / 60) * depth;
      return { x: x * 1000, y: penetration(x, tt, Dt, cs, 0) };
    }),
  }));
  const jLayer = (Dl * (c1 - c2)) / s;

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Problem">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'stefan', label: 'Stefan tube' },
              { value: 'layer', label: 'Layer (Fick)' },
              { value: 'transient', label: 'Transient' },
            ]}
          />
        </Card>
        {mode === 'stefan' && (
          <Card title="Gas pair and conditions">
            <div className="space-y-2">
              {[
                ['Diffusing component A', A, setAg],
                ['Stagnant gas B', B, setBg],
              ].map(([label, v, set]) => (
                <label key={label as string} className="grid grid-cols-[minmax(0,1fr)_160px] items-center gap-2 text-[11px] text-plant-300">
                  <span>{t(label as string)}</span>
                  <select className={fieldCls} value={v as string} onChange={(e) => (set as (x: string) => void)(e.target.value)}>
                    {Object.entries(GASES).map(([k, g]) => (
                      <option key={k} value={k}>
                        {t(g.name)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <NumRow label={t('Temperature')} unit="°C" value={TC} onChange={setTC} />
              <NumRow label={t('Pressure')} unit="bar" value={p} onChange={(v) => v > 0 && setP(v)} />
              <NumRow label={t('Diffusion length L')} unit="m" value={L} onChange={(v) => v > 0 && setL(v)} />
              <NumRow label={t('Mole fraction y_A at the liquid surface')} value={y0} onChange={(v) => v >= 0 && v < 1 && setY0(v)} />
              <NumRow label={t('Mole fraction y_A at the tube mouth')} value={yL} onChange={(v) => v >= 0 && v < 1 && setYL(v)} />
              {A === 'H2O' && (
                <button type="button" className="text-[11px] text-signal-heat hover:underline" onClick={() => setY0(Math.round((psatWater(TC) / p) * 1e4) / 1e4)}>
                  {t('y_A = p_sat(T)/p for water ({v})', { v: nf(psatWater(TC) / p, 4) })}
                </button>
              )}
            </div>
          </Card>
        )}
        {mode === 'layer' && (
          <Card title="Layer">
            <div className="space-y-2">
              <NumRow label={t('Diffusion coefficient D')} unit="m²/s" value={Dl} onChange={(v) => v > 0 && setDl(v)} />
              <NumRow label={t('Thickness s')} unit="m" value={s} onChange={(v) => v > 0 && setS(v)} />
              <NumRow label={t('Concentration c₁ (left)')} unit="mol/m³" value={c1} onChange={setC1} />
              <NumRow label={t('Concentration c₂ (right)')} unit="mol/m³" value={c2} onChange={setC2} />
              <p className="text-[10px] text-plant-500">{t('Typical D: gases 10⁻⁵, liquids 10⁻⁹, solids/membranes 10⁻¹⁰…10⁻¹⁴ m²/s.')}</p>
            </div>
          </Card>
        )}
        {mode === 'transient' && (
          <Card title="Semi-infinite medium">
            <div className="space-y-2">
              <NumRow label={t('Diffusion coefficient D')} unit="m²/s" value={Dt} onChange={(v) => v > 0 && setDt(v)} />
              <NumRow label={t('Surface concentration c_s')} unit="mol/m³" value={cs} onChange={setCs} />
              <NumRow label={t('Time span')} unit="s" value={tEnd} onChange={(v) => v > 0 && setTEnd(v)} />
              <p className="text-[10px] text-plant-500">{t('Initial concentration 0. Example: gas absorbing into a liquid film (penetration theory).')}</p>
            </div>
          </Card>
        )}
      </aside>
      <div className="min-w-0 space-y-2">
        {mode === 'stefan' && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label="D_AB (Fuller)" value={nf(D * 1e5, 3)} unit="10⁻⁵ m²/s" />
              <Kpi label={t('Flux with Stefan flow')} value={r.nStefan.toExponential(3)} unit="mol/m²s" />
              <Kpi label={t('Fick only (equimolar)')} value={r.nEqui.toExponential(3)} unit="mol/m²s" />
              <Kpi label={t('Stefan factor')} value={nf(r.factor, 4)} sub={t('one-sided / equimolar')} />
              <Kpi label={t('Mass flux')} value={(r.nStefan * GASES[A]!.M * 3600).toExponential(3)} unit="g/m²h" />
            </div>
            <Card title="Concentration profile y_A(x)">
              <LineChartBox
                series={[
                  { name: t('one-sided diffusion (Stefan)'), data: r.profile.map((q) => ({ x: q.x * 1000, y: q.yStefan })) },
                  { name: t('equimolar counter-diffusion (linear)'), data: r.profile.map((q) => ({ x: q.x * 1000, y: q.yEqui })), dashed: true },
                ]}
                xLabel="x [mm]"
                yLabel="y_A"
                digits={3}
              />
            </Card>
            <Card title="Solution path">
              <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
                <div>
                  <Tex block math={`D_{AB} = \\frac{1.43\\cdot10^{-3}\\, T^{1.75}}{p\\,\\sqrt{M_{AB}}\\,\\left(\\Sigma v_A^{1/3} + \\Sigma v_B^{1/3}\\right)^2} = ${exp(D)}\\ \\mathrm{m^2/s}`} />
                  <Tex block math={`\\text{Fick}: \\dot n_A = -c D \\frac{dy_A}{dx} = \\frac{c D}{L}(y_{A,0} - y_{A,L}) = ${exp(r.nEqui)}`} />
                </div>
                <div>
                  <Tex block math={`\\text{Stefan}: \\dot n_A = \\frac{c D}{L}\\ln\\frac{1 - y_{A,L}}{1 - y_{A,0}} = ${exp(r.nStefan)}\\ \\mathrm{\\frac{mol}{m^2 s}}`} />
                  <Tex block math={`c = \\frac{p}{RT} = ${N(r.c, 3)}\\ \\mathrm{mol/m^3},\\quad \\frac{1 - y_A(x)}{1 - y_{A,0}} = \\left(\\frac{1 - y_{A,L}}{1 - y_{A,0}}\\right)^{x/L}`} />
                </div>
              </div>
            </Card>
          </>
        )}
        {mode === 'layer' && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Kpi label={t('Flux j = D·Δc/s')} value={jLayer.toExponential(3)} unit="mol/m²s" />
              <Kpi label={t('Per day')} value={nf(jLayer * 86400, 4)} unit="mol/m²d" />
              <Kpi label={t('Time to steady state ≈ s²/D')} value={nf((s * s) / Dl / 3600, 2)} unit="h" />
            </div>
            <Card title="Concentration profile c(x)">
              <LineChartBox series={[{ name: 'c(x)', data: [{ x: 0, y: c1 }, { x: s * 1000, y: c2 }] }]} xLabel="x [mm]" yLabel="c [mol/m³]" />
              <Tex block math={`j_A = -D\\,\\frac{dc_A}{dx} = D\\,\\frac{c_1 - c_2}{s} = ${exp(Dl)} \\cdot \\frac{${N(c1 - c2, 3)}}{${N(s, 5)}} = ${exp(jLayer)}\\ \\mathrm{\\frac{mol}{m^2 s}}`} />
              <p className="text-[10px] text-plant-500">{t('Fick’s first law is the analogue of Fourier’s law: j ↔ q̇, D ↔ λ, c ↔ T. Layers in series add their resistances s/D.')}</p>
            </Card>
          </>
        )}
        {mode === 'transient' && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Kpi label={t('Penetration depth')} value={nf(depth * 1000, 3)} unit="mm" sub="≈ 4√(D·t)" />
              <Kpi label={t('Uptake per area')} value={nf(uptake(tEnd, Dt, cs, 0), 5)} unit="mol/m²" sub="2c_s√(Dt/π)" />
              <Kpi label={t('Mean mass transfer coefficient β')} value={(2 * Math.sqrt(Dt / (Math.PI * tEnd))).toExponential(3)} unit="m/s" sub="2√(D/(π t))" />
            </div>
            <Card title="Concentration profiles c(x) at several times">
              <LineChartBox series={transient} xLabel="x [mm]" yLabel="c [mol/m³]" digits={3} />
              <Tex block math={`c(x,t) = c_s\\,\\operatorname{erfc}\\!\\left(\\frac{x}{2\\sqrt{D t}}\\right)`} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
