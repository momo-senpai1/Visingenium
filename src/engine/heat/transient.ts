/**
 * Transient conduction: lumped capacitance, semi-infinite body and the series
 * solutions for a plane wall, an infinite cylinder and a sphere with
 * convection at the surface (Gröber / Heisler).
 */

import { brent } from '@/engine/numerics';

/** Error function (Abramowitz–Stegun 7.1.26 refined: max error ≈ 1.2e-7). */
export function erf(x: number): number {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.5 * a);
  const y =
    1 -
    t *
      Math.exp(
        -a * a -
          1.26551223 +
          t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
      );
  return s * y;
}
export const erfc = (x: number) => 1 - erf(x);

/** Bessel J0, J1 (Numerical Recipes rational approximations). */
export function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const b = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return a / b;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 0.785398164;
  const p = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const q = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
}
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const b = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a / b;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const p = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const q = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q) * Math.sign(x);
}

export type Body = 'plate' | 'cylinder' | 'sphere';

/** Eigenvalues ζ_n of the characteristic equation for Biot number Bi. */
export function eigenvalues(body: Body, Bi: number, n = 30): number[] {
  const out: number[] = [];
  const f =
    body === 'plate'
      ? (z: number) => z * Math.sin(z) - Bi * Math.cos(z)
      : body === 'cylinder'
        ? (z: number) => z * besselJ1(z) - Bi * besselJ0(z)
        : (z: number) => 1 - z / Math.tan(z) - Bi;
  // bracket by scanning
  const step = 0.01;
  let a = 1e-6;
  let fa = body === 'sphere' ? -Bi : f(a);
  for (let z = a + step; out.length < n && z < 400; z += step) {
    const fz = f(z);
    if (Number.isFinite(fz) && Number.isFinite(fa) && fa * fz < 0 && Math.abs(fz - fa) < 50) {
      try {
        out.push(brent(f, a, z, { tol: 1e-12 }));
      } catch {
        /* skip */
      }
    }
    a = z;
    fa = fz;
  }
  return out;
}

/** Dimensionless temperature θ = (T − T∞)/(T0 − T∞) at relative position ξ = x/R (0 = centre) and Fourier number Fo. */
export function seriesTheta(body: Body, Bi: number, Fo: number, xi: number, zs = eigenvalues(body, Bi)): number {
  let s = 0;
  for (const z of zs) {
    let C: number;
    let shape: number;
    if (body === 'plate') {
      C = (4 * Math.sin(z)) / (2 * z + Math.sin(2 * z));
      shape = Math.cos(z * xi);
    } else if (body === 'cylinder') {
      const j0 = besselJ0(z);
      const j1 = besselJ1(z);
      C = (2 * j1) / (z * (j0 * j0 + j1 * j1));
      shape = besselJ0(z * xi);
    } else {
      C = (4 * (Math.sin(z) - z * Math.cos(z))) / (2 * z - Math.sin(2 * z));
      shape = xi < 1e-9 ? 1 : Math.sin(z * xi) / (z * xi);
    }
    s += C * Math.exp(-z * z * Fo) * shape;
  }
  return s;
}

/** Semi-infinite body, surface suddenly at Ts (α = ∞) or exposed to T∞ with α (finite). */
export function semiInfinite(x: number, t: number, a: number, Ti: number, Tinf: number, alpha: number | null, lambda: number): number {
  if (t <= 0) return Ti;
  const eta = x / (2 * Math.sqrt(a * t));
  if (alpha === null) return Tinf + (Ti - Tinf) * erf(eta);
  const h = alpha / lambda;
  const term = Math.exp(h * x + h * h * a * t) * erfc(eta + h * Math.sqrt(a * t));
  const ratio = erfc(eta) - (Number.isFinite(term) ? term : 0);
  return Ti + (Tinf - Ti) * ratio;
}
