/**
 * Analog filter design: Butterworth, Chebyshev type I and Bessel low-pass
 * prototypes (cut-off 1 rad/s), frequency transformations to low-, high-,
 * band-pass and band-stop, second-order sections and Sallen–Key values.
 */

import { add, mul, scale, tf, trim, type C, type Poly, type TF } from './poly';

export type Approx = 'butterworth' | 'chebyshev' | 'bessel';
export type FType = 'lowpass' | 'highpass' | 'bandpass' | 'bandstop';

/** Bessel poles normalised to −3 dB at 1 rad/s (orders 1…6). */
const BESSEL: Record<number, C[]> = {
  1: [{ re: -1, im: 0 }],
  2: [{ re: -1.1016, im: 0.6368 }],
  3: [{ re: -1.0474, im: 0.9992 }, { re: -1.3226, im: 0 }],
  4: [{ re: -0.9952, im: 1.2571 }, { re: -1.3700, im: 0.4102 }],
  5: [{ re: -0.9576, im: 1.4711 }, { re: -1.3808, im: 0.7179 }, { re: -1.5023, im: 0 }],
  6: [{ re: -0.9306, im: 1.6620 }, { re: -1.3818, im: 0.9714 }, { re: -1.5714, im: 0.3213 }],
};

/** Prototype poles in the upper half plane (and real poles), cut-off 1 rad/s. */
export function prototypePoles(approx: Approx, n: number, rippleDb = 1): C[] {
  if (approx === 'bessel') return BESSEL[Math.min(6, Math.max(1, n))]!;
  const out: C[] = [];
  if (approx === 'butterworth') {
    for (let k = 0; k < Math.ceil(n / 2); k++) {
      const th = (Math.PI * (2 * k + 1)) / (2 * n) + Math.PI / 2;
      out.push({ re: Math.cos(th), im: Math.abs(Math.sin(th)) < 1e-12 ? 0 : Math.abs(Math.sin(th)) });
    }
    return out;
  }
  const eps = Math.sqrt(10 ** (rippleDb / 10) - 1);
  const mu = Math.asinh(1 / eps) / n;
  for (let k = 0; k < Math.ceil(n / 2); k++) {
    const th = (Math.PI * (2 * k + 1)) / (2 * n);
    const re = -Math.sinh(mu) * Math.sin(th);
    const im = Math.cosh(mu) * Math.cos(th);
    out.push({ re, im: Math.abs(im) < 1e-12 ? 0 : Math.abs(im) });
  }
  return out;
}

export interface Section {
  /** second-order (or first-order) section of the low-pass prototype: ω0 and Q (first order: Q = 0) */
  w0: number;
  Q: number;
  tf: TF;
}

export interface FilterDesign {
  tf: TF;
  /** sections at the real frequency scale */
  sections: Section[];
  /** prototype poles at 1 rad/s */
  poles: C[];
}

/** Build the filter: wc = cut-off (lowpass/highpass) or centre frequency (bandpass/bandstop) in rad/s, bw = bandwidth in rad/s. */
export function designFilter(approx: Approx, type: FType, n: number, wc: number, bw: number, rippleDb = 1): FilterDesign {
  const poles = prototypePoles(approx, n, rippleDb);
  // prototype sections (low-pass, 1 rad/s)
  const proto: { w0: number; Q: number }[] = poles.map((p) => (p.im === 0 ? { w0: -p.re, Q: 0 } : { w0: Math.hypot(p.re, p.im), Q: Math.hypot(p.re, p.im) / (-2 * p.re) }));
  // Chebyshev even order: pass-band gain normalised to the ripple bottom
  const g0 = approx === 'chebyshev' && n % 2 === 0 ? 1 / Math.sqrt(1 + (10 ** (rippleDb / 10) - 1)) : 1;
  const sections: Section[] = [];
  let num: Poly = [g0];
  let den: Poly = [1];
  const push = (sn: Poly, sd: Poly, w0: number, Q: number) => {
    num = mul(num, sn);
    den = mul(den, sd);
    sections.push({ w0, Q, tf: tf(sn, sd) });
  };
  for (const { w0, Q } of proto) {
    if (type === 'lowpass') {
      const W = w0 * wc;
      if (Q === 0) push([W], [W, 1], W, 0);
      else push([W * W], [W * W, W / Q, 1], W, Q);
    } else if (type === 'highpass') {
      const W = wc / w0;
      if (Q === 0) push([0, 1], [W, 1], W, 0);
      else push([0, 0, 1], [W * W, W / Q, 1], W, Q);
    } else {
      // band transformations s → (s² + ω0²)/(B s) (bandpass) or B s/(s² + ω0²) (bandstop); applied to each prototype factor
      const w2 = wc * wc;
      const B = bw;
      if (Q === 0) {
        // a/(s + a)
        const a = w0;
        if (type === 'bandpass') push([0, a * B], [w2, a * B, 1], wc, wc / (a * B));
        else push([w2, 0, 1], [w2, B / a, 1], wc, (wc * a) / B);
      } else {
        // W²/(s² + W/Q s + W²) — gives a 4th-order factor, split into two biquads by root finding
        const W = w0;
        const p = [1, W / Q, W * W]; // descending-like helper: s² + bs + c with b = W/Q, c = W²
        const b = p[1]!;
        const c = p[2]!;
        let dnum: Poly;
        let dden: Poly;
        if (type === 'bandpass') {
          // (s²+w2)² + b B s (s² + w2) + c B² s²  over  c B² s²
          dden = add(add(mul([w2, 0, 1], [w2, 0, 1]), scale(mul([0, 1], [w2, 0, 1]), b * B)), [0, 0, c * B * B]);
          dnum = [0, 0, c * B * B];
        } else {
          // c (s²+w2)² over c (s²+w2)² + b B s (s² + w2) + B² s²
          dden = add(add(scale(mul([w2, 0, 1], [w2, 0, 1]), c), scale(mul([0, 1], [w2, 0, 1]), b * B)), [0, 0, B * B]);
          dnum = scale(mul([w2, 0, 1], [w2, 0, 1]), c);
        }
        const lead = dden.at(-1)!;
        num = mul(num, scale(dnum, 1 / lead));
        den = mul(den, scale(dden, 1 / lead));
        sections.push({ w0: wc, Q: wc / B, tf: tf(scale(dnum, 1 / lead), scale(dden, 1 / lead)) });
      }
    }
  }
  return { tf: tf(trim(num), trim(den)), sections, poles };
}

/** Unity-gain Sallen–Key values for a low-pass or high-pass section with ω0, Q (choose C, get R) — first order: RC. */
export function sallenKey(type: 'lowpass' | 'highpass', w0: number, Q: number, Cbase = 10e-9) {
  if (Q === 0) return { R1: 1 / (w0 * Cbase), R2: null as number | null, C1: Cbase, C2: null as number | null };
  if (type === 'lowpass') {
    // equal R: C1 = 2Q/(ω0 R), C2 = 1/(2Q ω0 R) → pick R from C2 = Cbase
    const R = 1 / (2 * Q * w0 * Cbase);
    return { R1: R, R2: R, C1: (2 * Q) / (w0 * R), C2: Cbase };
  }
  // equal C: R1 = 1/(2Q ω0 C) (to ground... first), R2 = 2Q/(ω0 C)
  return { R1: 1 / (2 * Q * w0 * Cbase), R2: (2 * Q) / (w0 * Cbase), C1: Cbase, C2: Cbase };
}
