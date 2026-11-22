/** Transformer: alternating flux in the iron core, turns ratio, and why power lines use high voltage. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { transformer } from '@/lib/ee';

interface S {
  U1: number;
  N1: number;
  N2: number;
  RL: number;
  f: number;
  P: number; // kW to transmit
  Rline: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useTf = create<S>()(
  persist((set) => ({ U1: 230, N1: 1000, N2: 52, RL: 12, f: 50, P: 10, Rline: 2, set: (p) => set(p) }), {
    name: 'ee-transformer',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const WV = (2 * Math.PI) / 3;

export default function TransformerPage() {
  const s = useTf();
  const r = transformer(s.U1, s.N1, s.N2, s.RL, s.f, 8);
  const ta = useAnimTime();
  const th = WV * ta;
  const flux = Math.sin(th - Math.PI / 2); // Φ lags u₁ by 90°
  const T = 1000 / s.f;
  const pts = Array.from({ length: 161 }, (_, k) => {
    const x = (k / 160) * 2 * T;
    const a = (2 * Math.PI * x) / T;
    return { x, u1: s.U1 * Math.SQRT2 * Math.sin(a), u2: r.U2 * Math.SQRT2 * Math.sin(a), phi: Math.sin(a - Math.PI / 2) };
  });
  const turns = (n: number) => Math.max(2, Math.min(14, Math.round(Math.log10(n + 1) * 4)));
  const t1 = turns(s.N1);
  const t2 = turns(s.N2);
  // transmission comparison: same power at 400 V and at 20 kV
  const loss = (U: number) => ((s.P * 1000) / U) ** 2 * s.Rline;
  return (
    <EeLayout
      aside={
        <>
          <Card title="Transformer">
            <Idea>
              {t(
                'An alternating current in the primary coil drives an alternating magnetic flux through the iron core. This changing flux induces a voltage in every turn of the secondary coil. More turns → more voltage: the voltages are in the ratio of the turns, the currents in the inverse ratio — the power stays (almost) the same. Direct current does not work: a constant flux induces nothing.',
              )}
            </Idea>
          </Card>
          <Card title="Values">
            <div className="space-y-3">
              <ParamSlider label="Primary voltage (rms)" symbol="U₁" unit="V" value={s.U1} min={1} max={1000} step={1} digits={0} onChange={(U1) => s.set({ U1 })} />
              <ParamSlider label="Primary turns" symbol="N₁" value={s.N1} min={10} max={5000} step={1} digits={0} onChange={(N1) => s.set({ N1 })} />
              <ParamSlider label="Secondary turns" symbol="N₂" value={s.N2} min={1} max={5000} step={1} digits={0} onChange={(N2) => s.set({ N2 })} />
              <ParamSlider label="Load resistance" symbol="R_L" unit="Ω" value={s.RL} min={1} max={10000} step={1} digits={0} onChange={(RL) => s.set({ RL })} />
              <ParamSlider label="Frequency" symbol="f" unit="Hz" value={s.f} min={1} max={1000} step={1} digits={0} onChange={(f) => s.set({ f })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Turns ratio" value={nf(r.n, 3)} sub="$\ddot u = N_1/N_2$" />
        <Kpi label="Secondary voltage" value={si(r.U2, 'V')} />
        <Kpi label="Secondary current" value={si(r.I2, 'A')} />
        <Kpi label="Primary current" value={si(r.I1, 'A')} sub={`${t('magnetising')} ${si(r.Im, 'A')}`} />
        <Kpi label="Load seen from the primary" value={si(r.Rin, 'Ω')} sub="$\ddot u^2 R_\mathrm{L}$" />
      </div>
      <Card title="Iron core and flux">
        <svg viewBox="0 0 640 300" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Transformer with alternating flux')}>
          {/* core */}
          <rect x={200} y={50} width={240} height={200} rx={6} fill="none" stroke="rgb(var(--plant-500))" strokeWidth={28} strokeOpacity={0.35} />
          <rect
            x={200}
            y={50}
            width={240}
            height={200}
            rx={6}
            fill="none"
            stroke={EE.p}
            strokeWidth={4}
            strokeOpacity={0.25 + 0.7 * Math.abs(flux)}
            strokeDasharray="10 12"
            strokeDashoffset={flux * 60}
          />
          <Readout x={320} y={40} color={EE.p}>
            Φ {flux >= 0 ? '↻' : '↺'} ({nf(flux * 100, 0)} %)
          </Readout>
          {/* primary coil */}
          {Array.from({ length: t1 }, (_, k) => (
            <ellipse key={`a${k}`} cx={200} cy={90 + (k * 120) / t1} rx={24} ry={5} fill="none" stroke={EE.u} strokeWidth={2} />
          ))}
          {Array.from({ length: t2 }, (_, k) => (
            <ellipse key={`b${k}`} cx={440} cy={90 + (k * 120) / t2} rx={24} ry={5} fill="none" stroke={EE.i} strokeWidth={2} />
          ))}
          <Wire
            pts={[
              [176, 90],
              [100, 90],
              [100, 120],
            ]}
            color={EE.u}
          />
          <Wire
            pts={[
              [176, 210],
              [100, 210],
              [100, 190],
            ]}
            color={EE.u}
          />
          <Sym a={[100, 190]} b={[100, 120]} kind="AC" label="U₁" sub={si(s.U1, 'V')} side={1} />
          <Wire
            pts={[
              [464, 90],
              [560, 90],
              [560, 115],
            ]}
            color={EE.i}
          />
          <Wire
            pts={[
              [464, 210],
              [560, 210],
              [560, 185],
            ]}
            color={EE.i}
          />
          <Sym a={[560, 115]} b={[560, 185]} kind="lamp" glow={Math.min(1, (r.P / 100) * Math.abs(Math.sin(th)) + 0.1)} label="R_L" sub={si(r.P, 'W')} side={-1} />
          <Readout x={200} y={275} color={EE.u}>
            N₁ = {nf(s.N1, 0)}
          </Readout>
          <Readout x={440} y={275} color={EE.i}>
            N₂ = {nf(s.N2, 0)}
          </Readout>
          <Readout x={512} y={80} anchor="middle" color={EE.i}>
            U₂ = {si(r.U2, 'V')}
          </Readout>
        </svg>
        <p className="mt-1 text-[10px] text-plant-500">{t('The dashes in the core show the flux oscillating back and forth (slow motion); the number of drawn turns is only symbolic.')}</p>
      </Card>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Voltages and flux (normalised)">
          <LineChartBox
            height={220}
            series={[
              { name: 'u₁ / û₁', data: pts.map((p) => ({ x: p.x, y: p.u1 / (s.U1 * Math.SQRT2) })), color: EE.u },
              { name: 'u₂ / û₂', data: pts.map((p) => ({ x: p.x, y: p.u2 / Math.max(r.U2 * Math.SQRT2, 1e-12) })), color: EE.i, dashed: true },
              { name: 'Φ / Φ̂', data: pts.map((p) => ({ x: p.x, y: p.phi })), color: EE.p },
            ]}
            xLabel="t [ms]"
            yLabel=""
            digits={1}
          />
          <p className="mt-1 text-[10px] text-plant-500">{t('The induced voltage is largest where the flux changes fastest (its zero crossings): u = N·dΦ/dt.')}</p>
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`\\frac{U_1}{U_2} = \\frac{N_1}{N_2} = \\ddot u = ${nf(r.n, 3)} \\;\\Rightarrow\\; U_2 = ${nf(r.U2, 3)}\\,\\mathrm V`} />
            <Tex block math={`I_2 = \\frac{U_2}{R_L} = ${nf(r.I2, 3)}\\,\\mathrm A,\\quad I_1 \\approx \\frac{I_2}{\\ddot u} = ${nf(r.I1load, 4)}\\,\\mathrm A`} />
            <Tex block math={`\\hat\\Phi = \\frac{\\sqrt2\\,U_1}{2\\pi f N_1} = ${nf(r.phiMax * 1000, 3)}\\,\\mathrm{mWb}`} />
            <p className="pt-1 text-[10px] leading-relaxed text-plant-500">{t('Ideal transformer: no winding resistance, no leakage, no core losses. Real ones reach 95–99 % efficiency.')}</p>
          </div>
        </Card>
      </div>
      <Card title="Why power lines use high voltage">
        <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-3">
            <ParamSlider label="Power to transmit" symbol="P" unit="kW" value={s.P} min={1} max={500} step={1} digits={0} onChange={(P) => s.set({ P })} />
            <ParamSlider label="Line resistance" symbol="R" unit="Ω" value={s.Rline} min={0.1} max={10} step={0.1} onChange={(Rline) => s.set({ Rline })} />
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-plant-500">
                <th className="py-1 text-left font-normal">{t('Voltage')}</th>
                <th className="py-1 text-right font-normal">{t('Current')}</th>
                <th className="py-1 text-right font-normal">{t('Loss')} I²R</th>
                <th className="py-1 text-right font-normal">%</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[400, 20e3, 380e3].map((U) => (
                <tr key={U} className="border-t border-white/[0.04]">
                  <td className="py-1 text-plant-100">{si(U, 'V')}</td>
                  <td className="py-1 text-right text-plant-200">{si((s.P * 1000) / U, 'A')}</td>
                  <td className="py-1 text-right text-plant-200">{si(loss(U), 'W')}</td>
                  <td className="py-1 text-right" style={{ color: loss(U) / (s.P * 1000) > 0.1 ? EE.red : EE.ok }}>
                    {nf(Math.min(999, (loss(U) / (s.P * 1000)) * 100), 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-plant-500">
          {t('Fifty times the voltage means one fiftieth of the current and 1/2500 of the loss. Transformers make this possible — the main reason the grid runs on alternating current.')}
        </p>
      </Card>
    </EeLayout>
  );
}
