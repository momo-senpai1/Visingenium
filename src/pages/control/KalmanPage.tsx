/**
 * Kalman filter lab: a noisy measurement of a moving quantity, the filter's estimate with its
 * ±2σ band, the gain converging to its steady state, and a single step taken apart as
 * prior × measurement → posterior (three Gaussians).
 */

import { Shuffle } from 'lucide-react';
import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Label, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { axisTick, VIZ } from '@/components/analysis/vizTokens';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf, safeStorage } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice, Toggle } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { rmse, runKalman, type KalmanModel } from '@/lib/kalman';

interface KState {
  model: KalmanModel;
  /** true noise as standard deviations (easier to grasp than variances) */
  sq: number;
  sr: number;
  /** the filter uses the true values, or its own (mistuned) ones */
  matched: boolean;
  sqf: number;
  srf: number;
  p0: number;
  n: number;
  seed: number;
  k: number;
  lowpass: boolean;
  set: (p: Partial<Omit<KState, 'set'>>) => void;
}

const useKalman = create<KState>()(
  persist((set) => ({ model: 'cv', sq: 0.6, sr: 1.5, matched: true, sqf: 0.6, srf: 1.5, p0: 4, n: 200, seed: 3, k: 20, lowpass: true, set: (p) => set(p) }), {
    name: 'ts-control-kalman',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const DT = 0.1;
const C = { truth: VIZ.text, meas: 'rgb(var(--plant-400))', est: VIZ.equilibrium, band: VIZ.equilibrium, lp: VIZ.operating, prior: 'rgb(var(--sig-vapor))', z: VIZ.operating, post: VIZ.equilibrium };

export default function KalmanPage() {
  const s = useKalman();
  const qf = (s.matched ? s.sq : s.sqf) ** 2;
  const rf = (s.matched ? s.sr : s.srf) ** 2;
  const steps = useMemo(() => runKalman({ model: s.model, q: s.sq ** 2, r: s.sr ** 2, qf, rf, p0: s.p0, dt: DT, n: s.n, seed: s.seed }), [s.model, s.sq, s.sr, qf, rf, s.p0, s.n, s.seed]);
  const k = Math.min(s.k, steps.length - 1);
  const st = steps[k]!;
  const eMeas = rmse(steps, (x) => x.z);
  const eKal = rmse(steps, (x) => x.xPost);
  const eLp = rmse(steps, (x) => x.lowpass);
  // honest band: is the error inside ±2σ about 95 % of the time?
  const inside = steps.filter((x) => Math.abs(x.xPost - x.x) <= 2 * Math.sqrt(x.pPost)).length / steps.length;

  const data = steps.map((x) => ({ t: x.t, x: x.x, z: x.z, est: x.xPost, lp: x.lowpass, band: [x.xPost - 2 * Math.sqrt(x.pPost), x.xPost + 2 * Math.sqrt(x.pPost)] as [number, number] }));

  return (
    <div className="grid gap-2 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Kalman filter">
          <p className="mb-2 text-[11px] leading-relaxed text-plant-300">
            {t(
              'A Kalman filter estimates a quantity you cannot measure exactly. Each step it predicts with a model, then corrects the prediction with the new measurement — weighted by how much it trusts each of them.',
            )}
          </p>
          <p className="tag mb-1 text-plant-500">{t('Model of the motion')}</p>
          <Segmented<KalmanModel>
            value={s.model}
            onChange={(model) => s.set({ model })}
            options={[
              { value: 'constant', label: t('Random walk'), hint: 'x_k = x_(k−1) + w: a value that drifts slowly (temperature, level)' },
              { value: 'cv', label: t('Position + velocity'), hint: 'constant velocity with random acceleration (a cart, a vehicle)' },
            ]}
          />
        </Card>
        <Card title="Reality">
          <div className="space-y-3">
            <ParamSlider
              label="Process noise (how much the truth wanders)"
              symbol={s.model === 'cv' ? 'σ_a' : 'σ_w'}
              value={s.sq}
              min={0}
              max={3}
              step={0.05}
              digits={2}
              onChange={(sq) => s.set({ sq })}
            />
            <ParamSlider label="Sensor noise" symbol="σ_v" value={s.sr} min={0.05} max={5} step={0.05} digits={2} onChange={(sr) => s.set({ sr })} />
            <ParamSlider label="Steps" symbol="N" value={s.n} min={20} max={600} step={10} digits={0} onChange={(n) => s.set({ n })} />
            <button
              type="button"
              onClick={() => s.set({ seed: (s.seed * 7919 + 13) % 100003 })}
              className="flex items-center gap-1.5 rounded border border-white/[0.08] px-2 py-1 text-[11px] text-plant-300 hover:border-signal-liquid/40 hover:text-signal-liquid"
            >
              <Shuffle className="h-3 w-3" /> {t('New noise')}
            </button>
          </div>
        </Card>
        <Card title="What the filter assumes">
          <div className="space-y-3">
            <Toggle checked={s.matched} onChange={(matched) => s.set({ matched, sqf: s.sq, srf: s.sr })} label={t('Filter knows the true noise')} />
            <ParamSlider
              label="Assumed process noise"
              symbol="√q"
              value={s.matched ? s.sq : s.sqf}
              min={0.001}
              max={3}
              step={0.01}
              digits={3}
              disabled={s.matched}
              onChange={(sqf) => s.set({ sqf })}
            />
            <ParamSlider label="Assumed sensor noise" symbol="√r" value={s.matched ? s.sr : s.srf} min={0.05} max={5} step={0.05} digits={2} disabled={s.matched} onChange={(srf) => s.set({ srf })} />
            <ParamSlider label="Initial uncertainty" symbol="P₀" value={s.p0} min={0.01} max={50} step={0.01} digits={2} onChange={(p0) => s.set({ p0 })} />
            <p className="text-[10px] leading-relaxed text-plant-500">
              {t('Only the ratio q/r matters for the estimate: small q/r → smooth but slow, large q/r → fast but noisy. Untick the box and mistune it to see both.')}
            </p>
          </div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi label="RMSE sensor" value={nf(eMeas, 3)} />
          <Kpi label="RMSE Kalman" value={nf(eKal, 3)} sub={`${nf((1 - eKal / eMeas) * 100, 0)} % ${t('less error')}`} />
          <Kpi label="RMSE low-pass" value={nf(eLp, 3)} sub={t('same α as K∞')} />
          <Kpi label="Kalman gain K" value={nf(steps.at(-1)!.K, 3)} sub={t('steady state')} />
          <Kpi label="Inside ±2σ" value={`${nf(inside * 100, 0)} %`} sub={t('≈ 95 % if tuned')} />
        </div>
        {inside < 0.8 && (
          <Notice tone="warning">{t('The estimate leaves its ±2σ band far too often: the filter trusts its model or the sensor more than it should (assumed noise too small).')}</Notice>
        )}

        <Card title="Truth, measurements and estimate" aside={<Toggle checked={s.lowpass} onChange={(lowpass) => s.set({ lowpass })} label={t('compare with a low-pass')} />}>
          <ul className="mb-1 flex flex-wrap gap-x-4 text-[10px] text-plant-300">
            <li className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ background: C.truth }} /> {t('truth x')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.meas }} /> {t('measurement z')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ background: C.est }} /> {t('Kalman estimate x̂')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2 w-4 opacity-30" style={{ background: C.band }} /> ±2σ
            </li>
            {s.lowpass && (
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: C.lp }} /> {t('first-order low-pass')}
              </li>
            )}
          </ul>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} margin={{ top: 18, right: 16, bottom: 22, left: 4 }}>
              <CartesianGrid stroke={VIZ.grid} />
              <XAxis type="number" dataKey="t" domain={['dataMin', 'dataMax']} tick={axisTick} stroke={VIZ.axis} tickLine={false} tickFormatter={(v: number) => nf(v, 1)}>
                <Label value="t [s]" position="bottom" offset={6} style={{ fill: VIZ.textMuted, fontSize: 10 }} />
              </XAxis>
              <YAxis tick={axisTick} stroke={VIZ.axis} tickLine={false} width={44} tickFormatter={(v: number) => nf(v, 1)} />
              <Area dataKey="band" stroke="none" fill={C.band} fillOpacity={0.16} isAnimationActive={false} />
              <Scatter dataKey="z" fill={C.meas} shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={1.8} fill={C.meas} />} isAnimationActive={false} />
              <Line dataKey="x" stroke={C.truth} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              {s.lowpass && <Line dataKey="lp" stroke={C.lp} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
              <Line dataKey="est" stroke={C.est} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceLine x={st.t} stroke={VIZ.textFaint} strokeDasharray="4 3" label={{ value: `k = ${k}`, position: 'top', fill: VIZ.textMuted, fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'rgb(var(--plant-950))', border: '1px solid rgb(var(--white)/0.1)', fontSize: 10 }}
                formatter={(raw) => (Array.isArray(raw) ? `${nf(Number(raw[0]), 2)} … ${nf(Number(raw[1]), 2)}` : nf(Number(raw), 3))}
                labelFormatter={(raw) => `t = ${nf(Number(raw), 2)} s`}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
            {t(
              'The low-pass uses the same weight α as the converged Kalman gain. It lags behind a moving target; the Kalman filter with the velocity model does not, because it predicts where the target will be.',
            )}
          </p>
        </Card>

        <div className="grid gap-2 2xl:grid-cols-2">
          <Card title="One step taken apart">
            <ParamSlider label="Time step" symbol="k" value={k} min={0} max={steps.length - 1} step={1} digits={0} onChange={(v) => s.set({ k: Math.round(v) })} />
            <GaussianStep prior={{ m: st.xPrior, v: st.pPrior }} meas={{ m: st.z, v: rf }} post={{ m: st.xPost, v: st.pPost }} truth={st.x} />
            <div className="mt-2 space-y-1 text-[13px] text-plant-100">
              <p className="text-[10px] text-plant-400">{t('1 · Predict with the model')}</p>
              <Tex
                block
                math={
                  s.model === 'cv'
                    ? `\\hat x_k^- = \\hat x_{k-1} + \\Delta t\\,\\hat v_{k-1} = ${nf(st.xPrior, 3)},\\quad P_k^- = ${nf(st.pPrior, 4)}`
                    : `\\hat x_k^- = \\hat x_{k-1} = ${nf(st.xPrior, 3)},\\quad P_k^- = P_{k-1} + q = ${nf(st.pPrior, 4)}`
                }
              />
              <p className="text-[10px] text-plant-400">{t('2 · Weigh prediction against measurement')}</p>
              <Tex block math={`K_k = \\frac{P_k^-}{P_k^- + r} = \\frac{${nf(st.pPrior, 4)}}{${nf(st.pPrior, 4)} + ${nf(rf, 4)}} = ${nf(st.K, 4)}`} />
              <p className="text-[10px] text-plant-400">{t('3 · Correct with the innovation (measurement minus prediction)')}</p>
              <Tex block math={`\\hat x_k = \\hat x_k^- + K_k\\,(z_k - \\hat x_k^-) = ${nf(st.xPrior, 3)} + ${nf(st.K, 3)}\\cdot(${nf(st.innov, 3)}) = ${nf(st.xPost, 3)}`} />
              <Tex block math={`P_k = (1 - K_k)\\,P_k^- = ${nf(st.pPost, 4)}\\qquad(\\text{${t('true')}: } x_k = ${nf(st.x, 3)})`} />
            </div>
          </Card>
          <div className="space-y-2">
            <Card title="Gain and uncertainty over time">
              <LineChartBox
                height={220}
                series={[
                  { name: t('gain K'), data: steps.map((x) => ({ x: x.t, y: x.K })) },
                  { name: t('σ of the estimate √P'), data: steps.map((x) => ({ x: x.t, y: Math.sqrt(x.pPost) })), color: VIZ.operating },
                ]}
                xLabel="t [s]"
                yLabel=""
                digits={2}
              />
              <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
                {t(
                  'At the start the filter knows little (large P₀), so it follows the measurements (K near 1). As P shrinks, K settles at a constant value — the filter then works like a fixed filter whose weight was chosen optimally.',
                )}
              </p>
            </Card>
            <Card title="The equations (matrix form)">
              <div className="space-y-1 text-[13px] text-plant-100">
                <Tex
                  block
                  math={
                    '\\text{Predict:}\\quad \\hat{\\mathbf x}_k^- = \\mathbf F\\,\\hat{\\mathbf x}_{k-1},\\qquad \\mathbf P_k^- = \\mathbf F\\,\\mathbf P_{k-1}\\mathbf F^{\\mathsf T} + \\mathbf Q'
                  }
                />
                <Tex block math={'\\text{Update:}\\quad \\mathbf K_k = \\mathbf P_k^-\\mathbf H^{\\mathsf T}(\\mathbf H\\mathbf P_k^-\\mathbf H^{\\mathsf T} + R)^{-1}'} />
                <Tex
                  block
                  math={
                    '\\hat{\\mathbf x}_k = \\hat{\\mathbf x}_k^- + \\mathbf K_k(z_k - \\mathbf H\\hat{\\mathbf x}_k^-),\\qquad \\mathbf P_k = (\\mathbf I - \\mathbf K_k\\mathbf H)\\,\\mathbf P_k^-'
                  }
                />
                {s.model === 'cv' ? (
                  <Tex
                    block
                    math={
                      '\\mathbf F = \\begin{pmatrix}1 & \\Delta t\\\\ 0 & 1\\end{pmatrix},\\ \\mathbf H = (1\\ \\ 0),\\ \\mathbf Q = q\\begin{pmatrix}\\Delta t^4/4 & \\Delta t^3/2\\\\ \\Delta t^3/2 & \\Delta t^2\\end{pmatrix},\\ \\Delta t = 0.1\\,\\mathrm s'
                    }
                  />
                ) : (
                  <Tex block math={'\\mathbf F = 1,\\ \\mathbf H = 1,\\ \\mathbf Q = q'} />
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
                {t('Assumes a linear model and Gaussian noise. For nonlinear systems one linearises around the estimate (extended Kalman filter, EKF) or propagates sample points (unscented, UKF).')}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

const gauss = (x: number, m: number, v: number) => Math.exp(-((x - m) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v);

/** prior, measurement and posterior as bell curves: the posterior is narrower than both */
function GaussianStep({ prior, meas, post, truth }: { prior: { m: number; v: number }; meas: { m: number; v: number }; post: { m: number; v: number }; truth: number }) {
  const sd = Math.sqrt(Math.max(prior.v, meas.v, 1e-9));
  const lo = Math.min(prior.m, meas.m, post.m) - 3.5 * sd;
  const hi = Math.max(prior.m, meas.m, post.m) + 3.5 * sd;
  const xs = Array.from({ length: 241 }, (_, i) => lo + ((hi - lo) * i) / 240);
  return (
    <LineChartBox
      height={200}
      series={[
        { name: t('prediction N(x̂⁻, P⁻)'), data: xs.map((x) => ({ x, y: gauss(x, prior.m, Math.max(prior.v, 1e-9)) })), color: C.prior, dashed: true },
        { name: t('measurement N(z, r)'), data: xs.map((x) => ({ x, y: gauss(x, meas.m, meas.v) })), color: C.z, dashed: true },
        { name: t('estimate N(x̂, P)'), data: xs.map((x) => ({ x, y: gauss(x, post.m, Math.max(post.v, 1e-9)) })), color: C.post },
      ]}
      xLabel="x"
      yLabel=""
      refX={[{ x: truth, label: t('truth') }]}
      digits={2}
    />
  );
}
