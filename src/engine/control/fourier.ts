/** Signals, Fourier series and the FFT. */

export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'pulse' | 'twotone' | 'am' | 'noise';

export interface SignalSpec {
  wave: Wave;
  f: number;
  amp: number;
  duty?: number;
  f2?: number;
  amp2?: number;
  m?: number;
}

/** Deterministic pseudo-random numbers for the noise signal. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function sample(sig: SignalSpec, t: number[]): number[] {
  const { f, amp } = sig;
  const r = rng(12345);
  return t.map((tt) => {
    const ph = (((tt * f) % 1) + 1) % 1;
    switch (sig.wave) {
      case 'sine':
        return amp * Math.sin(2 * Math.PI * f * tt);
      case 'square':
        return ph < 0.5 ? amp : -amp;
      case 'triangle':
        return amp * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph);
      case 'sawtooth':
        return amp * (2 * ph - 1);
      case 'pulse':
        return ph < (sig.duty ?? 0.25) ? amp : 0;
      case 'twotone':
        return amp * Math.sin(2 * Math.PI * f * tt) + (sig.amp2 ?? 0.5) * Math.sin(2 * Math.PI * (sig.f2 ?? 3 * f) * tt);
      case 'am':
        return amp * (1 + (sig.m ?? 0.5) * Math.sin(2 * Math.PI * (sig.f2 ?? f / 10) * tt)) * Math.sin(2 * Math.PI * f * tt);
      case 'noise':
        return amp * Math.sin(2 * Math.PI * f * tt) + (sig.amp2 ?? 0.5) * (2 * r() - 1);
    }
  });
}

/** Fourier series coefficients of the periodic waves: a0/2 + Σ (a_k cos kωt + b_k sin kωt). */
export function seriesCoeffs(sig: SignalSpec, K: number): { a0: number; a: number[]; b: number[] } {
  const A = sig.amp;
  const a = new Array<number>(K + 1).fill(0);
  const b = new Array<number>(K + 1).fill(0);
  let a0 = 0;
  for (let k = 1; k <= K; k++) {
    switch (sig.wave) {
      case 'sine':
        b[k] = k === 1 ? A : 0;
        break;
      case 'square':
        b[k] = k % 2 ? (4 * A) / (Math.PI * k) : 0;
        break;
      case 'triangle':
        // starts at −A, rises: a_k for odd k = −8A/(π²k²)
        a[k] = k % 2 ? (-8 * A) / (Math.PI * Math.PI * k * k) : 0;
        break;
      case 'sawtooth':
        b[k] = (-2 * A) / (Math.PI * k);
        break;
      case 'pulse': {
        const d = sig.duty ?? 0.25;
        a[k] = ((A / (Math.PI * k)) * Math.sin(2 * Math.PI * k * d));
        b[k] = (A / (Math.PI * k)) * (1 - Math.cos(2 * Math.PI * k * d));
        break;
      }
      default:
        break;
    }
  }
  if (sig.wave === 'pulse') a0 = 2 * A * (sig.duty ?? 0.25);
  return { a0, a, b };
}

export function synthesize(c: { a0: number; a: number[]; b: number[] }, f: number, t: number[], K: number): number[] {
  return t.map((tt) => {
    let s = c.a0 / 2;
    for (let k = 1; k <= K; k++) s += (c.a[k] ?? 0) * Math.cos(2 * Math.PI * k * f * tt) + (c.b[k] ?? 0) * Math.sin(2 * Math.PI * k * f * tt);
    return s;
  });
}

export type Window = 'rect' | 'hann' | 'hamming' | 'blackman';
export function windowFn(w: Window, N: number): number[] {
  return Array.from({ length: N }, (_, n) => {
    const x = (2 * Math.PI * n) / (N - 1);
    switch (w) {
      case 'hann':
        return 0.5 - 0.5 * Math.cos(x);
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(x);
      case 'blackman':
        return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
      default:
        return 1;
    }
  });
}

/** In-place radix-2 FFT; N must be a power of two. */
export function fft(re: number[], im: number[]) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * wr - im[i + k + len / 2]! * wi;
        const vi = re[i + k + len / 2]! * wi + im[i + k + len / 2]! * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

/** One-sided amplitude spectrum of x sampled at fs, with window compensation. */
export function spectrum(x: number[], fs: number, w: Window) {
  const N = x.length;
  const win = windowFn(w, N);
  const cg = win.reduce((a, b) => a + b, 0) / N;
  const re = x.map((v, i) => v * win[i]!);
  const im = new Array<number>(N).fill(0);
  fft(re, im);
  return Array.from({ length: N / 2 + 1 }, (_, k) => ({ f: (k * fs) / N, amp: ((k === 0 || k === N / 2 ? 1 : 2) * Math.hypot(re[k]!, im[k]!)) / N / cg }));
}
