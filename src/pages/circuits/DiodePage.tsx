/** Diode: characteristic with load line and operating point; half-wave and bridge rectifier with smoothing capacitor. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { diodeI, diodeOP, rectifier } from '@/lib/ee';

type Mode = 'half' | 'bridge';
interface S {
  U0: number;
  R0: number;
  mode: Mode;
  Up: number;
  f: number;
  C: number; // µF
  RL: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useDi = create<S>()(
  persist((set) => ({ U0: 5, R0: 220, mode: 'bridge', Up: 15, f: 50, C: 470, RL: 220, set: (p) => set(p) }), {
    name: 'ee-diode',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const PER = 4;

export default function DiodePage() {
  const s = useDi();
  const op = diodeOP(s.U0, s.R0);
  const ch = Array.from({ length: 161 }, (_, k) => {
    const U = -1 + (k / 160) * 1.9;
    return { x: U, y: 1e3 * diodeI(U) };
  }).filter((p) => p.y < 1000 * (s.U0 / s.R0) * 3 + 5);
  const yTop = 1000 * (s.U0 / s.R0) * 1.3 + 1;
  const load = [
    { x: 0, y: (1000 * s.U0) / s.R0 },
    { x: Math.min(0.9, s.U0), y: (1000 * (s.U0 - Math.min(0.9, s.U0))) / s.R0 },
  ];
  const rec = rectifier(s.mode, s.Up, s.f, s.C * 1e-6, s.RL, 0.7, PER, 1600);
  const ta = useAnimTime();
  // the cursor runs over the last two periods (6 s of animation)
  const frac = (((ta / 6) % 1) + 1) % 1;
  const idx = Math.min(rec.pts.length - 1, Math.round(((PER - 2 + 2 * frac) / PER) * (rec.pts.length - 1)));
  const now = rec.pts[idx]!;
  const posHalf = now.us >= 0;
  const T = 1000 / s.f;
  return (
    <EeLayout
      aside={
        <>
          <Card title="Diode and rectifier">
            <Idea>
              {t(
                'A diode is a one-way valve for current: forward it conducts once about 0.7 V is reached (silicon), backwards it blocks. Four diodes in a bridge turn both half-waves of an alternating voltage in the same direction; a capacitor then fills the gaps — that is the inside of every power supply.',
              )}
            </Idea>
          </Card>
          <Card title="Diode with series resistor">
            <div className="space-y-3">
              <ParamSlider label="Supply voltage" symbol="U" unit="V" value={s.U0} min={0} max={12} step={0.1} onChange={(U0) => s.set({ U0 })} />
              <ParamSlider label="Series resistor" symbol="R" unit="Ω" value={s.R0} min={10} max={10000} step={10} digits={0} onChange={(R0) => s.set({ R0 })} />
            </div>
          </Card>
          <Card title="Rectifier">
            <div className="space-y-3">
              <Segmented<Mode>
                value={s.mode}
                onChange={(mode) => s.set({ mode })}
                options={[
                  { value: 'half', label: t('Half-wave') },
                  { value: 'bridge', label: t('Bridge') },
                ]}
              />
              <ParamSlider label="Peak voltage" symbol="û" unit="V" value={s.Up} min={2} max={40} step={0.5} onChange={(Up) => s.set({ Up })} />
              <ParamSlider label="Frequency" symbol="f" unit="Hz" value={s.f} min={10} max={400} step={1} digits={0} onChange={(f) => s.set({ f })} />
              <ParamSlider label="Smoothing capacitor (0 = none)" symbol="C" unit="µF" value={s.C} min={0} max={4700} step={10} digits={0} onChange={(C) => s.set({ C })} />
              <ParamSlider label="Load resistance" symbol="R_L" unit="Ω" value={s.RL} min={10} max={5000} step={10} digits={0} onChange={(RL) => s.set({ RL })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="Characteristic and operating point">
          <LineChartBox
            height={240}
            series={[
              { name: t('diode I(U) [mA]'), data: ch, color: EE.i },
              { name: t('load line [mA]'), data: load, color: EE.u, dashed: true },
            ]}
            xLabel="U_D [V]"
            yLabel="I [mA]"
            yDomain={[-yTop * 0.05, yTop]}
            xDomain={[-1, 0.9]}
            refX={[{ x: op.Ud, label: t('operating point') }]}
          />
          <div className="mt-2 text-[13px] text-plant-100">
            <Tex block math={`U = R\\,I + U_D,\\quad I = I_S\\,(e^{U_D/U_T} - 1)\\;\\Rightarrow\\; U_D = ${nf(op.Ud, 3)}\\,\\mathrm V,\\ I = ${nf(op.I * 1000, 3)}\\,\\mathrm{mA}`} />
          </div>
          <p className="mt-1 text-[10px] text-plant-500">
            {t(
              'The operating point is where the diode curve meets the load line of the resistor. Below about 0.5 V almost nothing flows; above it the current rises steeply — the diode voltage stays near 0.7 V.',
            )}
          </p>
        </Card>
        <Card title="Rectifier circuit">
          <RectSchematic mode={s.mode} on={now.on} pos={posHalf} hasC={s.C > 0} us={now.us} uo={now.uo} />
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Mean output voltage" value={si(rec.mean, 'V')} />
        <Kpi label="Ripple" value={si(rec.ripple, 'V')} sub={Number.isFinite(rec.est) ? `≈ I/(${s.mode === 'half' ? '' : '2'}fC) = ${si(rec.est, 'V')}` : t('no capacitor')} />
        <Kpi label="Load current" value={si(rec.mean / s.RL, 'A')} />
        <Kpi label="Diode drop" value={s.mode === 'half' ? '0.7 V' : '2 × 0.7 V'} sub={t('two diodes conduct in the bridge')} />
      </div>
      <Card title="Input and output voltage">
        <LineChartBox
          height={260}
          series={[
            { name: 'u_in [V]', data: rec.pts.filter((_, k) => k % 4 === 0).map((p) => ({ x: p.t * 1000, y: p.us })), color: EE.muted },
            { name: 'u_out [V]', data: rec.pts.filter((_, k) => k % 4 === 0).map((p) => ({ x: p.t * 1000, y: p.uo })), color: EE.u },
          ]}
          xLabel="t [ms]"
          yLabel=""
          digits={1}
          refX={[{ x: now.t * 1000, label: '▼' }]}
        />
        <p className="mt-1 text-[10px] text-plant-500">
          {t(
            'The capacitor is recharged only near the peaks (short, high current pulses through the diodes) and supplies the load in between. A larger C or a smaller load current means less ripple.',
          )}{' '}
          T = {nf(T, 1)} ms
        </p>
      </Card>
    </EeLayout>
  );
}

function RectSchematic({ mode, on, pos, hasC, us, uo }: { mode: Mode; on: boolean; pos: boolean; hasC: boolean; us: number; uo: number }) {
  const lit = (a: boolean) => (on && a ? 1 : 0);
  return (
    <svg viewBox="0 0 600 300" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Rectifier circuit')}>
      <Sym a={[70, 190]} b={[70, 110]} kind="AC" label="u_in" sub={`${nf(us, 1)} V`} side={1} />
      {mode === 'half' ? (
        <>
          <Wire
            pts={[
              [70, 110],
              [70, 60],
              [200, 60],
            ]}
            color={pos ? EE.red : EE.u}
          />
          <Sym a={[200, 60]} b={[300, 60]} kind="D" glow={lit(pos)} label="D" side={-1} />
          <Wire
            pts={[
              [300, 60],
              [480, 60],
            ]}
          />
          <Wire
            pts={[
              [70, 190],
              [70, 250],
              [480, 250],
            ]}
            color={pos ? EE.u : EE.red}
          />
        </>
      ) : (
        <>
          {/* bridge: left D, top A, right B, bottom C */}
          <Wire
            pts={[
              [70, 110],
              [70, 60],
              [150, 60],
              [150, 150],
              [200, 150],
            ]}
            color={pos ? EE.red : EE.u}
          />
          <Wire
            pts={[
              [70, 190],
              [70, 280],
              [340, 280],
              [340, 150],
              [320, 150],
            ]}
            color={pos ? EE.u : EE.red}
          />
          <Sym a={[200, 150]} b={[260, 90]} kind="D" glow={lit(pos)} label="D1" side={-1} />
          <Sym a={[320, 150]} b={[260, 90]} kind="D" glow={lit(!pos)} label="D2" side={1} />
          <Sym a={[260, 210]} b={[200, 150]} kind="D" glow={lit(!pos)} label="D3" side={-1} />
          <Sym a={[260, 210]} b={[320, 150]} kind="D" glow={lit(pos)} label="D4" side={1} />
          <Wire
            pts={[
              [260, 90],
              [260, 60],
              [480, 60],
            ]}
          />
          <Wire
            pts={[
              [260, 210],
              [260, 250],
              [480, 250],
            ]}
          />
          <Readout x={110} y={40} anchor="start" color={EE.muted}>
            {on ? `${t('conducting')}: ${pos ? 'D1, D4' : 'D2, D3'}` : t('all blocking')}
          </Readout>
        </>
      )}
      {hasC && (
        <>
          <Wire
            pts={[
              [400, 60],
              [400, 120],
            ]}
          />
          <Sym a={[400, 120]} b={[400, 190]} kind="C" label="C" side={1} />
          <Wire
            pts={[
              [400, 190],
              [400, 250],
            ]}
          />
        </>
      )}
      <Wire
        pts={[
          [480, 60],
          [480, 120],
        ]}
      />
      <Sym a={[480, 120]} b={[480, 190]} kind="R" label="R_L" side={-1} />
      <Wire
        pts={[
          [480, 190],
          [480, 250],
        ]}
      />
      <Readout x={560} y={160} color={EE.u}>
        {nf(uo, 2)} V
      </Readout>
      <Readout x={300} y={295} color={EE.muted}>
        {on ? t('diodes conducting: the capacitor is charged') : hasC ? t('diodes blocking: the capacitor feeds the load') : t('diodes blocking')}
      </Readout>
    </svg>
  );
}
