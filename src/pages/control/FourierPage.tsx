import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { sample, seriesCoeffs, spectrum, synthesize, type Wave, type Window } from '@/engine/control/fourier';
import { t } from '@/i18n';

interface S {
  wave: Wave;
  f: number;
  amp: number;
  duty: number;
  f2: number;
  amp2: number;
  K: number;
  fs: number;
  N: number;
  win: Window;
  set: (p: Partial<Omit<S, 'set'>>) => void;
}
const useF = create<S>()(
  persist((set) => ({ wave: 'square', f: 50, amp: 1, duty: 0.25, f2: 150, amp2: 0.5, K: 9, fs: 2000, N: 1024, win: 'hann', set: (p) => set(p) }), {
    name: 'ts-control-fourier',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ set: _s, ...r }) => r,
  }),
);

const WAVES: { id: Wave; label: string; periodic: boolean }[] = [
  { id: 'sine', label: 'Sine', periodic: true },
  { id: 'square', label: 'Square wave', periodic: true },
  { id: 'triangle', label: 'Triangle wave', periodic: true },
  { id: 'sawtooth', label: 'Sawtooth', periodic: true },
  { id: 'pulse', label: 'Pulse train (duty cycle)', periodic: true },
  { id: 'twotone', label: 'Two sines', periodic: false },
  { id: 'am', label: 'AM signal', periodic: false },
  { id: 'noise', label: 'Sine + noise', periodic: false },
];

const SERIES_TEX: Partial<Record<Wave, string>> = {
  sine: 'x(t) = A \\sin(\\omega t)',
  square: 'x(t) = \\frac{4A}{\\pi}\\sum_{k=1,3,5,\\dots} \\frac{\\sin(k\\omega t)}{k}',
  triangle: 'x(t) = -\\frac{8A}{\\pi^2}\\sum_{k=1,3,5,\\dots} \\frac{\\cos(k\\omega t)}{k^2}',
  sawtooth: 'x(t) = -\\frac{2A}{\\pi}\\sum_{k=1}^{\\infty} \\frac{\\sin(k\\omega t)}{k}',
  pulse: 'x(t) = A d + \\sum_{k=1}^{\\infty} \\frac{A}{\\pi k}\\left[\\sin(2\\pi k d)\\cos(k\\omega t) + (1-\\cos 2\\pi k d)\\sin(k\\omega t)\\right]',
};

