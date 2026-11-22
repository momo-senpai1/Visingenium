/** Three-phase system: three rotating phasors, star and delta connection, neutral current and star-point shift. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { EE, EeLayout, Idea, PhasorPlot, Readout, si, Sym, useAnimTime, Wire } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice, Toggle } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { cabs, carg, cx, deg, threePhase } from '@/lib/ee';

type Conn = 'star-n' | 'star' | 'delta';
interface S {
  U: number;
  conn: Conn;
  sym: boolean;
  R: [number, number, number];
  X: number;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const use3 = create<S>()(
  persist((set) => ({ U: 230, conn: 'star-n', sym: true, R: [20, 20, 20], X: 10, set: (p) => set(p) }), {
    name: 'ee-3phase',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const NAMES = ['L1', 'L2', 'L3'];

export default function ThreePhasePage() {
  const s = use3();
  const R = s.sym ? ([s.R[0], s.R[0], s.R[0]] as const) : s.R;
  const Z = R.map((r) => cx(r, s.X)) as [ReturnType<typeof cx>, ReturnType<typeof cx>, ReturnType<typeof cx>];
  const r0 = threePhase(s.U, s.conn, Z);
  // numerical dust (1e-15 A) would read as “0.007 pA”
  const r = { ...r0, IN: cabs(r0.IN) < 1e-9 ? cx(0) : r0.IN, shift: cabs(r0.shift) < 1e-9 ? cx(0) : r0.shift };
  const ta = useAnimTime();
  const rot = ((2 * Math.PI) / 6) * ta;
  const T = 20; // ms at 50 Hz
  const wave = (k: number) => Array.from({ length: 161 }, (_, i) => ({ x: (i / 160) * 2 * T, y: s.U * Math.SQRT2 * Math.sin((2 * Math.PI * (i / 160) * 2 * T) / T - (k * 2 * Math.PI) / 3) }));
  const Imax = Math.max(...r.Iline.map(cabs), cabs(r.IN), 1e-9);
  const Ul = s.U * Math.sqrt(3);
  const cursor = ((((rot / (2 * Math.PI)) % 2) + 2) % 2) * T;
  return (
    <EeLayout
      aside={
        <>
          <Card title="Three-phase current">
            <Idea>
              {t(
                'A generator with three coils, turned by 120°, gives three sine voltages shifted by a third of a period. Their sum is zero at every instant. That is why a balanced load needs no return conductor, and why the voltage between two lines is √3 times the phase voltage (230 V → 400 V). Motors get a rotating field for free.',
              )}
            </Idea>
            <Segmented<Conn>
              value={s.conn}
              onChange={(conn) => s.set({ conn })}
              options={[
                { value: 'star-n', label: t('Star + N') },
                { value: 'star', label: t('Star') },
                { value: 'delta', label: t('Delta') },
              ]}
            />
          </Card>
          <Card title="Load per phase">
            <div className="space-y-3">
              <ParamSlider label="Phase voltage (rms)" symbol="U" unit="V" value={s.U} min={10} max={400} step={1} digits={0} onChange={(U) => s.set({ U })} />
              <Toggle checked={s.sym} onChange={(sym) => s.set({ sym })} label={t('Balanced load (all phases equal)')} />
              {[0, 1, 2].map((k) => (
                <ParamSlider
                  key={k}
                  label={s.sym ? 'Resistance' : `${t('Resistance')} ${NAMES[k]}`}
                  symbol={`R${s.sym ? '' : k + 1}`}
                  unit="Ω"
                  value={R[k]!}
                  min={1}
                  max={200}
                  step={1}
                  digits={0}
                  disabled={s.sym && k > 0}
                  onChange={(v) => s.set({ R: s.R.map((x, j) => (j === k ? v : x)) as [number, number, number] })}
                />
              ))}
              <ParamSlider label="Reactance (coil)" symbol="X" unit="Ω" value={s.X} min={0} max={100} step={1} digits={0} onChange={(X) => s.set({ X })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Line voltage" value={si(Ul, 'V')} sub="$\sqrt{3}\,U$" />
        <Kpi label="Line currents" value={r.Iline.map((i) => nf(cabs(i), 2)).join(' / ')} unit="A" small />
        <Kpi
          label={s.conn === 'star-n' ? 'Neutral current' : s.conn === 'star' ? 'Star-point shift' : 'Phase currents'}
          value={s.conn === 'star-n' ? si(cabs(r.IN), 'A') : s.conn === 'star' ? si(cabs(r.shift), 'V') : r.Iph.map((i) => nf(cabs(i), 2)).join(' / ')}
          unit={s.conn === 'delta' ? 'A' : undefined}
          small={s.conn === 'delta'}
        />
        <Kpi label="Total active power" value={si(r.P, 'W')} />
      </div>
      {s.conn === 'star' && !s.sym && (
        <Notice tone="warning">
          {t('Unbalanced star without neutral: the star point moves, the phase voltages become unequal — some loads get too much voltage. That is why houses are connected with a neutral conductor.')}
        </Notice>
      )}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Connection">
          <Schematic conn={s.conn} r={r} Imax={Imax} t0={ta} />
        </Card>
        <Card title="Phasors (rotating)">
          <div className="grid grid-cols-2 gap-2 2xl:grid-cols-1">
            <PhasorPlot
              rot={rot}
              scale={Math.max(s.U, Ul * (s.conn === 'delta' ? 1 : 0)) * 1.05}
              items={[
                ...(s.conn === 'delta'
                  ? r.Uload.map((u, k) => ({ v: u, color: EE.ph[k]!, label: `U${NAMES[k]![1]}${NAMES[(k + 1) % 3]![1]}` }))
                  : r.U.map((u, k) => ({ v: u, color: EE.ph[k]!, label: NAMES[k]! }))),
                ...(s.conn === 'star' && cabs(r.shift) > 0.5 ? [{ v: r.shift, color: EE.text, label: 'N′', dashed: true }] : []),
              ]}
            />
            <PhasorPlot
              rot={rot}
              scale={Imax * 1.05}
              items={[...r.Iline.map((i, k) => ({ v: i, color: EE.ph[k]!, label: `I${k + 1}` })), ...(s.conn === 'star-n' ? [{ v: r.IN, color: EE.text, label: 'I_N', dashed: true }] : [])]}
            />
          </div>
          <p className="text-[10px] text-plant-500">{t('Voltages and line currents. With a balanced load the three current arrows add up to zero.')}</p>
        </Card>
      </div>
      <div className="grid gap-2 2xl:grid-cols-2">
        <Card title="The three voltages over time">
          <LineChartBox
            height={220}
            series={[0, 1, 2].map((k) => ({ name: `u_${NAMES[k]} [V]`, data: wave(k), color: EE.ph[k] }))}
            xLabel="t [ms] (50 Hz)"
            yLabel=""
            digits={0}
            refX={[{ x: cursor, label: '▼' }]}
          />
        </Card>
        <Card title="Solution path">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`\\underline Z = R + \\mathrm jX = ${nf(Z[0].re, 1)} + \\mathrm j${nf(s.X, 1)}\\,\\Omega${s.sym ? '' : '\\ (L1)'},\\quad \\varphi = ${nf(deg(carg(Z[0])), 1)}^\\circ`} />
            {s.conn === 'delta' ? (
              <>
                <Tex
                  block
                  math={`I_\\mathrm{Str} = \\frac{\\sqrt3\\,U}{|\\underline Z|} = ${nf(cabs(r.Iph[0]!), 3)}\\,\\mathrm A,\\quad I_\\mathrm{L} = \\sqrt3\\,I_\\mathrm{Str} = ${nf(cabs(r.Iline[0]!), 3)}\\,\\mathrm A`}
                />
                <Tex block math={`P = 3\\,U_\\mathrm L I_\\mathrm{Str}\\cos\\varphi = \\sqrt3\\,U_\\mathrm L I_\\mathrm L\\cos\\varphi = ${nf(r.P / 1000, 3)}\\,\\mathrm{kW}`} />
              </>
            ) : (
              <>
                <Tex block math={`I = \\frac{U}{|\\underline Z|} = ${nf(cabs(r.Iph[0]!), 3)}\\,\\mathrm A${s.sym ? '' : '\\ (L1)'}`} />
                <Tex block math={`\\underline I_N = \\underline I_1 + \\underline I_2 + \\underline I_3 = ${nf(cabs(r.IN), 3)}\\,\\mathrm A${s.conn === 'star' ? '\\ (\\text{no N})' : ''}`} />
                <Tex block math={`P = \\sum U_k I_k \\cos\\varphi_k = ${nf(r.P / 1000, 3)}\\,\\mathrm{kW}`} />
              </>
            )}
            <p className="pt-1 text-[10px] leading-relaxed text-plant-500">
              {t('The same three resistors in delta take three times the power of the star connection — the star–delta starter of motors uses this to limit the starting current.')}
            </p>
          </div>
        </Card>
      </div>
    </EeLayout>
  );
}

function Schematic({ conn, r, Imax, t0 }: { conn: Conn; r: ReturnType<typeof threePhase>; Imax: number; t0: number }) {
  const ys = [50, 100, 150];
  return (
    <svg viewBox="0 0 640 310" className="mx-auto h-auto w-full max-w-[760px]" role="img" aria-label={t('Three-phase connection')}>
      {ys.map((y, k) => (
        <g key={k}>
          <Wire
            pts={[
              [40, y],
              [conn === 'delta' ? 600 : 480, y],
            ]}
            color={EE.ph[k]}
          />
          <Readout x={30} y={y + 4} anchor="end" color={EE.ph[k]}>
            {NAMES[k]}
          </Readout>
          <Readout x={150} y={y - 6} color={EE.ph[k]}>
            {si(cabs(r.Iline[k]!), 'A')}
          </Readout>
          {/* flow animation: brightness pulse with the phase of the current */}
          <circle cx={100 + ((t0 * 60 * (cabs(r.Iline[k]!) / Imax)) % 300)} cy={y} r={3} fill={EE.ph[k]} />
        </g>
      ))}
      {conn !== 'delta' && (
        <>
          {conn === 'star-n' && (
            <Wire
              pts={[
                [40, 290],
                [480, 290],
              ]}
              color={EE.muted}
            />
          )}
          {conn === 'star-n' && (
            <Readout x={30} y={294} anchor="end" color={EE.muted}>
              N
            </Readout>
          )}
          {conn === 'star-n' && (
            <Readout x={150} y={284} color={EE.muted}>
              {si(cabs(r.IN), 'A')}
            </Readout>
          )}
          {[0, 1, 2].map((k) => {
            const x = 320 + k * 70;
            return (
              <g key={k}>
                <Wire
                  pts={[
                    [x, ys[k]!],
                    [x, 170],
                  ]}
                  color={EE.ph[k]}
                />
                <Sym a={[x, 170]} b={[x, 240]} kind="R" side={1} label={`Z${k + 1}`} sub={si(cabs(r.Uload[k]!), 'V')} />
                <Wire
                  pts={[
                    [x, 240],
                    [x, 260],
                  ]}
                />
                <circle cx={x} cy={ys[k]} r={3.5} fill={EE.body} />
              </g>
            );
          })}
          <Wire
            pts={[
              [320, 260],
              [460, 260],
            ]}
          />
          <circle cx={390} cy={260} r={3.5} fill={EE.body} />
          {conn === 'star-n' && (
            <Wire
              pts={[
                [460, 260],
                [480, 260],
                [480, 290],
              ]}
              color={EE.muted}
            />
          )}
          <Readout x={500} y={264} anchor="start" color={EE.muted}>
            {t('star point')} {conn === 'star' ? `(${si(cabs(r.shift), 'V')} ${t('shifted')})` : ''}
          </Readout>
        </>
      )}
      {conn === 'delta' && (
        <>
          {/* triangle: L1–L2, L2–L3, L3–L1 */}
          {(
            [
              [[300, 50], [300, 100], 0],
              [[420, 100], [420, 150], 1],
              [[540, 150], [540, 50], 2],
            ] as [[number, number], [number, number], number][]
          ).map(([a, b, k]) => (
            <g key={k}>
              <Wire
                pts={[
                  [a[0], a[1]],
                  [a[0], 180],
                ]}
                color={EE.ph[k]}
              />
              <Sym a={[a[0], 180]} b={[a[0], 250]} kind="R" side={1} label={`Z${k + 1}`} sub={si(cabs(r.Uload[k]!), 'V')} />
              <Wire
                pts={[
                  [a[0], 250],
                  [a[0], 272],
                  [a[0] + 40, 272],
                  [a[0] + 40, b[1]],
                ]}
                color={EE.ph[(k + 1) % 3]}
              />
              <circle cx={a[0]} cy={a[1]} r={3.5} fill={EE.body} />
              <circle cx={a[0] + 40} cy={b[1]} r={3.5} fill={EE.body} />
            </g>
          ))}
          <Readout x={420} y={296} color={EE.muted}>
            {t('each load between two lines')}: {si(cabs(r.Uload[0]!), 'V')}
          </Readout>
        </>
      )}
    </svg>
  );
}
