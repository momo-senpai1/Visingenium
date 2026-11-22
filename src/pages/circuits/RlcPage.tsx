/** Series resonant circuit: resonance curve, quality factor, phasor diagram and the energy swinging between L and C. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, PhasorPlot, Readout, si, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { cabs, cadd, carg, deg, seriesRLC } from '@/lib/ee';

interface S {
  U: number;
  R: number;
  L: number; // mH
  C: number; // µF
  f: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useRlc = create<S>()(
  persist((set) => ({ U: 10, R: 20, L: 100, C: 10, f: 120, set: (p) => set(p) }), { name: 'ee-rlc', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, ...r }) => r }),
);

export default function RlcPage() {
  const s = useRlc();
  const L = s.L * 1e-3;
  const C = s.C * 1e-6;
  const r = seriesRLC(s.R, L, C, s.U, s.f);
  const ta = useAnimTime();
  const rot = ((2 * Math.PI) / 6) * ta;
  const fmin = r.f0 / 20;
  const fmax = r.f0 * 20;
  const curve = Array.from({ length: 300 }, (_, k) => {
    const f = fmin * (fmax / fmin) ** (k / 299);
    const x = seriesRLC(s.R, L, C, s.U, f);
    return { f, I: cabs(x.I), phi: deg(x.phi), UL: cabs(x.UL), UC: cabs(x.UC) };
  });
  // energy in L and C over one (slow-motion) period: total constant at resonance
  const th = ((2 * Math.PI) / 3) * ta;
  const Ihat = cabs(r.I) * Math.SQRT2;
  const WL = 0.5 * L * (Ihat * Math.sin(th)) ** 2;
  const WC = 0.5 * C * (cabs(r.UC) * Math.SQRT2 * Math.cos(th)) ** 2;
  const Wmax = Math.max(1e-15, 0.5 * L * Ihat * Ihat, 0.5 * C * (cabs(r.UC) * Math.SQRT2) ** 2);
  return (
    <EeLayout
      aside={
        <>
          <Card title="Resonant circuit (series RLC)">
            <Idea>
              {t(
                'Coil and capacitor work against each other: the coil resists more at high frequency, the capacitor at low frequency. At one frequency — the resonance f₀ — they cancel exactly. The current is then largest and limited only by R, and energy swings back and forth between the magnetic field of the coil and the electric field of the capacitor, like a pendulum.',
              )}
            </Idea>
          </Card>
          <Card title="Values">
            <div className="space-y-3">
              <ParamSlider label="Voltage (rms)" symbol="U" unit="V" value={s.U} min={1} max={50} step={0.5} onChange={(U) => s.set({ U })} />
              <ParamSlider label="Resistance" symbol="R" unit="Ω" value={s.R} min={1} max={500} step={1} digits={0} onChange={(R) => s.set({ R })} />
              <ParamSlider label="Inductance" symbol="L" unit="mH" value={s.L} min={1} max={1000} step={1} digits={0} onChange={(v) => s.set({ L: v })} />
              <ParamSlider label="Capacitance" symbol="C" unit="µF" value={s.C} min={0.1} max={100} step={0.1} onChange={(v) => s.set({ C: v })} />
              <ParamSlider label="Frequency" symbol="f" unit="Hz" value={s.f} min={1} max={5000} step={1} digits={0} onChange={(f) => s.set({ f })} />
              <button type="button" onClick={() => s.set({ f: Math.round(r.f0 * 10) / 10 })} className="text-[11px] text-signal-liquid hover:underline">
                {t('Tune to resonance')} (f₀ = {nf(r.f0, 1)} Hz)
              </button>
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Resonance f₀" value={si(r.f0, 'Hz')} sub="$f_0 = 1/(2\pi\sqrt{LC})$" />
        <Kpi label="Quality factor Q" value={nf(r.Q, 2)} sub={`${t('bandwidth')} ${si(r.B, 'Hz')}`} />
        <Kpi label="Current" value={si(cabs(r.I), 'A')} sub={`${t('max')} ${si(s.U / s.R, 'A')}`} />
        <Kpi label="Phase φ" value={`${nf(deg(r.phi), 1)}°`} sub={s.f < r.f0 * 0.995 ? t('capacitive') : s.f > r.f0 * 1.005 ? t('inductive') : t('resonance')} />
        <Kpi label="Voltage across L" value={si(cabs(r.UL), 'V')} sub={`${nf(cabs(r.UL) / s.U, 2)} × U`} />
      </div>
      {cabs(r.UL) > 3 * s.U && <Notice tone="warning">{t('Voltage rise: near resonance the voltage across L and C is Q times the source voltage. Components must be rated for it.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Resonance curve">
          <LineChartBox
            height={260}
            logX
            series={[
              { name: 'I / I_max', data: curve.map((p) => ({ x: p.f, y: (p.I * s.R) / s.U })), color: EE.i },
              { name: 'U_L / U', data: curve.map((p) => ({ x: p.f, y: p.UL / s.U })), color: EE.p, dashed: true },
              { name: 'U_C / U', data: curve.map((p) => ({ x: p.f, y: p.UC / s.U })), color: EE.u, dashed: true },
            ]}
            xLabel="f [Hz]"
            yLabel=""
            refX={[
              { x: r.f0, label: 'f₀' },
              { x: s.f, label: 'f' },
            ]}
          />
          <LineChartBox height={160} logX series={[{ name: 'φ [°]', data: curve.map((p) => ({ x: p.f, y: p.phi })) }]} xLabel="f [Hz]" yLabel="°" digits={0} refX={[{ x: s.f, label: 'f' }]} />
        </Card>
        <div className="space-y-2">
          <Card title="Phasor diagram at f">
            <PhasorPlot
              rot={rot}
              items={[
                { v: r.UR, color: EE.ok, label: 'U_R' },
                { v: r.UL, from: r.UR, color: EE.p, label: 'U_L' },
                { v: r.UC, from: cadd(r.UR, r.UL), color: EE.u, label: 'U_C' },
                { v: { re: s.U, im: 0 }, color: EE.text, label: '', dashed: true },
              ]}
            />
            <p className="text-[10px] text-plant-500">
              {t('U_L and U_C point in opposite directions; their difference plus U_R gives U (dashed).')} φ = {nf(deg(carg(r.Z)), 1)}°
            </p>
          </Card>
          <Card title="Energy pendulum">
            <svg viewBox="0 0 300 120" className="mx-auto h-auto w-full max-w-[340px]" role="img" aria-label={t('Energy in coil and capacitor')}>
              {[
                ['W_L', WL, EE.p, 40],
                ['W_C', WC, EE.u, 140],
                ['Σ', WL + WC, EE.text, 240],
              ].map(([l, v, c, x]) => (
                <g key={l as string}>
                  <rect x={x as number} y={100 - 80 * Math.min(1.2, (v as number) / Wmax)} width={36} height={80 * Math.min(1.2, (v as number) / Wmax)} fill={c as string} opacity={0.75} />
                  <Readout x={(x as number) + 18} y={114}>
                    {l as string}
                  </Readout>
                </g>
              ))}
            </svg>
            <p className="text-[10px] text-plant-500">{t('At resonance the sum stays constant: the source only has to cover the losses in R.')}</p>
          </Card>
        </div>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`f_0 = \\frac{1}{2\\pi\\sqrt{LC}} = ${nf(r.f0, 2)}\\,\\mathrm{Hz}`} />
          <Tex block math={`Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}} = ${nf(r.Q, 3)},\\quad B = \\frac{f_0}{Q} = ${nf(r.B, 2)}\\,\\mathrm{Hz}`} />
          <Tex
            block
            math={`\\underline Z = R + \\mathrm j\\left(\\omega L - \\frac{1}{\\omega C}\\right) = ${nf(r.Z.re, 2)} ${r.Z.im >= 0 ? '+' : '-'} \\mathrm j\\,${nf(Math.abs(r.Z.im), 2)}\\,\\Omega`}
          />
          <Tex block math={`I = \\frac{U}{|\\underline Z|} = ${nf(cabs(r.I) * 1000, 3)}\\,\\mathrm{mA}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
