/**
 * Steady one-dimensional conduction through layered walls (plane, cylindrical,
 * spherical) with convection on both sides — the thermal-resistance method —
 * and straight fins / pins.
 */

export type Geometry = 'plane' | 'cylinder' | 'sphere';

export interface Layer {
  id: string;
  name: string;
  /** thickness [m] */
  s: number;
  /** thermal conductivity [W/(m·K)] */
  lambda: number;
}

export interface WallSpec {
  geometry: Geometry;
  layers: Layer[];
  /** plane: area [m²]; cylinder: length [m]; sphere: unused */
  A: number;
  L: number;
  /** inner radius [m] (cylinder, sphere) */
  ri: number;
  Ti: number;
  Ta: number;
  /** heat transfer coefficients [W/(m²K)]; ≤ 0 means the surface takes the fluid temperature */
  alphaI: number;
  alphaA: number;
}

export interface Resistance {
  label: string;
  kind: 'conv' | 'cond';
  /** [K/W] */
  R: number;
  /** temperature at the start and end of this resistance [°C] */
  T1: number;
  T2: number;
}

export interface WallResult {
  ok: boolean;
  Q: number;
  Rtot: number;
  res: Resistance[];
  /** overall coefficient k [W/(m²K)] (plane) or k·A per length (cylinder: W/(m·K)) */
  k: number;
  /** interface radii / positions [m] and temperatures [°C] */
  pos: number[];
  temps: number[];
  /** temperature profile through the solid */
  profile: { x: number; T: number; layer: number }[];
  /** heat flux density at the inner and outer surface [W/m²] */
  qi: number;
  qa: number;
}

const area = (g: Geometry, A: number, L: number, r: number) => (g === 'plane' ? A : g === 'cylinder' ? 2 * Math.PI * r * L : 4 * Math.PI * r * r);

export function layerResistance(g: Geometry, r1: number, r2: number, lambda: number, A: number, L: number) {
  if (g === 'plane') return (r2 - r1) / (lambda * A);
  if (g === 'cylinder') return Math.log(r2 / r1) / (2 * Math.PI * lambda * L);
  return (1 / r1 - 1 / r2) / (4 * Math.PI * lambda);
}

export function solveWall(w: WallSpec): WallResult {
  const g = w.geometry;
  const r0 = g === 'plane' ? 0 : w.ri;
  const pos = [r0];
  for (const l of w.layers) pos.push(pos.at(-1)! + l.s);
  const items: Omit<Resistance, 'T1' | 'T2'>[] = [];
  if (w.alphaI > 0) items.push({ label: 'α_i', kind: 'conv', R: 1 / (w.alphaI * area(g, w.A, w.L, pos[0]!)) });
  w.layers.forEach((l, i) => items.push({ label: l.name, kind: 'cond', R: layerResistance(g, pos[i]!, pos[i + 1]!, l.lambda, w.A, w.L) }));
  if (w.alphaA > 0) items.push({ label: 'α_a', kind: 'conv', R: 1 / (w.alphaA * area(g, w.A, w.L, pos.at(-1)!)) });
  const Rtot = items.reduce((a, b) => a + b.R, 0);
  const ok = Rtot > 0 && Number.isFinite(Rtot) && w.layers.every((l) => l.s > 0 && l.lambda > 0) && (g === 'plane' || w.ri > 0);
  const Q = ok ? (w.Ti - w.Ta) / Rtot : 0;
  let T = w.Ti;
  const res: Resistance[] = items.map((it) => {
    const T1 = T;
    T -= Q * it.R;
    return { ...it, T1, T2: T };
  });
  // surface / interface temperatures
  const temps: number[] = [];
  let k0 = w.alphaI > 0 ? 1 : 0;
  temps.push(res[k0 - 1]?.T2 ?? w.Ti);
  for (let i = 0; i < w.layers.length; i++) temps.push(res[k0 + i]!.T2);
  k0 = 0;
  const profile: WallResult['profile'] = [];
  w.layers.forEach((_l, i) => {
    const a = pos[i]!;
    const b = pos[i + 1]!;
    const Ta = temps[i]!;
    const Tb = temps[i + 1]!;
    for (let j = 0; j <= 20; j++) {
      const r = a + ((b - a) * j) / 20;
      const f = g === 'plane' ? (r - a) / (b - a) : g === 'cylinder' ? Math.log(r / a) / Math.log(b / a) : (1 / a - 1 / r) / (1 / a - 1 / b);
      profile.push({ x: r, T: Ta + (Tb - Ta) * f, layer: i });
    }
  });
  const Ai = area(g, w.A, w.L, pos[0]!);
  const Aa = area(g, w.A, w.L, pos.at(-1)!);
  const k = g === 'plane' ? 1 / (w.A * Rtot) : g === 'cylinder' ? 1 / (w.L * Rtot) : 1 / Rtot;
  return { ok, Q, Rtot, res, k, pos, temps, profile, qi: Q / Ai, qa: Q / Aa };
}

