import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { designFilter, sallenKey, type Approx, type FType } from '@/engine/control/filters';
import { bode, freq, roots, stepResponse, tfTex } from '@/engine/control/poly';
import { t } from '@/i18n';

interface FState {
  approx: Approx;
  type: FType;
  n: number;
  fc: number;
  bw: number;
  ripple: number;
  cbase: number;
  set: (p: Partial<Omit<FState, 'set'>>) => void;
}
const useFilter = create<FState>()(
  persist((set) => ({ approx: 'butterworth', type: 'lowpass', n: 4, fc: 1000, bw: 500, ripple: 1, cbase: 10, set: (p) => set(p) }), {
    name: 'ts-control-filter',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const eng = (v: number | null, unit: string) => {
  if (v === null || !Number.isFinite(v)) return '–';
  const pre: [number, string][] = [
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];
  const [k, p] = pre.find(([k]) => Math.abs(v) >= k) ?? [1e-12, 'p'];
  return `${nf(v / k, 3)} ${p}${unit}`;
};

export default function FilterPage() {
  const s = useFilter();
  const n = Math.max(1, Math.min(10, Math.round(s.n)));
  const wc = 2 * Math.PI * Math.max(s.fc, 1e-3);
  const bwr = 2 * Math.PI * Math.max(s.bw, 1e-3);
  const band = s.type === 'bandpass' || s.type === 'bandstop';
  const d = useMemo(() => designFilter(s.approx, s.type, n, wc, bwr, s.ripple), [s.approx, s.type, n, wc, bwr, s.ripple]);
  const fMin = s.fc / 100;
  const fMax = s.fc * 100;
  const bd = useMemo(() => bode(d.tf, 2 * Math.PI * fMin, 2 * Math.PI * fMax, 500), [d, fMin, fMax]);
  const tEnd = (band ? 40 : 12) / (s.fc * (s.approx === 'bessel' ? 1 : 1)) * (n / 4 + 0.5);
  const step = useMemo(() => stepResponse(d.tf, tEnd, 1500), [d, tEnd]);
  const poles = useMemo(() => roots(d.tf.den), [d]);
  const atFc = freq(d.tf, wc);
  const db = (f: number) => 20 * Math.log10(freq(d.tf, 2 * Math.PI * f).mag);
  // -3 dB points
  const f3: number[] = [];
  for (let i = 1; i < bd.length; i++) {
    const a = bd[i - 1]!;
    const b = bd[i]!;
    const peak = Math.max(...bd.map((p) => p.db));
    const lv = peak - 3.0103;
    if ((a.db - lv) * (b.db - lv) < 0) f3.push((a.w * (b.w / a.w) ** ((a.db - lv) / (a.db - b.db))) / (2 * Math.PI));
  }
  const sk = !band ? d.sections.map((sec) => sallenKey(s.type as 'lowpass' | 'highpass', sec.w0, sec.Q, s.cbase * 1e-9)) : [];

  return (
    <div className="grid gap-2 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Filter specification">
          <div className="space-y-1.5">
            <label className="block text-[10px] text-plant-400">
              {t('Approximation')}
              <select className={fieldCls} value={s.approx} onChange={(e) => s.set({ approx: e.target.value as Approx })}>
                <option value="butterworth">{t('Butterworth (maximally flat)')}</option>
                <option value="chebyshev">{t('Chebyshev I (ripple, steep)')}</option>
                <option value="bessel">{t('Bessel (linear phase)')}</option>
              </select>
            </label>
            <label className="block text-[10px] text-plant-400">
              {t('Type')}
              <select className={fieldCls} value={s.type} onChange={(e) => s.set({ type: e.target.value as FType })}>
                <option value="lowpass">{t('Low-pass')}</option>
                <option value="highpass">{t('High-pass')}</option>
                <option value="bandpass">{t('Band-pass')}</option>
                <option value="bandstop">{t('Band-stop (notch)')}</option>
              </select>
            </label>
            <NumRow label={t('Order n')} value={n} onChange={(v) => s.set({ n: v })} />
            <NumRow label={band ? t('Centre frequency f₀') : t('Cut-off frequency f_c')} unit="Hz" value={s.fc} onChange={(v) => s.set({ fc: v })} />
            {band && <NumRow label={t('Bandwidth B')} unit="Hz" value={s.bw} onChange={(v) => s.set({ bw: v })} />}
            {s.approx === 'chebyshev' && <NumRow label={t('Pass-band ripple')} unit="dB" value={s.ripple} onChange={(v) => s.set({ ripple: v })} />}
            {s.approx === 'bessel' && n > 6 && <Notice tone="warning">{t('Bessel table up to order 6: order clipped.')}</Notice>}
          </div>
        </Card>
        {!band && (
          <Card title="Circuit: unity-gain Sallen–Key stages">
            <NumRow label={t('Chosen capacitor C')} unit="nF" value={s.cbase} onChange={(v) => s.set({ cbase: v })} />
            <div className="mt-2 space-y-1.5">
              {d.sections.map((sec, i) => (
                <div key={i} className="rounded border border-white/[0.06] p-1.5 font-mono text-[10px] text-plant-300">
                  <p className="text-plant-100">
                    {t('Stage')} {i + 1}: {sec.Q === 0 ? t('1st order (RC)') : `Q = ${nf(sec.Q, 4)}`} · f₀ = {eng(sec.w0 / (2 * Math.PI), 'Hz')}
                  </p>
                  <p>
                    R1 = {eng(sk[i]!.R1, 'Ω')}
                    {sk[i]!.R2 !== null && ` · R2 = ${eng(sk[i]!.R2, 'Ω')}`}
                  </p>
                  <p>
                    C1 = {eng(sk[i]!.C1, 'F')}
                    {sk[i]!.C2 !== null && ` · C2 = ${eng(sk[i]!.C2, 'F')}`}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-plant-500">
              {s.type === 'lowpass'
                ? t('Low-pass: R1 = R2 = R, C1 = 2Q/(ω₀R) (feedback capacitor), C2 = 1/(2Qω₀R) (to ground). Op-amp as voltage follower.')
                : t('High-pass: C1 = C2 = C, R1 = 1/(2Qω₀C) (feedback resistor), R2 = 2Q/(ω₀C) (to ground). Op-amp as voltage follower.')}{' '}
              {t('Try it in the circuit simulator: example "Sallen–Key low-pass".')}
            </p>
          </Card>
        )}
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label={t('Order')} value={String(d.tf.den.length - 1)} sub={`${d.sections.length} ${t('stages')}`} />
          <Kpi label={band ? '|H(f₀)|' : '|H(f_c)|'} value={nf(20 * Math.log10(atFc.mag), 2)} unit="dB" />
          <Kpi label="f₋₃dB" value={f3.length ? f3.map((f) => eng(f, 'Hz')).join(' · ') : '–'} small />
          <Kpi label={band ? '|H| @ f₀/10' : s.type === 'lowpass' ? '|H| @ 10 f_c' : '|H| @ f_c/10'} value={nf(db(s.type === 'lowpass' ? s.fc * 10 : s.fc / 10), 1)} unit="dB" sub={band ? '' : `≈ −${20 * n} dB ${t('per decade')}`} />
        </div>
        <Card title="Transfer function">
          <div className="space-y-1 overflow-x-auto text-[12px] text-plant-100">
            {d.sections.map((sec, i) => (
              <Tex key={i} block math={`H_{${i + 1}}(s) = ${tfTex(sec.tf)}`} />
            ))}
            <p className="text-[10px] text-plant-500">{t('H(s) = product of the stages (cascade of decoupled op-amp stages).')}</p>
          </div>
        </Card>
        <div className="grid gap-2 lg:grid-cols-2">
          <Card title="Magnitude response">
            <LineChartBox series={[{ name: '|H| [dB]', data: bd.map((p) => ({ x: p.w / (2 * Math.PI), y: Math.max(p.db, -120) })) }]} xLabel="f [Hz]" yLabel="dB" logX refX={f3.map((f) => ({ x: f, label: '−3 dB' }))} digits={0} />
          </Card>
          <Card title="Phase response">
            <LineChartBox series={[{ name: 'φ [°]', data: bd.map((p) => ({ x: p.w / (2 * Math.PI), y: p.deg })), color: 'rgb(var(--sig-vapor))' }]} xLabel="f [Hz]" yLabel="°" logX digits={0} />
          </Card>
          <Card title="Step response">
            <LineChartBox series={[{ name: 'y(t)', data: step.t.map((tt, i) => ({ x: tt * 1000, y: step.y[i]! })) }]} xLabel="t [ms]" yLabel="y" digits={2} />
          </Card>
          <Card title="Poles (normalised to the prototype)">
            <PoleList poles={d.poles} />
            <p className="mt-1 font-mono text-[10px] text-plant-500">
              {t('poles of H(s)')}: {poles.length}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PoleList({ poles }: { poles: { re: number; im: number }[] }) {
  const W = 300;
  const H = 220;
  // the prototype lists one pole of each conjugate pair: mirror them
  const all = poles.flatMap((p) => (Math.abs(p.im) > 1e-12 ? [p, { re: p.re, im: -p.im }] : [p]));
  const R = 1.15 * Math.max(1, ...all.map((p) => Math.hypot(p.re, p.im)));
  const k = (H / 2 - 12) / R;
  const sx = (x: number) => W * 0.7 + x * k;
  const sy = (y: number) => H / 2 - y * k;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md" role="img" aria-label={t('Pole-zero map')}>
      <line x1={0} y1={sy(0)} x2={W} y2={sy(0)} stroke="rgb(var(--plant-500))" />
      <line x1={sx(0)} y1={0} x2={sx(0)} y2={H} stroke="rgb(var(--plant-500))" />
      <circle cx={sx(0)} cy={sy(0)} r={k} fill="none" stroke="rgb(var(--plant-600))" strokeDasharray="3 3" />
      {all.map((p, i) => (
        <path key={i} d={`M${sx(p.re) - 4},${sy(p.im) - 4}l8,8m0,-8l-8,8`} stroke="rgb(var(--sig-vapor))" strokeWidth={2} />
      ))}
      <text x={4} y={H - 4} className="text-[9px]" style={{ fill: 'rgb(var(--plant-400))' }}>
        {t('dashed: unit circle (Butterworth poles lie on it)')}
      </text>
    </svg>
  );
}
