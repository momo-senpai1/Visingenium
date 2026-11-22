/** Bipolar transistor in common-emitter connection: output characteristics, load line, operating point, switch and amplifier. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Charges, EE, EeLayout, Idea, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { bjtIc, bjtStage } from '@/lib/ee';

interface S {
  Ucc: number;
  Rc: number;
  Rb: number; // kΩ
  Ub: number;
  Ua: number;
  beta: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useBjt = create<S>()(
  persist((set) => ({ Ucc: 12, Rc: 1000, Rb: 22, Ub: 1.6, Ua: 0.3, beta: 150, set: (p) => set(p) }), {
    name: 'ee-transistor',
    version: 2,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const WV = (2 * Math.PI) / 4;

export default function TransistorPage() {
  const s = useBjt();
  const Rb = s.Rb * 1e3;
  const q = bjtStage(s.Ucc, s.Rc, Rb, s.Ub, s.beta);
  const ta = useAnimTime();
  const th = WV * ta;
  const dyn = bjtStage(s.Ucc, s.Rc, Rb, s.Ub + s.Ua * Math.sin(th), s.beta);
  // family of output curves around the operating point
  const IbMax = Math.max(q.Ib * 2, (s.Ucc / s.Rc / s.beta) * 1.2, 1e-6);
  const fam = [0.2, 0.4, 0.6, 0.8, 1].map((k) => {
    const Ib = k * IbMax;
    return { name: `I_B = ${si(Ib, 'A', 2)}`, data: Array.from({ length: 81 }, (_, i) => ({ x: (i / 80) * s.Ucc, y: 1000 * bjtIc(Ib, (i / 80) * s.Ucc, s.beta) })), color: 'rgb(var(--plant-500))' };
  });
  const loadLine = [
    { x: 0, y: (1000 * s.Ucc) / s.Rc },
    { x: s.Ucc, y: 0 },
  ];
  // time signals over one period
  const sig = Array.from({ length: 121 }, (_, k) => {
    const a = (k / 120) * 2 * Math.PI;
    const st = bjtStage(s.Ucc, s.Rc, Rb, s.Ub + s.Ua * Math.sin(a), s.beta);
    return { x: (k / 120) * 360, uin: s.Ua * Math.sin(a), uce: st.Uce - q.Uce };
  });
  const gain = s.Ua > 1e-6 ? (Math.max(...sig.map((p) => p.uce)) - Math.min(...sig.map((p) => p.uce))) / (2 * s.Ua) : 0;
  const clip = sig.some((p) => p.uce + q.Uce < 0.3) || sig.some((p) => bjtStage(s.Ucc, s.Rc, Rb, s.Ub + s.Ua * Math.sin((p.x * Math.PI) / 180), s.beta).region === 'cutoff');
  return (
    <EeLayout
      aside={
        <>
          <Card title="Transistor as switch and amplifier">
            <Idea>
              {t(
                'A small base current controls a large collector current: I_C ≈ β·I_B. As a switch it is either fully off (no base current) or fully on (saturation). As an amplifier it sits in the middle of its range, and a small input signal moves the operating point up and down the load line — the output swings much more, but upside down.',
              )}
            </Idea>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => s.set({ Ub: 0, Ua: 2.5, Rb: 10 })}
                className="rounded border border-white/[0.08] px-2 py-1 text-[11px] text-plant-300 hover:border-signal-liquid/40 hover:text-signal-liquid"
              >
                {t('Switch')}
              </button>
              <button
                type="button"
                onClick={() => s.set({ Ub: 1.6, Ua: 0.3, Rb: 22, Rc: 1000, Ucc: 12, beta: 150 })}
                className="rounded border border-white/[0.08] px-2 py-1 text-[11px] text-plant-300 hover:border-signal-liquid/40 hover:text-signal-liquid"
              >
                {t('Amplifier')}
              </button>
            </div>
          </Card>
          <Card title="Values">
            <div className="space-y-3">
              <ParamSlider label="Supply voltage" symbol="U_CC" unit="V" value={s.Ucc} min={3} max={24} step={0.5} onChange={(Ucc) => s.set({ Ucc })} />
              <ParamSlider label="Collector resistor" symbol="R_C" unit="Ω" value={s.Rc} min={100} max={10000} step={10} digits={0} onChange={(Rc) => s.set({ Rc })} />
              <ParamSlider label="Base resistor" symbol="R_B" unit="kΩ" value={s.Rb} min={1} max={1000} step={1} digits={0} onChange={(v) => s.set({ Rb: v })} />
              <ParamSlider label="Base bias voltage" symbol="U_B" unit="V" value={s.Ub} min={0} max={5} step={0.05} digits={2} onChange={(Ub) => s.set({ Ub })} />
              <ParamSlider label="Input signal amplitude" symbol="û_in" unit="V" value={s.Ua} min={0} max={3} step={0.01} digits={2} onChange={(Ua) => s.set({ Ua })} />
              <ParamSlider label="Current gain" symbol="β" value={s.beta} min={20} max={500} step={5} digits={0} onChange={(beta) => s.set({ beta })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Base current" value={si(q.Ib, 'A')} />
        <Kpi label="Collector current" value={si(q.Ic, 'A')} sub={`β·I_B = ${si(s.beta * q.Ib, 'A')}`} />
        <Kpi label="U_CE" value={si(q.Uce, 'V')} />
        <Kpi label="Region" value={t(q.region)} sub={q.region === 'active' ? t('amplifier') : t('switch')} />
        <Kpi label="Voltage gain" value={nf(gain, 1)} sub={t('output swing / input swing')} />
      </div>
      {clip && s.Ua > 0 && (
        <Notice tone="warning">{t('The signal is clipped: the operating point hits saturation or cut-off. Lower the input amplitude or move the bias into the middle of the load line.')}</Notice>
      )}
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Circuit">
          <svg viewBox="0 0 520 300" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Common-emitter stage')}>
            <Wire
              pts={[
                [60, 30],
                [460, 30],
              ]}
              color={EE.red}
            />
            <Readout x={466} y={34} anchor="start" color={EE.red}>
              +{nf(s.Ucc, 1)} V
            </Readout>
            <Wire
              pts={[
                [375, 30],
                [375, 50],
              ]}
            />
            <Sym a={[375, 50]} b={[375, 110]} kind="R" label="R_C" sub={si(s.Rc, 'Ω')} side={1} />
            <Wire
              pts={[
                [375, 110],
                [375, 140],
              ]}
            />
            <circle cx={362} cy={170} r={30} fill="none" stroke={EE.body} strokeWidth={1.5} />
            <line x1={350} y1={150} x2={350} y2={190} stroke={EE.body} strokeWidth={3} />
            <line x1={350} y1={162} x2={375} y2={140} stroke={EE.body} strokeWidth={2} />
            <line x1={350} y1={178} x2={375} y2={200} stroke={EE.body} strokeWidth={2} />
            <path d="M375,200 l-10,-2 l5,-7 z" fill={EE.body} />
            <Wire
              pts={[
                [375, 200],
                [375, 270],
                [60, 270],
              ]}
            />
            <Sym a={[240, 170]} b={[320, 170]} kind="R" label="R_B" sub={si(Rb, 'Ω')} side={-1} />
            <Wire
              pts={[
                [320, 170],
                [350, 170],
              ]}
            />
            <Wire
              pts={[
                [160, 170],
                [240, 170],
              ]}
            />
            <Sym a={[160, 250]} b={[160, 170]} kind="AC" label="u_B" sub={`${nf(s.Ub + s.Ua * Math.sin(th), 2)} V`} side={1} />
            <Wire
              pts={[
                [160, 250],
                [160, 270],
              ]}
            />
            <Charges
              pts={[
                [375, 30],
                [375, 140],
                [375, 200],
                [375, 270],
              ]}
              I={dyn.Ic}
              t={ta}
              k={60 / Math.max(s.Ucc / s.Rc, 1e-9)}
            />
            <Charges
              pts={[
                [160, 170],
                [350, 170],
              ]}
              I={dyn.Ib}
              t={ta}
              k={60 / Math.max(s.Ucc / s.Rc / s.beta, 1e-12)}
              spacing={30}
            />
            <Readout x={385} y={128} anchor="start" color={EE.i}>
              I_C = {si(dyn.Ic, 'A')}
            </Readout>
            <Readout x={255} y={200} color={EE.i}>
              I_B = {si(dyn.Ib, 'A')}
            </Readout>
            <Readout x={420} y={175} anchor="start" color={EE.u}>
              U_CE = {nf(dyn.Uce, 2)} V
            </Readout>
            <Readout x={420} y={195} anchor="start" color={EE.muted}>
              {t(dyn.region)}
            </Readout>
          </svg>
        </Card>
        <Card title="Output characteristics and load line">
          <LineChartBox
            height={260}
            series={[
              ...fam,
              { name: t('load line'), data: loadLine, color: EE.u },
              {
                name: 'Q',
                data: [
                  { x: q.Uce, y: q.Ic * 1000 },
                  { x: q.Uce + 1e-6, y: q.Ic * 1000 },
                ],
                color: EE.ok,
              },
              {
                name: t('now'),
                data: [
                  { x: dyn.Uce, y: 0 },
                  { x: dyn.Uce, y: dyn.Ic * 1000 },
                ],
                color: EE.i,
              },
            ]}
            xLabel="U_CE [V]"
            yLabel="I_C [mA]"
            refX={[{ x: q.Uce, label: 'Q' }]}
          />
          <p className="mt-1 text-[10px] text-plant-500">
            {t('Grey: one curve per base current. Blue line: every point the resistor R_C allows. The operating point Q sits where both meet; the orange marker moves with the input signal.')}
          </p>
        </Card>
      </div>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Input and output signal">
          <LineChartBox
            height={220}
            series={[
              { name: 'u_in [V]', data: sig.map((p) => ({ x: p.x, y: p.uin })), color: EE.muted },
              { name: 'Δu_CE [V]', data: sig.map((p) => ({ x: p.x, y: p.uce })), color: EE.u },
            ]}
            xLabel={t('phase [°]')}
            yLabel=""
            digits={0}
            refX={[{ x: ((((th * 180) / Math.PI) % 360) + 360) % 360, label: '▼' }]}
          />
          <p className="mt-1 text-[10px] text-plant-500">{t('The output is inverted: more base current → more collector current → more voltage across R_C → less U_CE.')}</p>
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`I_B = \\frac{U_B - 0.7\\,\\mathrm V}{R_B} = ${nf(q.Ib * 1e6, 2)}\\,\\mu\\mathrm A`} />
            <Tex block math={`I_C \\approx \\beta I_B = ${nf(s.beta * q.Ib * 1000, 3)}\\,\\mathrm{mA}${q.region === 'saturation' ? '\\ (\\text{' + t('limited') + '})' : ''}`} />
            <Tex block math={`U_{CE} = U_{CC} - R_C I_C = ${nf(q.Uce, 3)}\\,\\mathrm V`} />
            <Tex block math={`I_{C,\\max} = \\frac{U_{CC}}{R_C} = ${nf((s.Ucc / s.Rc) * 1000, 2)}\\,\\mathrm{mA}\\ (\\text{${t('saturation')}})`} />
          </div>
        </Card>
      </div>
    </EeLayout>
  );
}
