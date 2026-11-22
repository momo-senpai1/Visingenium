/** Alternating current: a rotating phasor draws the sine; R, L and C shift the current against the voltage. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, Readout, si, useAnimTime } from '@/components/ee/common';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { cabs, carg, cdiv, cx, deg } from '@/lib/ee';

type El = 'R' | 'L' | 'C' | 'RL' | 'RC';
interface S {
  el: El;
  U: number;
  f: number;
  R: number;
  L: number; // mH
  C: number; // µF
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const usePh = create<S>()(
  persist((set) => ({ el: 'RL', U: 230, f: 50, R: 50, L: 200, C: 50, set: (p) => set(p) }), {
    name: 'ee-phasor',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const WV = (2 * Math.PI) / 4; // slow motion: one turn every 4 s

export default function PhasorPage() {
  const s = usePh();
  const w = 2 * Math.PI * s.f;
  const XL = w * s.L * 1e-3;
  const XC = 1 / (w * s.C * 1e-6);
  const Z = s.el === 'R' ? cx(s.R) : s.el === 'L' ? cx(0, XL) : s.el === 'C' ? cx(0, -XC) : s.el === 'RL' ? cx(s.R, XL) : cx(s.R, -XC);
  const I = cdiv(cx(s.U), Z);
  const phi = carg(Z); // u ahead of i by φ
  const ta = useAnimTime();
  const th = WV * ta;
  const Ihat = cabs(I) * Math.SQRT2;
  const Uhat = s.U * Math.SQRT2;
  // diagram geometry
  const C0 = [150, 160] as const;
  const r = 110;
  const iScale = r / Math.max(Ihat, 1e-12);
  const tip = (amp: number, ang: number): [number, number] => [C0[0] + amp * Math.cos(ang), C0[1] - amp * Math.sin(ang)];
  const uTip = tip(r, th);
  const iTip = tip(Ihat * iScale * 0.8, th - phi);
  const X0 = 300;
  const W = 320;
  const wave = (amp: number, off: number) => Array.from({ length: 161 }, (_, k) => `${X0 + (k / 160) * W},${C0[1] - amp * Math.sin(th - off - (k / 160) * 2 * Math.PI)}`).join(' ');
  const lag = deg(phi);
  return (
    <EeLayout
      aside={
        <>
          <Card title="Alternating current and phasors">
            <Idea>
              {t(
                'An alternating voltage is a rotating arrow (phasor) seen from the side: its height over time is the sine. With a resistor the current turns in step with the voltage. A coil makes the current lag by 90°, a capacitor makes it lead by 90°. Combinations lie in between — the angle is the phase shift φ.',
              )}
            </Idea>
            <Segmented<El>
              value={s.el}
              onChange={(el) => s.set({ el })}
              options={[
                { value: 'R', label: 'R' },
                { value: 'L', label: 'L' },
                { value: 'C', label: 'C' },
                { value: 'RL', label: 'R+L' },
                { value: 'RC', label: 'R+C' },
              ]}
            />
          </Card>
          <Card title="Values">
            <div className="space-y-3">
              <ParamSlider label="Voltage (rms)" symbol="U" unit="V" value={s.U} min={1} max={400} step={1} digits={0} onChange={(U) => s.set({ U })} />
              <ParamSlider label="Frequency" symbol="f" unit="Hz" value={s.f} min={1} max={1000} step={1} digits={0} onChange={(f) => s.set({ f })} />
              <ParamSlider label="Resistance" symbol="R" unit="Ω" value={s.R} min={1} max={1000} step={1} digits={0} disabled={s.el === 'L' || s.el === 'C'} onChange={(R) => s.set({ R })} />
              <ParamSlider label="Inductance" symbol="L" unit="mH" value={s.L} min={1} max={2000} step={1} digits={0} disabled={!s.el.includes('L')} onChange={(L) => s.set({ L })} />
              <ParamSlider label="Capacitance" symbol="C" unit="µF" value={s.C} min={1} max={1000} step={1} digits={0} disabled={!s.el.includes('C')} onChange={(C) => s.set({ C })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Impedance |Z|" value={si(cabs(Z), 'Ω')} sub={`${nf(Z.re, 2)} ${Z.im >= 0 ? '+' : '−'} j${nf(Math.abs(Z.im), 2)} Ω`} />
        <Kpi label="Current (rms)" value={si(cabs(I), 'A')} sub={`î = ${si(Ihat, 'A')}`} />
        <Kpi label="Phase shift φ" value={`${nf(lag, 1)}°`} sub={lag > 0.5 ? t('current lags (inductive)') : lag < -0.5 ? t('current leads (capacitive)') : t('in phase (resistive)')} />
        <Kpi label="Reactance" value={s.el.includes('L') ? si(XL, 'Ω') : s.el.includes('C') ? si(-XC, 'Ω') : '0 Ω'} sub={s.el.includes('L') ? '$X_L = \\omega L$' : s.el.includes('C') ? '$X_C = -1/(\\omega C)$' : ''} />
      </div>
      <Card title="Rotating phasor and sine">
        <svg viewBox="0 0 640 320" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Rotating phasors and sine curves')}>
          <defs>
            {[EE.u, EE.i].map((c, k) => (
              <marker key={k} id={`pa${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill={c} />
              </marker>
            ))}
          </defs>
          <circle cx={C0[0]} cy={C0[1]} r={r} fill="none" stroke="rgb(var(--plant-700))" strokeDasharray="3 4" />
          <line x1={20} y1={C0[1]} x2={X0 + W} y2={C0[1]} stroke="rgb(var(--plant-700))" />
          <line x1={C0[0]} y1={30} x2={C0[0]} y2={290} stroke="rgb(var(--plant-700))" />
          <line x1={X0} y1={30} x2={X0} y2={290} stroke="rgb(var(--plant-700))" />
          {/* projections */}
          <line x1={uTip[0]} y1={uTip[1]} x2={X0} y2={uTip[1]} stroke={EE.u} strokeOpacity={0.4} strokeDasharray="3 3" />
          <line x1={iTip[0]} y1={iTip[1]} x2={X0} y2={iTip[1]} stroke={EE.i} strokeOpacity={0.4} strokeDasharray="3 3" />
          <polyline points={wave(r, 0)} fill="none" stroke={EE.u} strokeWidth={2} />
          <polyline points={wave(Ihat * iScale * 0.8, phi)} fill="none" stroke={EE.i} strokeWidth={2} />
          {/* phase arc */}
          {Math.abs(phi) > 0.02 && (
            <path d={`M${tip(40, th)[0]},${tip(40, th)[1]} A40,40 0 0 ${phi > 0 ? 1 : 0} ${tip(40, th - phi)[0]},${tip(40, th - phi)[1]}`} fill="none" stroke={EE.text} strokeWidth={1.2} />
          )}
          <line x1={C0[0]} y1={C0[1]} x2={uTip[0]} y2={uTip[1]} stroke={EE.u} strokeWidth={3} markerEnd="url(#pa0)" />
          <line x1={C0[0]} y1={C0[1]} x2={iTip[0]} y2={iTip[1]} stroke={EE.i} strokeWidth={3} markerEnd="url(#pa1)" />
          <circle cx={X0} cy={uTip[1]} r={4} fill={EE.u} />
          <circle cx={X0} cy={iTip[1]} r={4} fill={EE.i} />
          <Readout x={uTip[0]} y={uTip[1] - 8} color={EE.u}>
            u
          </Readout>
          <Readout x={iTip[0]} y={iTip[1] - 8} color={EE.i}>
            i
          </Readout>
          <Readout x={X0 + 4} y={300} anchor="start" color={EE.muted}>
            ↑ {t('now')}
          </Readout>
          <Readout x={X0 + W} y={300} anchor="end" color={EE.muted}>
            {t('earlier')} → ({t('slow motion')})
          </Readout>
          <Readout x={C0[0]} y={300} color={EE.muted}>
            φ = {nf(lag, 1)}°
          </Readout>
        </svg>
        <p className="mt-1 text-[10px] text-plant-500">{t('The current is drawn to its own scale. Positive φ: the voltage arrow runs ahead of the current arrow.')}</p>
      </Card>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Why R, L and C behave differently">
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-plant-300">
            <li>
              <b className="text-plant-100">R</b> — {t('the current follows the voltage at every instant: i = u/R, φ = 0°.')}
            </li>
            <li>
              <b className="text-plant-100">L</b> —{' '}
              {t(
                'the coil voltage is proportional to the change of current, u = L·di/dt. The current is largest a quarter period after the voltage: it lags by 90°. Higher frequency → more resistance (X_L = ωL).',
              )}
            </li>
            <li>
              <b className="text-plant-100">C</b> —{' '}
              {t('the current is proportional to the change of voltage, i = C·du/dt. The current peaks first: it leads by 90°. Higher frequency → less resistance (X_C = 1/(ωC)).')}
            </li>
          </ul>
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`\\omega = 2\\pi f = ${nf(w, 2)}\\,\\mathrm{s^{-1}}`} />
            <Tex
              block
              math={`\\underline Z = ${nf(Z.re, 3)} ${Z.im >= 0 ? '+' : '-'} \\mathrm j\\,${nf(Math.abs(Z.im), 3)}\\,\\Omega,\\quad |\\underline Z| = \\sqrt{R^2 + X^2} = ${nf(cabs(Z), 3)}\\,\\Omega`}
            />
            <Tex block math={`\\varphi = \\arctan\\frac{X}{R} = ${nf(lag, 2)}^\\circ,\\quad I = \\frac{U}{|\\underline Z|} = ${nf(cabs(I), 4)}\\,\\mathrm A`} />
            <Tex block math={`u(t) = \\hat u \\sin(\\omega t),\\ \\hat u = \\sqrt2\\,U = ${nf(Uhat, 1)}\\,\\mathrm V;\\quad i(t) = \\hat\\imath \\sin(\\omega t - \\varphi)`} />
          </div>
        </Card>
      </div>
    </EeLayout>
  );
}
