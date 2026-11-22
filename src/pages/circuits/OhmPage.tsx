/** Ohm's law and Kirchhoff's rules on R1 in series with R2 ∥ R3: moving charges, potentials as colour and height. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Charges, Dot, EE, EeLayout, Idea, potColor, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { ohmNetwork } from '@/lib/ee';

interface S {
  U: number;
  R1: number;
  R2: number;
  R3: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useOhm = create<S>()(
  persist((set) => ({ U: 12, R1: 100, R2: 200, R3: 300, set: (p) => set(p) }), { name: 'ee-ohm', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, ...r }) => r }),
);

export default function OhmPage() {
  const s = useOhm();
  const r = ohmNetwork(s.U, s.R1, s.R2, s.R3);
  const t0 = useAnimTime();
  const k = 700; // px per second per ampere
  const cTop = potColor(s.U, s.U);
  const cMid = potColor(r.U23, s.U);
  const cBot = potColor(0, s.U);
  return (
    <EeLayout
      aside={
        <>
          <Card title="Ohm's law and Kirchhoff">
            <Idea>
              {t(
                'Voltage is the “pressure” that drives charges, current is how many charges pass per second, resistance is how hard it is to get through: U = R·I. At a junction no charge is lost (node rule), and around any closed loop the voltages add up to zero (mesh rule).',
              )}
            </Idea>
          </Card>
          <Card title="Circuit">
            <div className="space-y-3">
              <ParamSlider label="Source voltage" symbol="U" unit="V" value={s.U} min={0} max={24} step={0.5} onChange={(U) => s.set({ U })} />
              <ParamSlider label="Resistor" symbol="R₁" unit="Ω" value={s.R1} min={10} max={1000} step={10} digits={0} onChange={(R1) => s.set({ R1 })} />
              <ParamSlider label="Resistor" symbol="R₂" unit="Ω" value={s.R2} min={10} max={1000} step={10} digits={0} onChange={(R2) => s.set({ R2 })} />
              <ParamSlider label="Resistor" symbol="R₃" unit="Ω" value={s.R3} min={10} max={1000} step={10} digits={0} onChange={(R3) => s.set({ R3 })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Total resistance" value={si(r.R, 'Ω')} sub={`R₂∥R₃ = ${si(r.R23, 'Ω')}`} />
        <Kpi label="Current I₁" value={si(r.I1, 'A')} sub={`I₂ + I₃ = ${si(r.I2 + r.I3, 'A')}`} />
        <Kpi label="Voltage across R₁" value={si(r.U1, 'V')} sub={`U₂₃ = ${si(r.U23, 'V')}`} />
        <Kpi label="Power" value={si(r.P, 'W')} sub={`${si(r.P1, 'W')} + ${si(r.P2, 'W')} + ${si(r.P3, 'W')}`} />
      </div>
      <Card title="Charges in motion">
        <svg viewBox="0 0 640 330" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Circuit with moving charges')}>
          <Wire
            pts={[
              [80, 80],
              [200, 80],
            ]}
            color={cTop}
          />
          <Sym a={[200, 80]} b={[320, 80]} kind="R" colorA={cTop} colorB={cMid} label="R₁" sub={si(s.R1, 'Ω')} side={-1} />
          <Wire
            pts={[
              [320, 80],
              [520, 80],
              [520, 140],
            ]}
            color={cMid}
          />
          <Wire
            pts={[
              [380, 80],
              [380, 140],
            ]}
            color={cMid}
          />
          <Sym a={[380, 140]} b={[380, 220]} kind="R" colorA={cMid} colorB={cBot} label="R₂" sub={si(s.R2, 'Ω')} side={1} />
          <Sym a={[520, 140]} b={[520, 220]} kind="R" colorA={cMid} colorB={cBot} label="R₃" sub={si(s.R3, 'Ω')} side={-1} />
          <Wire
            pts={[
              [380, 220],
              [380, 260],
            ]}
            color={cBot}
          />
          <Wire
            pts={[
              [520, 220],
              [520, 260],
              [80, 260],
              [80, 200],
            ]}
            color={cBot}
          />
          <Sym a={[80, 200]} b={[80, 140]} kind="V" colorA={cBot} colorB={cTop} label="U" sub={si(s.U, 'V')} side={1} />
          <Wire
            pts={[
              [80, 140],
              [80, 80],
            ]}
            color={cTop}
          />
          <Dot p={[380, 80]} />
          <Dot p={[380, 260]} />
          <Charges
            pts={[
              [80, 260],
              [80, 80],
              [380, 80],
            ]}
            I={r.I1}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [380, 80],
              [380, 260],
            ]}
            I={r.I2}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [380, 80],
              [520, 80],
              [520, 260],
              [380, 260],
            ]}
            I={r.I3}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [380, 260],
              [80, 260],
            ]}
            I={r.I1}
            t={t0}
            k={k}
          />
          <Readout x={150} y={70}>
            I₁ = {si(r.I1, 'A')} →
          </Readout>
          <Readout x={395} y={250} anchor="start">
            I₂ = {si(r.I2, 'A')} ↓
          </Readout>
          <Readout x={530} y={250} anchor="start">
            I₃ = {si(r.I3, 'A')} ↓
          </Readout>
          <Readout x={260} y={112}>
            U₁ = {si(r.U1, 'V')}
          </Readout>
          <Readout x={450} y={185}>
            U₂₃ = {si(r.U23, 'V')}
          </Readout>
          {/* potential legend */}
          <defs>
            <linearGradient id="potg" x1="0" x2="1">
              <stop offset="0" stopColor={potColor(0, 1)} />
              <stop offset="0.5" stopColor={potColor(0.5, 1)} />
              <stop offset="1" stopColor={potColor(1, 1)} />
            </linearGradient>
          </defs>
          <rect x={440} y={300} width={140} height={8} rx={4} fill="url(#potg)" />
          <Readout x={436} y={308} anchor="end">
            {t('potential')} 0 V
          </Readout>
          <Readout x={586} y={308} anchor="start">
            {nf(s.U, 1)} V
          </Readout>
        </svg>
        <p className="mt-1 text-[10px] text-plant-500">
          {t(
            'Dots move in the conventional current direction (+ → −) with a speed proportional to the current. The colour of a wire is its potential: everything of one colour is at the same voltage.',
          )}
        </p>
      </Card>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Voltage as height">
          <PotentialStairs U={s.U} U23={r.U23} />
          <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
            {t('Going once around the loop: the source lifts the charges to U, every resistor lets them down again. Up and down add to zero — that is the mesh rule.')}
          </p>
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`R_{23} = \\frac{R_2 R_3}{R_2 + R_3} = \\frac{${nf(s.R2, 0)}\\cdot ${nf(s.R3, 0)}}{${nf(s.R2 + s.R3, 0)}} = ${nf(r.R23, 2)}\\,\\Omega`} />
            <Tex block math={`I_1 = \\frac{U}{R_1 + R_{23}} = \\frac{${nf(s.U, 2)}}{${nf(r.R, 2)}} = ${nf(r.I1 * 1000, 3)}\\,\\mathrm{mA}`} />
            <Tex block math={`U_1 = R_1 I_1 = ${nf(r.U1, 3)}\\,\\mathrm V,\\quad U_{23} = U - U_1 = ${nf(r.U23, 3)}\\,\\mathrm V`} />
            <Tex block math={`I_2 = \\frac{U_{23}}{R_2} = ${nf(r.I2 * 1000, 3)}\\,\\mathrm{mA},\\quad I_3 = \\frac{U_{23}}{R_3} = ${nf(r.I3 * 1000, 3)}\\,\\mathrm{mA}`} />
            <p className="pt-1 text-[10px] text-plant-400">{t('Check')}</p>
            <Tex block math={`\\text{${t('Node')}: } I_1 = I_2 + I_3 \\;\\Rightarrow\\; ${nf(r.I1 * 1000, 3)} = ${nf(r.I2 * 1000, 3)} + ${nf(r.I3 * 1000, 3)}`} />
            <Tex block math={`\\text{${t('Mesh')}: } U - U_1 - U_{23} = ${nf(s.U, 2)} - ${nf(r.U1, 3)} - ${nf(r.U23, 3)} = 0`} />
          </div>
        </Card>
      </div>
    </EeLayout>
  );
}

function PotentialStairs({ U, U23 }: { U: number; U23: number }) {
  const W = 420;
  const H = 180;
  const y = (v: number) => H - 24 - (v / Math.max(U, 1e-9)) * (H - 50);
  const steps: [string, number, number][] = [
    ['−', 0, 40],
    ['U', U, 110],
    ['R₁', U23, 230],
    ['R₂ / R₃', 0, 350],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[520px]" role="img" aria-label={t('Potential along the loop')}>
      <line x1={30} y1={y(0)} x2={W - 10} y2={y(0)} stroke="rgb(var(--plant-700))" />
      <path d={`M30,${y(0)} H70 L110,${y(U)} H190 L230,${y(U23)} H310 L350,${y(0)} H${W - 10}`} fill="none" stroke={EE.u} strokeWidth={2.5} />
      {steps.map(([l, v, x]) => (
        <g key={l}>
          <circle cx={x} cy={y(v)} r={3} fill={potColor(v, U)} />
          <Readout x={x} y={y(v) - 8}>
            {nf(v, 2)} V
          </Readout>
          <Readout x={x} y={H - 6} color={EE.muted}>
            {l}
          </Readout>
        </g>
      ))}
    </svg>
  );
}
