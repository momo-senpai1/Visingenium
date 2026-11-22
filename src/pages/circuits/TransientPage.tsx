/** Charging and discharging a capacitor (RC) or building up the current in a coil (RL), switched periodically in slow motion. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { Charges, EE, EeLayout, Idea, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { firstOrder } from '@/lib/ee';

type Kind = 'rc' | 'rl';
interface S {
  kind: Kind;
  U: number;
  R: number;
  C: number; // µF
  L: number; // mH
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useTr = create<S>()(
  persist((set) => ({ kind: 'rc', U: 10, R: 1000, C: 100, L: 500, set: (p) => set(p) }), {
    name: 'ee-transient',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const HALF = 4; // seconds of animation per half cycle (= 5 τ)

export default function TransientPage() {
  const s = useTr();
  const x = s.kind === 'rc' ? s.C * 1e-6 : s.L * 1e-3;
  const tau = s.kind === 'rc' ? s.R * x : x / s.R;
  const ta = useAnimTime();
  const ph = ((ta % (2 * HALF)) + 2 * HALF) % (2 * HALF);
  const on = ph < HALF;
  const tt = ((on ? ph : ph - HALF) / HALF) * 5 * tau;
  const st = firstOrder(s.kind, s.R, x, s.U, on, tt);
  const curve = Array.from({ length: 121 }, (_, i) => {
    const ti = (i / 120) * 5 * tau;
    const v = firstOrder(s.kind, s.R, x, s.U, on, ti);
    return { t: ti, u: v.u, i: v.i };
  });
  const store = s.kind === 'rc' ? 'C' : 'L';
  const k = 4000 / Math.max(s.U / s.R, 1e-9) / 100; // visual speed independent of the scale
  const fill = s.kind === 'rc' ? st.u / Math.max(s.U, 1e-12) : st.i / Math.max(s.U / s.R, 1e-12);
  return (
    <EeLayout
      aside={
        <>
          <Card title="Switching RC and RL">
            <Idea>
              {s.kind === 'rc'
                ? t(
                    'A capacitor stores charge. When it is switched on, the current is large at first and falls as the capacitor fills up; its voltage rises along an e-curve. After one time constant τ = R·C it has 63 %, after 5 τ it is practically full.',
                  )
                : t(
                    'A coil resists any change of its current by inducing a counter-voltage. When it is switched on, the current grows along an e-curve; when it is switched off, the coil keeps the current flowing for a while. Time constant τ = L/R.',
                  )}
            </Idea>
            <Segmented<Kind>
              value={s.kind}
              onChange={(kind) => s.set({ kind })}
              options={[
                { value: 'rc', label: t('Capacitor (RC)') },
                { value: 'rl', label: t('Coil (RL)') },
              ]}
            />
          </Card>
          <Card title="Values">
            <div className="space-y-3">
              <ParamSlider label="Source voltage" symbol="U" unit="V" value={s.U} min={1} max={24} step={0.5} onChange={(U) => s.set({ U })} />
              <ParamSlider label="Resistor" symbol="R" unit="Ω" value={s.R} min={10} max={10000} step={10} digits={0} onChange={(R) => s.set({ R })} />
              {s.kind === 'rc' ? (
                <ParamSlider label="Capacitance" symbol="C" unit="µF" value={s.C} min={1} max={1000} step={1} digits={0} onChange={(C) => s.set({ C })} />
              ) : (
                <ParamSlider label="Inductance" symbol="L" unit="mH" value={s.L} min={1} max={2000} step={1} digits={0} onChange={(L) => s.set({ L })} />
              )}
              <p className="text-[10px] leading-relaxed text-plant-500">{t('The switch flips every 5 τ, shown in slow motion. Pause or scrub with the controls at the top right.')}</p>
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Time constant τ" value={si(tau, 's')} sub={s.kind === 'rc' ? '$\\tau = RC$' : '$\\tau = L/R$'} />
        <Kpi label={s.kind === 'rc' ? 'Capacitor voltage' : 'Coil current'} value={s.kind === 'rc' ? si(st.u, 'V') : si(st.i, 'A')} sub={`t = ${nf(tt / tau, 2)} τ`} />
        <Kpi label={s.kind === 'rc' ? 'Current' : 'Coil voltage'} value={s.kind === 'rc' ? si(st.i, 'A') : si(st.u, 'V')} />
        <Kpi label="Stored energy" value={si(st.W, 'J')} sub={s.kind === 'rc' ? '$W = \\tfrac12 C u^2$' : '$W = \\tfrac12 L i^2$'} />
      </div>
      <Card title={on ? 'Switched on' : 'Switched off'}>
        <svg viewBox="0 0 640 300" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('RC or RL circuit')}>
          {/* source branch */}
          <Sym a={[90, 220]} b={[90, 120]} kind="V" label="U" sub={si(s.U, 'V')} side={1} />
          <Wire
            pts={[
              [90, 120],
              [90, 60],
              [190, 60],
            ]}
          />
          <Wire
            pts={[
              [90, 220],
              [90, 260],
              [470, 260],
            ]}
          />
          {/* change-over switch: up = source, down = short */}
          <circle cx={190} cy={60} r={3} fill={EE.body} />
          <Wire
            pts={[
              [200, 140],
              [200, 260],
            ]}
          />
          <circle cx={200} cy={140} r={3} fill={EE.body} />
          <circle cx={250} cy={100} r={3} fill={EE.body} />
          <line x1={250} y1={100} x2={on ? 192 : 202} y2={on ? 62 : 138} stroke={EE.body} strokeWidth={2.5} />
          <Readout x={250} y={130} anchor="start" color={EE.muted}>
            {on ? t('on') : t('off')}
          </Readout>
          <Wire
            pts={[
              [250, 100],
              [290, 100],
              [290, 60],
              [310, 60],
            ]}
          />
          <Sym a={[310, 60]} b={[410, 60]} kind="R" label="R" sub={si(s.R, 'Ω')} side={-1} />
          <Wire
            pts={[
              [410, 60],
              [470, 60],
              [470, 120],
            ]}
          />
          <Sym a={[470, 120]} b={[470, 200]} kind={store} label={store} sub={s.kind === 'rc' ? si(x, 'F') : si(x, 'H')} side={-1} />
          <Wire
            pts={[
              [470, 200],
              [470, 260],
            ]}
          />
          <Charges
            pts={
              on
                ? [
                    [90, 260],
                    [90, 60],
                    [190, 60],
                    [250, 100],
                    [290, 100],
                    [290, 60],
                    [470, 60],
                    [470, 140],
                  ]
                : [
                    [200, 260],
                    [200, 140],
                    [250, 100],
                    [290, 100],
                    [290, 60],
                    [470, 60],
                    [470, 140],
                  ]
            }
            I={st.i}
            t={ta}
            k={k}
          />
          <Charges
            pts={
              on
                ? [
                    [470, 180],
                    [470, 260],
                    [90, 260],
                  ]
                : [
                    [470, 180],
                    [470, 260],
                    [200, 260],
                  ]
            }
            I={st.i}
            t={ta}
            k={k}
          />
          {/* storage visual */}
          {s.kind === 'rc' ? (
            <g>
              {Array.from({ length: Math.round(Math.abs(fill) * 5) }, (_, i) => (
                <text key={`p${i}`} x={456 + i * 7} y={150} textAnchor="middle" className="text-[10px] font-bold" style={{ fill: EE.red }}>
                  +
                </text>
              ))}
              {Array.from({ length: Math.round(Math.abs(fill) * 5) }, (_, i) => (
                <text key={`m${i}`} x={456 + i * 7} y={180} textAnchor="middle" className="text-[11px] font-bold" style={{ fill: EE.u }}>
                  −
                </text>
              ))}
              <rect x={560} y={100} width={16} height={140} rx={3} fill="none" stroke={EE.muted} />
              <rect x={560} y={100 + 140 * (1 - fill)} width={16} height={140 * fill} rx={3} fill={EE.u} opacity={0.7} />
              <Readout x={568} y={88} color={EE.u}>
                u_C = {si(st.u, 'V')}
              </Readout>
            </g>
          ) : (
            <g fill="none" stroke={EE.p} strokeOpacity={Math.min(1, Math.abs(fill))}>
              {[18, 30, 42].map((r) => (
                <ellipse key={r} cx={470} cy={160} rx={r + 8} ry={r * 1.4} strokeDasharray="4 4" strokeDashoffset={-ta * 20} />
              ))}
              <Readout x={530} y={110} anchor="start" color={EE.p}>
                {t('magnetic field')} ∝ i
              </Readout>
            </g>
          )}
          <Readout x={360} y={88}>
            i = {si(st.i, 'A')}
          </Readout>
        </svg>
      </Card>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Voltage and current over time">
          <LineChartBox
            height={240}
            series={[
              { name: s.kind === 'rc' ? 'u_C [V]' : 'u_L [V]', data: curve.map((p) => ({ x: p.t / tau, y: p.u })), color: EE.u },
              { name: s.kind === 'rc' ? 'i [mA]' : 'i [mA]', data: curve.map((p) => ({ x: p.t / tau, y: p.i * 1000 })), color: EE.i },
            ]}
            xLabel="t / τ"
            yLabel=""
            xDomain={[0, 5]}
            refX={[
              { x: 1, label: 'τ' },
              { x: tt / tau, label: '▼' },
            ]}
          />
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            {s.kind === 'rc' ? (
              <>
                <Tex block math={`\\tau = R\\,C = ${nf(s.R, 0)}\\,\\Omega\\cdot ${nf(s.C, 0)}\\,\\mu\\mathrm F = ${nf(tau * 1000, 3)}\\,\\mathrm{ms}`} />
                <Tex block math={on ? 'u_C(t) = U\\,(1 - e^{-t/\\tau}),\\quad i(t) = \\frac{U}{R}\\,e^{-t/\\tau}' : 'u_C(t) = U\\,e^{-t/\\tau},\\quad i(t) = -\\frac{U}{R}\\,e^{-t/\\tau}'} />
                <Tex block math={`t = ${nf(tt / tau, 2)}\\,\\tau:\\quad u_C = ${nf(st.u, 3)}\\,\\mathrm V,\\quad i = ${nf(st.i * 1000, 3)}\\,\\mathrm{mA}`} />
              </>
            ) : (
              <>
                <Tex block math={`\\tau = \\frac{L}{R} = \\frac{${nf(s.L, 0)}\\,\\mathrm{mH}}{${nf(s.R, 0)}\\,\\Omega} = ${nf(tau * 1000, 4)}\\,\\mathrm{ms}`} />
                <Tex block math={on ? 'i(t) = \\frac{U}{R}\\,(1 - e^{-t/\\tau}),\\quad u_L(t) = U\\,e^{-t/\\tau}' : 'i(t) = \\frac{U}{R}\\,e^{-t/\\tau},\\quad u_L(t) = -U\\,e^{-t/\\tau}'} />
                <Tex block math={`t = ${nf(tt / tau, 2)}\\,\\tau:\\quad i = ${nf(st.i * 1000, 3)}\\,\\mathrm{mA},\\quad u_L = ${nf(st.u, 3)}\\,\\mathrm V`} />
              </>
            )}
            <p className="pt-1 text-[10px] leading-relaxed text-plant-500">{t('Rule of thumb: after 1 τ 63 %, after 3 τ 95 %, after 5 τ more than 99 % of the final value.')}</p>
          </div>
        </Card>
      </div>
    </EeLayout>
  );
}
