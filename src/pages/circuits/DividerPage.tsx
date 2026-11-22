/** Voltage divider (loaded and unloaded) and Wheatstone bridge, with node potentials as colour. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Charges, Dot, EE, EeLayout, Idea, potColor, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice, Toggle } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { bridge, divider } from '@/lib/ee';

type Mode = 'divider' | 'bridge';
interface S {
  mode: Mode;
  U: number;
  R1: number;
  R2: number;
  loaded: boolean;
  RL: number;
  B1: number;
  B2: number;
  B3: number;
  B4: number;
  Rg: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useDiv = create<S>()(
  persist((set) => ({ mode: 'divider', U: 10, R1: 1000, R2: 1000, loaded: true, RL: 2000, B1: 1000, B2: 1000, B3: 1000, B4: 1200, Rg: 100, set: (p) => set(p) }), {
    name: 'ee-divider',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

export default function DividerPage() {
  const s = useDiv();
  return (
    <EeLayout
      aside={
        <>
          <Card title="Voltage divider and bridge">
            <Idea>
              {t(
                'Two resistors in series share the voltage in the ratio of their values. That is how a potentiometer, a sensor input or a reference voltage works. A bridge is two dividers side by side: when both give the same voltage, no current flows between them — this is how strain gauges and thermometers are read.',
              )}
            </Idea>
            <Segmented<Mode>
              value={s.mode}
              onChange={(mode) => s.set({ mode })}
              options={[
                { value: 'divider', label: t('Divider') },
                { value: 'bridge', label: t('Bridge') },
              ]}
            />
          </Card>
          <Card title="Values">
            <div className="space-y-3">
              <ParamSlider label="Source voltage" symbol="U" unit="V" value={s.U} min={0} max={24} step={0.5} onChange={(U) => s.set({ U })} />
              {s.mode === 'divider' ? (
                <>
                  <ParamSlider label="Upper resistor" symbol="R₁" unit="Ω" value={s.R1} min={10} max={10000} step={10} digits={0} onChange={(R1) => s.set({ R1 })} />
                  <ParamSlider label="Lower resistor" symbol="R₂" unit="Ω" value={s.R2} min={10} max={10000} step={10} digits={0} onChange={(R2) => s.set({ R2 })} />
                  <Toggle checked={s.loaded} onChange={(loaded) => s.set({ loaded })} label={t('Connect a load')} />
                  <ParamSlider label="Load resistor" symbol="R_L" unit="Ω" value={s.RL} min={10} max={100000} step={10} digits={0} disabled={!s.loaded} onChange={(RL) => s.set({ RL })} />
                </>
              ) : (
                <>
                  <ParamSlider label="Left top" symbol="R₁" unit="Ω" value={s.B1} min={100} max={5000} step={10} digits={0} onChange={(B1) => s.set({ B1 })} />
                  <ParamSlider label="Left bottom" symbol="R₂" unit="Ω" value={s.B2} min={100} max={5000} step={10} digits={0} onChange={(B2) => s.set({ B2 })} />
                  <ParamSlider label="Right top" symbol="R₃" unit="Ω" value={s.B3} min={100} max={5000} step={10} digits={0} onChange={(B3) => s.set({ B3 })} />
                  <ParamSlider label="Right bottom (sensor)" symbol="R₄" unit="Ω" value={s.B4} min={100} max={5000} step={10} digits={0} onChange={(B4) => s.set({ B4 })} />
                  <ParamSlider label="Meter resistance" symbol="R_g" unit="Ω" value={s.Rg} min={1} max={5000} step={1} digits={0} onChange={(Rg) => s.set({ Rg })} />
                  <button type="button" onClick={() => s.set({ B4: (s.B2 * s.B3) / s.B1 })} className="text-[11px] text-signal-liquid hover:underline">
                    {t('Balance the bridge (R₄ = R₂R₃/R₁)')}
                  </button>
                </>
              )}
            </div>
          </Card>
        </>
      }
    >
      {s.mode === 'divider' ? <DividerView s={s} /> : <BridgeView s={s} />}
    </EeLayout>
  );
}

function DividerView({ s }: { s: S }) {
  const r = divider(s.U, s.R1, s.R2, s.loaded ? s.RL : null);
  const t0 = useAnimTime();
  const I2 = r.U2 / s.R2;
  const IL = s.loaded ? r.U2 / s.RL : 0;
  const cT = potColor(s.U, s.U);
  const cM = potColor(r.U2, s.U);
  const cB = potColor(0, s.U);
  const k = 2.5e4;
  // output voltage against the load resistance
  const curve = Array.from({ length: 80 }, (_, i) => {
    const RL = 10 ** (1 + (i / 79) * 4);
    return { x: RL, y: divider(s.U, s.R1, s.R2, RL).U2 };
  });
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Output voltage" value={si(r.U2, 'V')} sub={`${t('unloaded')} ${si(r.unloaded, 'V')}`} />
        <Kpi label="Ratio" value={nf(r.U2 / Math.max(s.U, 1e-12), 3)} sub="$U_2/U$" />
        <Kpi label="Current from the source" value={si(r.I, 'A')} />
        <Kpi label="Drop by the load" value={`${nf(s.U > 0 ? (1 - r.U2 / r.unloaded) * 100 : 0, 1)} %`} />
      </div>
      {s.loaded && s.RL < 10 * s.R2 && <Notice tone="info">{t('The load is not much larger than R₂: it pulls the output down. Rule of thumb: the load should be at least ten times R₂.')}</Notice>}
      <Card title="Circuit">
        <svg viewBox="0 0 640 320" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Voltage divider')}>
          <Wire
            pts={[
              [100, 60],
              [300, 60],
              [300, 90],
            ]}
            color={cT}
          />
          <Sym a={[300, 90]} b={[300, 150]} kind="R" colorA={cT} colorB={cM} label="R₁" sub={si(s.R1, 'Ω')} side={-1} />
          <Wire
            pts={[
              [300, 150],
              [300, 180],
            ]}
            color={cM}
          />
          <Sym a={[300, 180]} b={[300, 240]} kind="R" colorA={cM} colorB={cB} label="R₂" sub={si(s.R2, 'Ω')} side={-1} />
          <Wire
            pts={[
              [300, 240],
              [300, 270],
              [100, 270],
              [100, 200],
            ]}
            color={cB}
          />
          <Sym a={[100, 200]} b={[100, 130]} kind="V" colorA={cB} colorB={cT} label="U" sub={si(s.U, 'V')} side={1} />
          <Wire
            pts={[
              [100, 130],
              [100, 60],
            ]}
            color={cT}
          />
          <Wire
            pts={[
              [300, 165],
              [460, 165],
              [460, 180],
            ]}
            color={cM}
          />
          {s.loaded ? (
            <Sym a={[460, 180]} b={[460, 240]} kind="R" colorA={cM} colorB={cB} label="R_L" sub={si(s.RL, 'Ω')} side={-1} />
          ) : (
            <circle cx={460} cy={185} r={4} fill="none" stroke={EE.body} />
          )}
          {s.loaded && (
            <Wire
              pts={[
                [460, 240],
                [460, 270],
                [300, 270],
              ]}
              color={cB}
            />
          )}
          {!s.loaded && <circle cx={460} cy={255} r={4} fill="none" stroke={EE.body} />}
          <Dot p={[300, 165]} />
          <Dot p={[300, 270]} />
          <Charges
            pts={[
              [100, 270],
              [100, 60],
              [300, 60],
              [300, 165],
            ]}
            I={r.I}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [300, 165],
              [300, 270],
            ]}
            I={I2}
            t={t0}
            k={k}
          />
          {s.loaded && (
            <Charges
              pts={[
                [300, 165],
                [460, 165],
                [460, 270],
                [300, 270],
              ]}
              I={IL}
              t={t0}
              k={k}
            />
          )}
          <Charges
            pts={[
              [300, 270],
              [100, 270],
            ]}
            I={r.I}
            t={t0}
            k={k}
          />
          <line x1={520} y1={175} x2={520} y2={250} stroke={EE.u} strokeWidth={1.5} markerEnd="url(#arrU)" />
          <defs>
            <marker id="arrU" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill={EE.u} />
            </marker>
          </defs>
          <Readout x={530} y={215} anchor="start" color={EE.u}>
            U₂ = {si(r.U2, 'V')}
          </Readout>
        </svg>
      </Card>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Output voltage against the load">
          <LineChartBox series={[{ name: 'U₂(R_L)', data: curve }]} xLabel="R_L [Ω]" yLabel="U₂ [V]" logX height={220} refX={s.loaded ? [{ x: s.RL, label: 'R_L' }] : undefined} />
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`U_2 = U\\,\\frac{R_2}{R_1 + R_2} = ${nf(r.unloaded, 3)}\\,\\mathrm V\\quad(\\text{${t('unloaded')}})`} />
            {s.loaded && (
              <>
                <Tex block math={`R_2 \\parallel R_L = \\frac{R_2 R_L}{R_2 + R_L} = ${nf(r.R2e, 1)}\\,\\Omega`} />
                <Tex block math={`U_2 = U\\,\\frac{R_2 \\parallel R_L}{R_1 + R_2 \\parallel R_L} = ${nf(r.U2, 3)}\\,\\mathrm V`} />
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function BridgeView({ s }: { s: S }) {
  const b = bridge(s.U, s.B1, s.B2, s.B3, s.B4, s.Rg);
  const t0 = useAnimTime();
  // currents with the meter connected (Thevenin): node voltages shift by the meter current
  const Va = b.Va - b.Ig * ((s.B1 * s.B2) / (s.B1 + s.B2));
  const Vb = b.Vb + b.Ig * ((s.B3 * s.B4) / (s.B3 + s.B4));
  const I1 = (s.U - Va) / s.B1;
  const I2 = Va / s.B2;
  const I3 = (s.U - Vb) / s.B3;
  const I4 = Vb / s.B4;
  const k = 2.5e4;
  const cT = potColor(s.U, s.U);
  const cA = potColor(Va, s.U);
  const cB = potColor(Vb, s.U);
  const c0 = potColor(0, s.U);
  const curve = Array.from({ length: 81 }, (_, i) => {
    const R4 = s.B4 * (0.5 + i / 80);
    return { x: R4, y: bridge(s.U, s.B1, s.B2, s.B3, R4, s.Rg).Ud * 1000 };
  });
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Bridge voltage" value={si(b.Ud, 'V')} sub={b.balanced ? t('balanced') : t('unbalanced')} />
        <Kpi label="Meter current" value={si(b.Ig, 'A')} />
        <Kpi label="Left midpoint" value={si(b.Va, 'V')} />
        <Kpi label="Right midpoint" value={si(b.Vb, 'V')} />
      </div>
      <Card title="Wheatstone bridge">
        <svg viewBox="0 0 640 340" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Wheatstone bridge')}>
          <Wire
            pts={[
              [80, 50],
              [320, 50],
            ]}
            color={cT}
          />
          <Wire
            pts={[
              [220, 50],
              [220, 80],
            ]}
            color={cT}
          />
          <Wire
            pts={[
              [420, 50],
              [420, 80],
            ]}
            color={cT}
          />
          <Wire
            pts={[
              [220, 50],
              [420, 50],
            ]}
            color={cT}
          />
          <Sym a={[220, 80]} b={[220, 150]} kind="R" colorA={cT} colorB={cA} label="R₁" sub={si(s.B1, 'Ω')} side={-1} />
          <Sym a={[220, 190]} b={[220, 260]} kind="R" colorA={cA} colorB={c0} label="R₂" sub={si(s.B2, 'Ω')} side={-1} />
          <Sym a={[420, 80]} b={[420, 150]} kind="R" colorA={cT} colorB={cB} label="R₃" sub={si(s.B3, 'Ω')} side={1} />
          <Sym a={[420, 190]} b={[420, 260]} kind="R" colorA={cB} colorB={c0} label="R₄" sub={si(s.B4, 'Ω')} side={1} />
          <Wire
            pts={[
              [220, 150],
              [220, 190],
            ]}
            color={cA}
          />
          <Wire
            pts={[
              [420, 150],
              [420, 190],
            ]}
            color={cB}
          />
          <Wire
            pts={[
              [220, 170],
              [290, 170],
            ]}
            color={cA}
          />
          <Wire
            pts={[
              [350, 170],
              [420, 170],
            ]}
            color={cB}
          />
          <circle cx={320} cy={170} r={22} fill={EE.fill} stroke={EE.body} strokeWidth={2} />
          <line
            x1={320}
            y1={170}
            x2={320 + 16 * Math.sin(Math.max(-1.2, Math.min(1.2, b.Ig * 2000)))}
            y2={170 - 16 * Math.cos(Math.max(-1.2, Math.min(1.2, b.Ig * 2000)))}
            stroke={b.balanced ? EE.ok : EE.red}
            strokeWidth={2}
          />
          <Readout x={320} y={210}>
            {si(b.Ig, 'A')}
          </Readout>
          <Wire
            pts={[
              [290, 170],
              [298, 170],
            ]}
            color={cA}
          />
          <Wire
            pts={[
              [342, 170],
              [350, 170],
            ]}
            color={cB}
          />
          <Wire
            pts={[
              [220, 260],
              [220, 290],
              [80, 290],
              [80, 210],
            ]}
            color={c0}
          />
          <Wire
            pts={[
              [220, 290],
              [420, 290],
              [420, 260],
            ]}
            color={c0}
          />
          <Sym a={[80, 210]} b={[80, 130]} kind="V" colorA={c0} colorB={cT} label="U" sub={si(s.U, 'V')} side={1} />
          <Wire
            pts={[
              [80, 130],
              [80, 50],
            ]}
            color={cT}
          />
          <Dot p={[220, 50]} />
          <Dot p={[220, 170]} />
          <Dot p={[420, 170]} />
          <Dot p={[220, 290]} />
          <Charges
            pts={[
              [220, 50],
              [220, 170],
            ]}
            I={I1}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [220, 170],
              [220, 290],
            ]}
            I={I2}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [420, 50],
              [420, 170],
            ]}
            I={I3}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [420, 170],
              [420, 290],
            ]}
            I={I4}
            t={t0}
            k={k}
          />
          <Charges
            pts={[
              [220, 170],
              [420, 170],
            ]}
            I={b.Ig}
            t={t0}
            k={k}
          />
          <Readout x={200} y={174} anchor="end">
            {nf(b.Va, 3)} V
          </Readout>
          <Readout x={440} y={174} anchor="start">
            {nf(b.Vb, 3)} V
          </Readout>
        </svg>
      </Card>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Bridge voltage against the sensor resistance">
          <LineChartBox series={[{ name: 'U_d [mV]', data: curve }]} xLabel="R₄ [Ω]" yLabel="U_d [mV]" height={220} refX={[{ x: (s.B2 * s.B3) / s.B1, label: t('balanced') }]} />
          <p className="mt-1 text-[10px] text-plant-500">
            {t('Near balance the bridge voltage is almost proportional to the change of R₄ — a tiny change of a sensor resistance gives a clean signal around zero.')}
          </p>
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`U_a = U\\frac{R_2}{R_1+R_2} = ${nf(b.Va, 4)}\\,\\mathrm V,\\quad U_b = U\\frac{R_4}{R_3+R_4} = ${nf(b.Vb, 4)}\\,\\mathrm V`} />
            <Tex block math={`U_d = U_a - U_b = ${nf(b.Ud * 1000, 3)}\\,\\mathrm{mV}`} />
            <Tex block math={`\\text{${t('balanced')}: } U_d = 0 \\iff \\frac{R_1}{R_2} = \\frac{R_3}{R_4}`} />
            <Tex block math={`I_g = \\frac{U_d}{R_1\\parallel R_2 + R_3\\parallel R_4 + R_g} = ${nf(b.Ig * 1e6, 2)}\\,\\mu\\mathrm A`} />
          </div>
        </Card>
      </div>
    </>
  );
}
