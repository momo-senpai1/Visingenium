/** Induction motor: three coils make a rotating field, the rotor follows with slip; torque–speed curve and operating point. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, Readout, si, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { kloss, motorOP } from '@/lib/ee';

interface S {
  f: number;
  p: number;
  Mk: number;
  sk: number;
  ML: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useMo = create<S>()(
  persist((set) => ({ f: 50, p: 2, Mk: 60, sk: 0.2, ML: 25, set: (p) => set(p) }), {
    name: 'ee-motor',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const VIS = 0.25; // field turns per second in the animation

export default function MotorPage() {
  const s = useMo();
  const op = motorOP(s.ML, s.sk, s.Mk, s.f, s.p);
  const ta = useAnimTime();
  const th = 2 * Math.PI * VIS * ta;
  const slip = op.s ?? 1;
  const rotorAng = th * (1 - slip);
  const curve = Array.from({ length: 201 }, (_, k) => {
    const sl = 1 - k / 200;
    return { x: op.ns * (1 - sl), y: kloss(Math.max(sl, 1e-6), s.sk, s.Mk) };
  });
  const Mstart = kloss(1, s.sk, s.Mk);
  const P = op.s === null ? 0 : (s.ML * 2 * Math.PI * op.n) / 60;
  const cur = [0, 1, 2].map((k) => Math.cos(th - (k * 2 * Math.PI) / 3));
  return (
    <EeLayout
      aside={
        <>
          <Card title="Induction motor">
            <Idea>
              {t(
                'Three coils fed with three-phase current, each shifted by 120°, add up to a magnetic field that turns round — nothing moves mechanically. The field induces currents in the rotor bars, and these currents are pulled along by the field. The rotor always turns a little slower than the field (slip): if it caught up, nothing would be induced and there would be no torque.',
              )}
            </Idea>
          </Card>
          <Card title="Motor and load">
            <div className="space-y-3">
              <ParamSlider label="Supply frequency" symbol="f" unit="Hz" value={s.f} min={5} max={100} step={1} digits={0} onChange={(f) => s.set({ f })} />
              <ParamSlider label="Pole pairs" symbol="p" value={s.p} min={1} max={6} step={1} digits={0} onChange={(p) => s.set({ p: Math.round(p) })} />
              <ParamSlider label="Breakdown torque" symbol="M_k" unit="Nm" value={s.Mk} min={5} max={200} step={1} digits={0} onChange={(Mk) => s.set({ Mk })} />
              <ParamSlider label="Breakdown slip" symbol="s_k" value={s.sk} min={0.05} max={0.6} step={0.01} digits={2} onChange={(sk) => s.set({ sk })} />
              <ParamSlider label="Load torque" symbol="M_L" unit="Nm" value={s.ML} min={0} max={220} step={1} digits={0} onChange={(ML) => s.set({ ML })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Synchronous speed" value={`${nf(op.ns, 0)} min⁻¹`} sub="$n_\mathrm{s} = 60\,f/p$" />
        <Kpi label="Rotor speed" value={op.s === null ? '0' : `${nf(op.n, 0)} min⁻¹`} />
        <Kpi label="Slip" value={op.s === null ? '100 %' : `${nf(op.s * 100, 2)} %`} />
        <Kpi label="Starting torque" value={`${nf(Mstart, 1)} Nm`} sub={Mstart < s.ML ? t('too small to start') : t('starts')} />
        <Kpi label="Mechanical power" value={si(P, 'W')} sub="$P = M\,\omega$" />
      </div>
      {op.s === null && <Notice tone="error">{t('The load torque is larger than the breakdown torque: the motor stalls.')}</Notice>}
      {op.s !== null && Mstart < s.ML && (
        <Notice tone="warning">{t('Running, the motor could carry this load, but its starting torque is smaller — it would not start on its own under full load.')}</Notice>
      )}
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Rotating field (slow motion)">
          <svg viewBox="0 0 400 320" className="mx-auto h-auto w-full max-w-[460px]" role="img" aria-label={t('Rotating magnetic field and rotor')}>
            <defs>
              <marker id="mfa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill={EE.p} />
              </marker>
            </defs>
            <circle cx={200} cy={160} r={130} fill="none" stroke="rgb(var(--plant-500))" strokeWidth={22} strokeOpacity={0.3} />
            {[0, 1, 2].map((k) =>
              [0, 1].map((side) => {
                const a = (k * 2 * Math.PI) / 3 + side * Math.PI;
                const x = 200 + 112 * Math.cos(a);
                const y = 160 - 112 * Math.sin(a);
                const c = cur[k]! * (side ? -1 : 1);
                return (
                  <g key={`${k}${side}`}>
                    <rect
                      x={x - 14}
                      y={y - 9}
                      width={28}
                      height={18}
                      rx={3}
                      transform={`rotate(${(-a * 180) / Math.PI + 90},${x},${y})`}
                      fill={EE.ph[k]}
                      fillOpacity={0.15 + 0.7 * Math.abs(c)}
                      stroke={EE.ph[k]}
                    />
                    <text x={x} y={y + 4} textAnchor="middle" className="text-[11px] font-bold" style={{ fill: 'rgb(var(--plant-950))' }}>
                      {c > 0.15 ? '⊙' : c < -0.15 ? '⊗' : ''}
                    </text>
                    {!side && (
                      <Readout x={200 + 150 * Math.cos(a)} y={164 - 150 * Math.sin(a)} color={EE.ph[k]}>
                        L{k + 1}
                      </Readout>
                    )}
                  </g>
                );
              }),
            )}
            {/* rotor (squirrel cage) */}
            <circle cx={200} cy={160} r={70} fill="rgb(var(--plant-900))" stroke={EE.muted} strokeWidth={1.5} />
            {Array.from({ length: 12 }, (_, k) => {
              const a = rotorAng + (k * Math.PI) / 6;
              return (
                <circle
                  key={k}
                  cx={200 + 58 * Math.cos(a)}
                  cy={160 - 58 * Math.sin(a)}
                  r={5}
                  fill="rgb(var(--sig-heat))"
                  fillOpacity={0.4 + 0.5 * Math.abs(Math.sin(a - th)) * Math.min(1, slip * 8)}
                />
              );
            })}
            <line x1={200} y1={160} x2={200 + 45 * Math.cos(rotorAng)} y2={160 - 45 * Math.sin(rotorAng)} stroke={EE.muted} strokeWidth={4} strokeLinecap="round" />
            <line x1={200} y1={160} x2={200 + 100 * Math.cos(th)} y2={160 - 100 * Math.sin(th)} stroke={EE.p} strokeWidth={3} markerEnd="url(#mfa)" />
            <Readout x={200 + 104 * Math.cos(th)} y={156 - 104 * Math.sin(th)} color={EE.p}>
              B
            </Readout>
            <Readout x={200} y={312} color={EE.muted}>
              {t('field')}: {nf(VIS * 60, 0)} {t('rpm shown')} · {t('rotor')}: {nf(VIS * 60 * (1 - slip), 1)}
            </Readout>
          </svg>
          <p className="mt-1 text-[10px] text-plant-500">
            {t(
              'Coil colour = current in that phase (⊙ out of, ⊗ into the page). The three fields add up to one arrow B of constant length that turns round. The rotor (grey hand) lags behind by the slip, exaggerated here.',
            )}
          </p>
        </Card>
        <Card title="Torque–speed curve">
          <LineChartBox
            height={280}
            series={[
              { name: 'M(n) [Nm]', data: curve, color: EE.i },
              {
                name: 'M_L [Nm]',
                data: [
                  { x: 0, y: s.ML },
                  { x: op.ns, y: s.ML },
                ],
                color: EE.u,
                dashed: true,
              },
            ]}
            xLabel="n [min⁻¹]"
            yLabel="M [Nm]"
            digits={0}
            refX={[...(op.s !== null ? [{ x: op.n, label: t('operating point') }] : []), { x: op.ns * (1 - s.sk), label: 'M_k' }]}
          />
          <p className="mt-1 text-[10px] text-plant-500">
            {t('Right of the breakdown point the curve is steep: more load → only slightly lower speed (stable). Left of it the torque falls with falling speed — the motor stalls.')}
          </p>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`n_s = \\frac{60\\,f}{p} = \\frac{60\\cdot ${nf(s.f, 0)}}{${s.p}} = ${nf(op.ns, 0)}\\,\\mathrm{min^{-1}}`} />
          <Tex block math={`M(s) = \\frac{2 M_k}{s/s_k + s_k/s}\\quad(\\text{Kloss})`} />
          {op.s !== null && <Tex block math={`M(s) = M_L \\Rightarrow s = ${nf(op.s, 4)},\\quad n = n_s(1-s) = ${nf(op.n, 0)}\\,\\mathrm{min^{-1}}`} />}
          <Tex block math={`P = M\\,\\omega = M\\,\\frac{2\\pi n}{60} = ${nf(P / 1000, 3)}\\,\\mathrm{kW}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