/** Critical insulation radius: cylinder λ/α, sphere 2λ/α. */
export const criticalRadius = (g: Geometry, lambda: number, alpha: number) => (g === 'sphere' ? (2 * lambda) / alpha : lambda / alpha);

// ---------------------------------------------------------------------------
// Fins and pins
// ---------------------------------------------------------------------------

export type FinShape = 'pin' | 'plate';
export type FinTip = 'adiabatic' | 'convective' | 'infinite';

export interface FinSpec {
  shape: FinShape;
  /** pin: diameter [m]; plate: thickness [m] */
  d: number;
  /** plate width [m] */
  w: number;
  /** length [m] */
  L: number;
  lambda: number;
  alpha: number;
  Tb: number;
  Tinf: number;
  tip: FinTip;
}

export interface FinResult {
  m: number;
  /** perimeter, cross-section [m, m²] */
  U: number;
  Ac: number;
  mL: number;
  Q: number;
  /** fin efficiency η_R and effectiveness ε */
  eta: number;
  eps: number;
  Ttip: number;
  profile: { x: number; T: number }[];
  /** Biot number across the fin, should be ≪ 1 for the 1-D model */
  Bi: number;
}

export function solveFin(f: FinSpec): FinResult {
  const U = f.shape === 'pin' ? Math.PI * f.d : 2 * (f.w + f.d);
  const Ac = f.shape === 'pin' ? (Math.PI * f.d * f.d) / 4 : f.w * f.d;
  const m = Math.sqrt((f.alpha * U) / (f.lambda * Ac));
  const th0 = f.Tb - f.Tinf;
  const M = Math.sqrt(f.alpha * U * f.lambda * Ac) * th0;
  const h = f.alpha / (m * f.lambda);
  const mL = m * f.L;
  let Q: number;
  let theta: (x: number) => number;
  if (f.tip === 'infinite') {
    Q = M;
    theta = (x) => Math.exp(-m * x);
  } else if (f.tip === 'adiabatic') {
    Q = M * Math.tanh(mL);
    theta = (x) => Math.cosh(m * (f.L - x)) / Math.cosh(mL);
  } else {
    const den = Math.cosh(mL) + h * Math.sinh(mL);
    Q = (M * (Math.sinh(mL) + h * Math.cosh(mL))) / den;
    theta = (x) => (Math.cosh(m * (f.L - x)) + h * Math.sinh(m * (f.L - x))) / den;
  }
  const Afin = U * f.L + (f.tip === 'convective' ? Ac : 0);
  const eta = f.tip === 'infinite' ? Number.NaN : Q / (f.alpha * Afin * th0);
  const eps = Q / (f.alpha * Ac * th0);
  const Lplot = f.tip === 'infinite' ? Math.max(f.L, 5 / m) : f.L;
  const profile = Array.from({ length: 101 }, (_, i) => {
    const x = (Lplot * i) / 100;
    return { x, T: f.Tinf + th0 * theta(x) };
  });
  const Bi = (f.alpha * (f.shape === 'pin' ? f.d / 2 : f.d / 2)) / f.lambda;
  return { m, U, Ac, mL, Q, eta, eps, Ttip: f.Tinf + th0 * theta(Lplot), profile, Bi };
}
