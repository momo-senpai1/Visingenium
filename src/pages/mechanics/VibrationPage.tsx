/** TM 3: single-degree-of-freedom vibrations — free (damped) and forced response, magnification function, resonance. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { magnification, oscParams, simulate } from '@/engine/mechanics/dynamics';

const useVib = paramStore('tm-vibration', { m: 1, c: 400, d: 4, x0: 20, v0: 0, F: 0, eta: 1 });

export default function VibrationPage() {
  const s = useVib();
  const o = { m: s.m, c: s.c, d: s.d };
  const p = oscParams(o);
  const Om = s.eta * p.w0;
  const Fn = s.F; // N
  const tEnd = Math.min(60, Math.max(8 * (2 * Math.PI) / p.w0, Number.isFinite(1 / p.delta) ? 4 / Math.max(p.delta, 1e-3) : 10));
  const sim = simulate(o, s.x0 / 1000, s.v0, Fn, Om, tEnd, 1200);
  const ta = useAnimTime();
  // play the simulation in slow motion so one period takes ~1.5 s on screen
  const slow = (2 * Math.PI) / p.w0 / 1.5;
  const tNow = (ta * slow) % tEnd;
  const idx = Math.min(sim.length - 1, Math.round((tNow / tEnd) * (sim.length - 1)));
  const xNow = sim[idx]!.x;
  const xmax = Math.max(1e-9, ...sim.map((q) => Math.abs(q.x)));
  const mag = magnification(s.eta, p.D);
  const xStat = Fn / s.c;
  const env = p.D < 1 ? sim.filter((_, i) => i % 6 === 0).map((q) => ({ x: q.t, y: (Math.hypot(s.x0 / 1000, (s.v0 + p.delta * (s.x0 / 1000)) / (p.wd || 1)) * Math.exp(-p.delta * q.t)) * 1000 })) : [];
  const Vcurves = [0.05, 0.1, 0.2, 0.5, 1].map((D) => ({
    name: `D = ${D}`,
    data: Array.from({ length: 151 }, (_, i) => ({ x: i * 0.02, y: Math.min(12, magnification(i * 0.02, D).V) })),
    dashed: true,
  }));
  const own = Array.from({ length: 151 }, (_, i) => ({ x: i * 0.02, y: Math.min(12, magnification(i * 0.02, p.D).V) }));
  const phase = Array.from({ length: 151 }, (_, i) => ({ x: i * 0.02, y: magnification(i * 0.02, p.D).psi }));

  // drawing: wall at top, spring and damper, mass below
  const yEq = 160;
  const yM = yEq + (xNow / xmax) * 60;
  const spring = (x: number, y0: number, y1: number) => {
    const n = 10;
    const pts = [`${x},${y0}`, `${x},${y0 + 10}`];
    for (let i = 0; i < n; i++) pts.push(`${x + (i % 2 ? -12 : 12)},${y0 + 10 + ((y1 - y0 - 20) * (i + 0.5)) / n}`);
    pts.push(`${x},${y1 - 10}`, `${x},${y1}`);
    return pts.join(' ');
  };
  const regime = p.D < 1 ? t('underdamped') : p.D === 1 ? t('critically damped') : t('overdamped');

  return (
    <EeLayout
      aside={
        <>
          <Card title="Mechanical vibrations">
            <Idea>
              {t(
                'Mass, spring and damper give the equation of motion m ẍ + d ẋ + c x = F(t). Without load the mass oscillates at its natural frequency ω₀ = √(c/m); damping lets the amplitude decay with e^(−δt). The damping ratio D = δ/ω₀ tells the regime: D < 1 oscillates, D ≥ 1 creeps back. Driven at Ω, the steady amplitude is the static deflection times the magnification V(η), η = Ω/ω₀ — near η = 1 lies resonance, limited only by damping.',
              )}
            </Idea>
          </Card>
          <Card title="Oscillator">
            <div className="space-y-3">
              <ParamSlider label="Mass" symbol="m" unit="kg" value={s.m} min={0.1} max={10} step={0.1} onChange={(m) => s.set({ m })} />
              <ParamSlider label="Spring stiffness" symbol="c" unit="N/m" value={s.c} min={10} max={2000} step={10} digits={0} onChange={(c) => s.set({ c })} />
              <ParamSlider label="Damping constant" symbol="d" unit="Ns/m" value={s.d} min={0} max={100} step={0.5} onChange={(d) => s.set({ d })} />
              <ParamSlider label="Initial displacement" symbol="x₀" unit="mm" value={s.x0} min={-50} max={50} step={1} digits={0} onChange={(x0) => s.set({ x0 })} />
              <ParamSlider label="Initial velocity" symbol="v₀" unit="m/s" value={s.v0} min={-1} max={1} step={0.01} digits={2} onChange={(v0) => s.set({ v0 })} />
            </div>
          </Card>
          <Card title="Excitation F(t) = F̂ cos Ωt">
            <div className="space-y-3">
              <ParamSlider label="Force amplitude" symbol="F̂" unit="N" value={s.F} min={0} max={50} step={0.5} onChange={(F) => s.set({ F })} />
              <ParamSlider label="Frequency ratio" symbol="η" value={s.eta} min={0} max={3} step={0.01} digits={2} onChange={(eta) => s.set({ eta })} />
              <button type="button" className="text-[11px] text-signal-liquid hover:underline" onClick={() => s.set({ eta: 1 })}>
                {t('Excite at resonance')}
              </button>
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="ω₀" value={nf(p.w0, 2)} unit="1/s" sub={`f₀ = ${nf(p.f0, 2)} Hz`} />
        <Kpi label="Decay rate δ" value={nf(p.delta, 3)} unit="1/s" />
        <Kpi label="Damping ratio D" value={nf(p.D, 3)} sub={regime} />
        <Kpi label="ω_d" value={p.D < 1 ? nf(p.wd, 2) : '–'} unit={p.D < 1 ? '1/s' : undefined} sub={p.D < 1 ? `T_d = ${nf(p.T, 3)} s` : undefined} />
        <Kpi label="Steady amplitude" value={s.F > 0 ? nf(xStat * mag.V * 1000, 2) : '–'} unit={s.F > 0 ? 'mm' : undefined} sub={s.F > 0 ? `V = ${nf(mag.V, 2)}, ψ = ${nf(mag.psi, 0)}°` : t('no excitation')} />
      </div>
      {s.F > 0 && Math.abs(s.eta - 1) < 0.05 && p.D < 0.1 && <Notice tone="warning">{t('Resonance with little damping: the amplitude builds up to many times the static deflection.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card title="Spring–mass–damper">
          <svg viewBox="0 0 220 300" className="mx-auto h-auto w-full max-w-[240px]" role="img" aria-label={t('Spring–mass–damper system')}>
            <rect x={30} y={14} width={160} height={10} fill="url(#hatchV)" stroke={TM.ground} />
            <defs>
              <pattern id="hatchV" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--plant-500))" strokeWidth="1.5" />
              </pattern>
            </defs>
            <polyline points={spring(75, 24, yM - 25)} fill="none" stroke={TM.body} strokeWidth={2} />
            {/* damper: cylinder fixed at the top, piston moves with the mass */}
            <line x1={145} y1={24} x2={145} y2={80} stroke={TM.body} strokeWidth={2} />
            <path d={`M130,80 V120 H160 V80`} fill="none" stroke={TM.body} strokeWidth={2} />
            <line x1={134} y1={Math.min(116, yM - 25 - 40)} x2={156} y2={Math.min(116, yM - 25 - 40)} stroke={TM.body} strokeWidth={3} />
            <line x1={145} y1={Math.min(116, yM - 25 - 40)} x2={145} y2={yM - 25} stroke={TM.body} strokeWidth={2} />
            <rect x={50} y={yM - 25} width={120} height={50} rx={4} fill={TM.fill} stroke={TM.body} strokeWidth={1.5} />
            <Label x={110} y={yM + 5}>
              m
            </Label>
            <Label x={60} y={60} anchor="end" color={TM.muted}>
              c
            </Label>
            <Label x={172} y={100} anchor="start" color={TM.muted}>
              d
            </Label>
            <line x1={10} y1={yEq} x2={210} y2={yEq} stroke={TM.reaction} strokeDasharray="4 4" strokeOpacity={0.6} />
            {s.F > 0 && <Arrow a={[110, yM + 30]} b={[110, yM + 30 + 30 * Math.cos(Om * tNow)]} color={TM.load} label="F(t)" />}
            <Label x={205} y={292} anchor="end" color={TM.muted} size={10}>{`t = ${nf(tNow, 2)} s`}</Label>
          </svg>
          <Caption>{t('Dashed: static equilibrium position. The animation plays the computed motion in slow motion.')}</Caption>
        </Card>
        <Card title="Response x(t)">
          <LineChartBox
            height={270}
            series={[
              { name: 'x(t) [mm]', data: sim.filter((_, i) => i % 2 === 0).map((q) => ({ x: q.t, y: q.x * 1000 })), color: TM.v },
              ...(s.F === 0 && env.length ? [{ name: t('envelope ±x̂ e^(−δt)'), data: env, color: TM.aux, dashed: true }, { name: '−', data: env.map((q) => ({ x: q.x, y: -q.y })), color: TM.aux, dashed: true }] : []),
            ]}
            xLabel="t [s]"
            yLabel="x [mm]"
            refX={[{ x: tNow, label: 't' }]}
            digits={1}
          />
          <Caption>{s.F > 0 ? t('With excitation the free (transient) part dies out and the steady forced vibration at Ω remains.') : t('Free vibration: the amplitude decays exponentially; the logarithmic decrement is Λ = δ·T_d.')}</Caption>
        </Card>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="Magnification function V(η)">
          <LineChartBox height={260} series={[...Vcurves, { name: `D = ${nf(p.D, 3)} (${t('current')})`, data: own, color: TM.load }]} xLabel="η = Ω/ω₀" yLabel="V" yDomain={[0, 12]} refX={[{ x: s.eta, label: 'η' }]} digits={1} />
        </Card>
        <Card title="Phase lag ψ(η)">
          <LineChartBox height={260} series={[{ name: 'ψ [°]', data: phase, color: TM.aux }]} xLabel="η = Ω/ω₀" yLabel="ψ [°]" yDomain={[0, 180]} refX={[{ x: s.eta, label: 'η' }]} digits={0} />
          <Caption>{t('Below resonance the mass follows the force (ψ ≈ 0), at resonance it lags by 90°, far above it moves opposite to the force (ψ → 180°).')}</Caption>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`m\\ddot x + d\\dot x + c\\,x = \\hat F\\cos\\Omega t \\;\\Leftrightarrow\\; \\ddot x + 2\\delta\\dot x + \\omega_0^2 x = \\frac{\\hat F}{m}\\cos\\Omega t`} />
          <Tex block math={`\\omega_0 = \\sqrt{\\frac cm} = ${nf(p.w0, 3)}\\,\\mathrm{s^{-1}},\\quad \\delta = \\frac{d}{2m} = ${nf(p.delta, 3)}\\,\\mathrm{s^{-1}},\\quad D = \\frac{\\delta}{\\omega_0} = ${nf(p.D, 4)}`} />
          <Tex block math={p.D < 1 ? `x(t) = e^{-\\delta t}\\left(x_0\\cos\\omega_d t + \\frac{v_0 + \\delta x_0}{\\omega_d}\\sin\\omega_d t\\right),\\ \\omega_d = \\omega_0\\sqrt{1 - D^2} = ${nf(p.wd, 3)}` : `D \\ge 1:\\ \\text{${t('aperiodic motion, no oscillation')}}`} />
          <Tex block math={`V = \\frac{1}{\\sqrt{(1 - \\eta^2)^2 + (2D\\eta)^2}} = ${nf(mag.V, 3)},\\quad \\tan\\psi = \\frac{2D\\eta}{1 - \\eta^2} \\Rightarrow \\psi = ${nf(mag.psi, 1)}^\\circ`} />
          {s.F > 0 && <Tex block math={`\\hat x = \\frac{\\hat F}{c}\\,V = \\frac{${nf(s.F, 1)}}{${nf(s.c, 0)}} \\cdot ${nf(mag.V, 3)} = ${nf(xStat * mag.V * 1000, 3)}\\,\\mathrm{mm}`} />}
        </div>
      </Card>
    </EeLayout>
  );
}
