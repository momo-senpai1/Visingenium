/** Thermal radiation: black body, gray two-surface exchange, shields, view factors. */

export const SIGMA = 5.670374e-8;
const C1 = 3.741771852e8; // W·µm⁴/m²
const C2 = 1.438776877e4; // µm·K
export const WIEN = 2897.771955; // µm·K

/** Spectral emissive power of a black body E_bλ [W/(m²·µm)], λ in µm, T in K. */
export const planck = (lam: number, T: number) => C1 / (lam ** 5 * (Math.exp(C2 / (lam * T)) - 1));

/** Fraction of black-body emission between 0 and λ (series, exact). */
export function bandFraction(lamT: number): number {
  const z = C2 / lamT;
  let s = 0;
  for (let n = 1; n <= 60; n++) s += (Math.exp(-n * z) / n) * (z ** 3 + (3 * z * z) / n + (6 * z) / n ** 2 + 6 / n ** 3);
  return Math.min(1, (15 / Math.PI ** 4) * s);
}

export type Arrangement = 'plates' | 'cylinders' | 'spheres' | 'enclosed';

/** Net exchange between two gray diffuse surfaces (W per m² of surface 1). */
export function exchange(arr: Arrangement, T1: number, T2: number, e1: number, e2: number, ratio = 0.5) {
  // ratio = A1/A2 (r1/r2 for cylinders, (r1/r2)² for spheres)
  const A12 = arr === 'plates' ? 1 : arr === 'enclosed' ? 0 : ratio;
  const denom = 1 / e1 + A12 * (1 / e2 - 1);
  const C12 = SIGMA / denom;
  return { q: C12 * (T1 ** 4 - T2 ** 4), C12, A12 };
}

/** Parallel plates with n thin shields (emissivity es on both sides). */
export function shields(T1: number, T2: number, e1: number, e2: number, n: number, es: number) {
  const R = 1 / e1 + 1 / e2 - 1 + n * (2 / es - 1);
  return (SIGMA * (T1 ** 4 - T2 ** 4)) / R;
}

/** Radiative heat transfer coefficient ε·σ·(T1² + T2²)(T1 + T2). */
export const alphaRad = (eps: number, T1: number, T2: number) => eps * SIGMA * (T1 * T1 + T2 * T2) * (T1 + T2);

/** View factors (analytical, Incropera table 13.1/13.2). */
export function viewFactor(kind: 'disks' | 'parallelRect' | 'perpRect', a: number, b: number, c: number): number {
  if (kind === 'disks') {
    // coaxial disks: radius r1 = a, r2 = b, distance c
    const R1 = a / c;
    const R2 = b / c;
    const S = 1 + (1 + R2 * R2) / (R1 * R1);
    return 0.5 * (S - Math.sqrt(S * S - 4 * (R2 / R1) ** 2));
  }
  if (kind === 'parallelRect') {
    // aligned parallel rectangles X × Y at distance L
    const X = a / c;
    const Y = b / c;
    const x1 = Math.sqrt(1 + X * X);
    const y1 = Math.sqrt(1 + Y * Y);
    return (2 / (Math.PI * X * Y)) * (Math.log(Math.sqrt(((1 + X * X) * (1 + Y * Y)) / (1 + X * X + Y * Y))) + X * y1 * Math.atan(X / y1) + Y * x1 * Math.atan(Y / x1) - X * Math.atan(X) - Y * Math.atan(Y));
  }
  // perpendicular rectangles with a common edge of length a: widths b (surface i) and c (surface j)
  const H = c / a; // height of j / common edge... using Incropera: W = w_i/l, H = w_j/l with l = common edge
  const W = b / a;
  const t1 = W * Math.atan(1 / W) + H * Math.atan(1 / H) - Math.sqrt(H * H + W * W) * Math.atan(1 / Math.sqrt(H * H + W * W));
  const A = ((1 + W * W) * (1 + H * H)) / (1 + W * W + H * H);
  const B = ((W * W * (1 + W * W + H * H)) / ((1 + W * W) * (W * W + H * H))) ** (W * W);
  const C = ((H * H * (1 + H * H + W * W)) / ((1 + H * H) * (H * H + W * W))) ** (H * H);
  return (1 / (Math.PI * W)) * (t1 + 0.25 * Math.log(A * B * C));
}