export default function FourierPage() {
  const s = useF();
  const wave = WAVES.find((w) => w.id === s.wave) ?? WAVES[0]!;
  const sig = { wave: s.wave, f: Math.max(s.f, 1e-3), amp: s.amp, duty: s.duty, f2: s.f2, amp2: s.amp2, m: 0.5 };
  const K = Math.max(1, Math.min(200, Math.round(s.K)));
  const N = 2 ** Math.round(Math.log2(Math.max(64, Math.min(16384, s.N))));
  const fs = Math.max(s.fs, 1);
  // time plot: two periods
  const tt = useMemo(() => Array.from({ length: 800 }, (_, i) => (i / 799) * (2 / sig.f)), [sig.f]);
  const x = useMemo(() => sample(sig, tt), [s.wave, s.f, s.amp, s.duty, s.f2, s.amp2, tt]); // eslint-disable-line react-hooks/exhaustive-deps
  const coeffs = useMemo(() => seriesCoeffs(sig, K), [s.wave, s.f, s.amp, s.duty, K]); // eslint-disable-line react-hooks/exhaustive-deps
  const synth = useMemo(() => (wave.periodic ? synthesize(coeffs, sig.f, tt, K) : []), [coeffs, tt, K, wave.periodic, sig.f]);
  // sampled signal and FFT
  const ts = useMemo(() => Array.from({ length: N }, (_, i) => i / fs), [N, fs]);
  const xs = useMemo(() => sample(sig, ts), [s.wave, s.f, s.amp, s.duty, s.f2, s.amp2, ts]); // eslint-disable-line react-hooks/exhaustive-deps
  const spec = useMemo(() => spectrum(xs, fs, s.win), [xs, fs, s.win]);
  const amps = Array.from({ length: K }, (_, i) => Math.hypot(coeffs.a[i + 1] ?? 0, coeffs.b[i + 1] ?? 0));
  const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
  const fund = amps[0] ?? 0;
  const thd = fund > 1e-12 ? (Math.sqrt(amps.slice(1).reduce((a, v) => a + v * v, 0)) / fund) * 100 : null;
  const maxSignalF = s.wave === 'twotone' || s.wave === 'noise' ? Math.max(sig.f, s.f2) : sig.f;
  const aliased = maxSignalF > fs / 2;
  const peaks = spec
    .filter((q, i) => i > 0 && i < spec.length - 1 && q.amp >= spec[i - 1]!.amp && q.amp > spec[i + 1]!.amp)
    .sort((a, b) => b.amp - a.amp)
    .slice(0, 4)
    .sort((a, b) => a.f - b.f);

  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Signal">
          <div className="space-y-1.5">
            <select aria-label={t('Signal shape')} className={fieldCls} value={s.wave} onChange={(e) => s.set({ wave: e.target.value as Wave })}>
              {WAVES.map((w) => (
                <option key={w.id} value={w.id}>
                  {t(w.label)}
                </option>
              ))}
            </select>
            <NumRow label={t('Frequency f')} unit="Hz" value={s.f} onChange={(v) => s.set({ f: v })} />
            <NumRow label={t('Amplitude A')} value={s.amp} onChange={(v) => s.set({ amp: v })} />
            {s.wave === 'pulse' && <NumRow label={t('Duty cycle d')} value={s.duty} onChange={(v) => s.set({ duty: Math.min(0.99, Math.max(0.01, v)) })} />}
            {(s.wave === 'twotone' || s.wave === 'am') && <NumRow label={s.wave === 'am' ? t('Modulation frequency') : t('2nd frequency f₂')} unit="Hz" value={s.f2} onChange={(v) => s.set({ f2: v })} />}
            {(s.wave === 'twotone' || s.wave === 'noise') && <NumRow label={s.wave === 'noise' ? t('Noise amplitude') : t('2nd amplitude')} value={s.amp2} onChange={(v) => s.set({ amp2: v })} />}
          </div>
        </Card>
        {wave.periodic && (
          <Card title="Fourier series">
            <NumRow label={t('Number of harmonics K')} value={K} onChange={(v) => s.set({ K: v })} />
            <p className="mt-1 text-[10px] text-plant-500">{t('Square/sawtooth: the overshoot at the jumps stays ≈ 9 % no matter how large K gets (Gibbs phenomenon).')}</p>
          </Card>
        )}
        <Card title="Sampling and FFT">
          <div className="space-y-1.5">
            <NumRow label={t('Sampling rate f_s')} unit="Hz" value={s.fs} onChange={(v) => s.set({ fs: v })} />
            <NumRow label={t('Samples N (power of 2)')} value={N} onChange={(v) => s.set({ N: v })} />
            <label className="block text-[10px] text-plant-400">
              {t('Window')}
              <select className={fieldCls} value={s.win} onChange={(e) => s.set({ win: e.target.value as Window })}>
                <option value="rect">{t('Rectangle (none)')}</option>
                <option value="hann">Hann</option>
                <option value="hamming">Hamming</option>
                <option value="blackman">Blackman</option>
              </select>
            </label>
            <p className="text-[10px] text-plant-500">
              Δf = f_s / N = {nf(fs / N, 3)} Hz · f_Nyquist = {nf(fs / 2, 4)} Hz
            </p>
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label={t('RMS value')} value={nf(rms, 4)} />
          <Kpi label={t('Fundamental amplitude')} value={wave.periodic ? nf(fund, 4) : '–'} />
          <Kpi label="THD" value={wave.periodic && thd !== null ? nf(thd, 2) : '–'} unit={wave.periodic ? '%' : undefined} sub={t('harmonics up to K')} />
          <Kpi label={t('FFT peaks')} value={peaks.map((p) => nf(p.f, 4)).join(' · ')} unit="Hz" small />
        </div>
        {aliased && <Notice tone="warning">{t('Aliasing: the signal contains frequencies above f_s/2 — they appear mirrored at wrong frequencies in the spectrum. Increase f_s (Shannon: f_s > 2 f_max).')}</Notice>}
        {wave.periodic && SERIES_TEX[s.wave] && (
          <Card title="Series formula">
            <div className="overflow-x-auto text-[13px] text-plant-100">
              <Tex block math={SERIES_TEX[s.wave]!} />
              <Tex block math={`\\omega = 2\\pi f = ${nf(2 * Math.PI * sig.f, 4)}\\ \\mathrm{s^{-1}},\\quad X(j\\omega) = \\int_{-\\infty}^{\\infty} x(t)\\,e^{-j\\omega t}\\,dt`} />
            </div>
          </Card>
        )}
        <Card title="Time signal (2 periods)">
          <LineChartBox
            series={[
              { name: t('signal x(t)'), data: tt.map((v, i) => ({ x: v * 1000, y: x[i]! })) },
              ...(wave.periodic ? [{ name: `${t('Fourier synthesis')} K = ${K}`, data: tt.map((v, i) => ({ x: v * 1000, y: synth[i]! })), color: 'rgb(var(--sig-vapor))' }] : []),
            ]}
            xLabel="t [ms]"
            yLabel="x"
            digits={2}
          />
        </Card>
        <div className="grid gap-2 lg:grid-cols-2">
          {wave.periodic && (
            <Card title="Line spectrum (Fourier coefficients)">
              <LineChartBox series={[{ name: '|c_k|', data: amps.flatMap((a, i) => [{ x: (i + 1) * sig.f, y: 0 }, { x: (i + 1) * sig.f, y: a }, { x: (i + 1) * sig.f, y: 0 }]) }]} xLabel="f [Hz]" yLabel={t('amplitude')} digits={3} />
            </Card>
          )}
          <Card title="FFT amplitude spectrum">
            <LineChartBox series={[{ name: t('amplitude'), data: spec.map((p) => ({ x: p.f, y: p.amp })), color: 'rgb(var(--sig-liquid))' }]} xLabel="f [Hz]" yLabel={t('amplitude')} digits={3} />
          </Card>
          <Card title="FFT in dB">
            <LineChartBox series={[{ name: 'dB', data: spec.map((p) => ({ x: p.f, y: Math.max(-120, 20 * Math.log10(p.amp + 1e-12)) })), color: 'rgb(var(--sig-liquid))' }]} xLabel="f [Hz]" yLabel="dB" digits={0} />
          </Card>
        </div>
      </div>
    </div>
  );
}
