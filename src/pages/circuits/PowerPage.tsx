/** Active, reactive and apparent power: p(t) = u·i, the power triangle and power-factor correction. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, Readout, si, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Toggle } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { acPower, rad } from '@/lib/ee';

interface S {
  U: number;
  I: number;
  phi: number; // degrees
  f: number;
  comp: boolean;
  cos2: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const usePw = create<S>()(
  persist((set) => ({ U: 230, I: 10, phi: 40, f: 50, comp: false, cos2: 0.95, set: (p) => set(p) }), {
    name: 'ee-power',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

export default function PowerPage() {
  const s = usePw();
  const p = acPower(s.U, s.I, rad(s.phi), s.f, s.comp ? s.cos2 : Math.cos(rad(s.phi)));
  const ta = useAnimTime();
  const T = 1 / s.f;
  const Uh = s.U * Math.SQRT2;
  const Ih = s.I * Math.SQRT2;
  const w = 2 * Math.PI * s.f;
  const pts = Array.from({ length: 241 }, (_, k) => {
    const tt = (k / 240) * 2 * T;
    const u = Uh * Math.sin(w * tt);
    const i = Ih * Math.sin(w * tt - rad(s.phi));
    return { t: tt * 1000, u, i, p: u * i };
  });
  const cursor = (((ta / 4) % 2) * T * 1000) % (2 * T * 1000);
  const Qafter = p.Q - (s.comp ? p.Qc : 0);
  return (
    <EeLayout
      aside={
        <>
          <Card title="Power in AC circuits">
            <Idea>
              {t(
                'With alternating current, power p = u·i pulses at twice the mains frequency. Its average is the active power P that really does work. When current and voltage are shifted, part of the energy only sloshes back and forth between source and load: reactive power Q. It loads the cables without doing work. Capacitors next to a motor supply this reactive power locally — power-factor correction.',
              )}
            </Idea>
          </Card>
          <Card title="Load">
            <div className="space-y-3">
              <ParamSlider label="Voltage (rms)" symbol="U" unit="V" value={s.U} min={10} max={400} step={1} digits={0} onChange={(U) => s.set({ U })} />
              <ParamSlider label="Current (rms)" symbol="I" unit="A" value={s.I} min={0.1} max={50} step={0.1} onChange={(I) => s.set({ I })} />
              <ParamSlider label="Phase shift (+ inductive, − capacitive)" symbol="φ" unit="°" value={s.phi} min={-90} max={90} step={1} digits={0} onChange={(phi) => s.set({ phi })} />
              <ParamSlider label="Frequency" symbol="f" unit="Hz" value={s.f} min={16} max={400} step={1} digits={0} onChange={(f) => s.set({ f })} />
            </div>
          </Card>
          <Card title="Power-factor correction">
            <div className="space-y-3">
              <Toggle checked={s.comp} onChange={(comp) => s.set({ comp })} label={t('Add a capacitor in parallel')} />
              <ParamSlider label="Target power factor" symbol="cos φ₂" value={s.cos2} min={0.5} max={1} step={0.01} digits={2} disabled={!s.comp} onChange={(cos2) => s.set({ cos2 })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Active power P" value={si(p.P, 'W')} />
        <Kpi label="Reactive power Q" value={si(p.Q, 'var')} sub={s.comp ? `→ ${si(Qafter, 'var')}` : undefined} />
        <Kpi label="Apparent power S" value={si(p.S, 'VA')} sub={s.comp ? `→ ${si(Math.hypot(p.P, Qafter), 'VA')}` : undefined} />
        <Kpi label="Power factor" value={nf(p.cos, 3)} sub={s.comp ? `→ ${nf(p.P / Math.max(Math.hypot(p.P, Qafter), 1e-12), 3)}` : 'cos φ'} />
        <Kpi label={s.comp ? 'Capacitor needed' : 'Line current'} value={s.comp ? si(p.C, 'F') : si(s.I, 'A')} sub={s.comp ? `I: ${si(s.I, 'A')} → ${si(p.Iafter, 'A')}` : undefined} />
      </div>
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Voltage, current and power over two periods">
          <LineChartBox
            height={280}
            series={[
              { name: 'u [V]', data: pts.map((x) => ({ x: x.t, y: x.u })), color: EE.u },
              { name: 'i · 10 [A]', data: pts.map((x) => ({ x: x.t, y: x.i * 10 })), color: EE.i },
              { name: 'p / 10 [W]', data: pts.map((x) => ({ x: x.t, y: x.p / 10 })), color: EE.p },
              { name: 'P / 10 [W]', data: pts.map((x) => ({ x: x.t, y: p.P / 10 })), color: EE.ok, dashed: true },
            ]}
            xLabel="t [ms]"
            yLabel=""
            digits={1}
            refX={[{ x: cursor, label: '▼' }]}
          />
          <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
            {t('Where p is negative the load gives energy back to the source. The larger φ, the more of the curve dips below zero; at φ = ±90° the average is zero — pure reactive power.')}
          </p>
        </Card>
        <Card title="Power triangle">
          <Triangle P={p.P} Q={p.Q} Q2={s.comp ? Qafter : null} />
          <div className="mt-2 space-y-1 text-[13px] text-plant-100">
            <Tex block math={`P = U I\\cos\\varphi = ${nf(p.P, 1)}\\,\\mathrm W`} />
            <Tex block math={`Q = U I\\sin\\varphi = ${nf(p.Q, 1)}\\,\\mathrm{var}`} />
            <Tex block math={`S = U I = \\sqrt{P^2 + Q^2} = ${nf(p.S, 1)}\\,\\mathrm{VA}`} />
            {s.comp && <Tex block math={`C = \\frac{P(\\tan\\varphi_1 - \\tan\\varphi_2)}{\\omega U^2} = ${nf(p.C * 1e6, 1)}\\,\\mu\\mathrm F`} />}
          </div>
        </Card>
      </div>
    </EeLayout>
  );
}

function Triangle({ P, Q, Q2 }: { P: number; Q: number; Q2: number | null }) {
  const W = 340;
  const H = 220;
  const m = Math.max(Math.abs(P), Math.abs(Q), 1e-9);
  const sc = 150 / m;
  const x0 = 40;
  const y0 = Q >= 0 ? 190 : 30;
  const xP = x0 + P * sc;
  const yQ = y0 - Q * sc;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[380px]" role="img" aria-label={t('Power triangle')}>
      <defs>
        {[EE.ok, EE.p, EE.text, EE.u].map((c, k) => (
          <marker key={k} id={`pt${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={c} />
          </marker>
        ))}
      </defs>
      <line x1={x0} y1={y0} x2={xP} y2={y0} stroke={EE.ok} strokeWidth={2.5} markerEnd="url(#pt0)" />
      <line x1={xP} y1={y0} x2={xP} y2={yQ} stroke={EE.p} strokeWidth={2.5} markerEnd="url(#pt1)" />
      <line x1={x0} y1={y0} x2={xP} y2={yQ} stroke={EE.text} strokeWidth={2.5} markerEnd="url(#pt2)" />
      {Q2 !== null && (
        <>
          <line x1={xP + 4} y1={yQ} x2={xP + 4} y2={y0 - Q2 * sc} stroke={EE.u} strokeWidth={2} strokeDasharray="4 3" markerEnd="url(#pt3)" />
          <line x1={x0} y1={y0} x2={xP} y2={y0 - Q2 * sc} stroke={EE.u} strokeWidth={2} strokeDasharray="4 3" />
          <Readout x={xP + 10} y={(yQ + y0 - Q2 * sc) / 2} anchor="start" color={EE.u}>
            Q_C
          </Readout>
        </>
      )}
      <Readout x={(x0 + xP) / 2} y={y0 + (Q >= 0 ? 16 : -8)} color={EE.ok}>
        P = {si(P, 'W')}
      </Readout>
      <Readout x={xP + 8} y={(y0 + yQ) / 2 + (Q2 !== null ? 14 : 0)} anchor="start" color={EE.p}>
        Q = {si(Q, 'var')}
      </Readout>
      <Readout x={(x0 + xP) / 2 - 14} y={(y0 + yQ) / 2 - 6} anchor="end" color={EE.text}>
        S
      </Readout>
    </svg>
  );
}
