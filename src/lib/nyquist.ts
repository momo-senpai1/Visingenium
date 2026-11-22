/**
 * Full Nyquist criterion for an open loop L(s) = b(s)/a(s)·e^{−sTt}.
 *
 * The Nyquist contour runs up the line Re s = ε (ε > 0 tiny) and closes through the right
 * half-plane; this is the usual contour with poles on the imaginary axis bypassed on the right.
 * Then  Z = P + N  with P open-loop poles in the right half-plane, N clockwise encirclements of −1
 * by L, Z closed-loop poles in the right half-plane.
 */

import { evalC, roots, type TF } from '@/engine/control/poly';

interface Cx {
  re: number;
  im: number;
}
const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

/** L at a complex point s, dead time included */
export function evalL(L: TF, s: Cx): Cx {
  const h = cdiv(evalC(L.num, s), evalC(L.den, s));
  const T = L.delay ?? 0;
  if (!T) return h;
  const m = Math.exp(-s.re * T);
  return cmul(h, { re: m * Math.cos(s.im * T), im: -m * Math.sin(s.im * T) });
}

export interface NyquistResult {
  /** open-loop poles in the right half-plane */
  P: number;
  /** open-loop poles on the imaginary axis (bypassed on the right) and at the origin */
  onAxis: number;
  atOrigin: number;
  /** clockwise encirclements of −1 */
  N: number;
  /** closed-loop poles in the right half-plane */
  Z: number;
  stable: boolean;
  /** L along the contour for ω ≥ 0 (with ω), for plotting; the ω < 0 half is the mirror image */
  path: { w: number; re: number; im: number }[];
  /** L does not vanish for ω → ∞ (improper loop): the large arc is not mapped to a point */
  improper: boolean;
}

export function nyquist(L: TF): NyquistResult {
  const poles = roots(L.den);
  const scale = Math.max(1e-3, ...poles.map((p) => Math.hypot(p.re, p.im)), ...roots(L.num).map((z) => Math.hypot(z.re, z.im)));
  const tol = 1e-7 * scale;
  const P = poles.filter((p) => p.re > tol).length;
  const atOrigin = poles.filter((p) => Math.hypot(p.re, p.im) <= tol).length;
  const onAxis = poles.filter((p) => Math.abs(p.re) <= tol && Math.hypot(p.re, p.im) > tol).length;
  const nNum = L.num.length - 1;
  const nDen = L.den.length - 1;
  const improper = nNum > nDen;
  // upper limit: far beyond the dynamics and where |L| has become small
  let R = 100 * scale;
  for (let k = 0; k < 60; k++) {
    const v = evalL(L, { re: 0, im: R });
    if (Math.hypot(v.re, v.im) < 1e-3 || improper || nNum === nDen) break;
    R *= 3;
  }
  R = Math.min(R, 1e9);
  const eps = 1e-6 * Math.min(1, scale);
  // ω = ε·sinh(u): dense near 0 (integrators) and logarithmic further out
  const U = Math.asinh(R / eps);
  const Tt = L.delay ?? 0;
  const n = Math.min(400000, Math.max(30000, Math.ceil((Tt * R) / 0.2)));
  let wind = 0;
  let prev: number | null = null;
  const path: NyquistResult['path'] = [];
  for (let k = 0; k <= n; k++) {
    const u = -U + (2 * U * k) / n;
    const w = eps * Math.sinh(u);
    const v = evalL(L, { re: eps, im: w });
    const a = Math.atan2(v.im, v.re + 1);
    if (prev !== null) {
      let d = a - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      wind += d;
    }
    prev = a;
    if (w >= 0 && k % Math.max(1, Math.round(n / 4000)) === 0) path.push({ w, re: v.re, im: v.im });
  }
  // contour runs upwards and closes clockwise through the RHP: N_cw = −(counter-clockwise turns)
  const N = -Math.round(wind / (2 * Math.PI)) || 0; // no −0
  const Z = P + N;
  return { P, onAxis, atOrigin, N, Z, stable: Z === 0 && !improper, path, improper };
}
