/**
 * Real gases with cubic equations of state (van der Waals, Redlich–Kwong, Peng–Robinson):
 * p(T, v), roots of the cubic in Z, fugacity coefficients, vapour pressure from equal fugacities
 * (= Maxwell's equal-area rule), departure functions and a numerical check of a Maxwell relation.
 *
 * Units: T [K], p [bar], molar volume v [m³/kmol] = [L/mol], R = 0.0831446 bar·m³/(kmol·K).
 */

export const RB = 0.0831446261815324; // bar·m³/(kmol·K)
export const RJ = 8.314462618; // J/(mol·K) = kJ/(kmol·K)

export interface Substance {
  id: string;
  name: string;
  Tc: number;
  pc: number;
  omega: number;
  M: number;
}
export const SUBSTANCES: Substance[] = [
  { id: 'co2', name: 'Carbon dioxide CO₂', Tc: 304.13, pc: 73.77, omega: 0.224, M: 44.01 },
  { id: 'n2', name: 'Nitrogen N₂', Tc: 126.19, pc: 33.96, omega: 0.037, M: 28.01 },
  { id: 'o2', name: 'Oxygen O₂', Tc: 154.58, pc: 50.43, omega: 0.022, M: 32.0 },
  { id: 'air', name: 'Air (pseudo-critical)', Tc: 132.5, pc: 37.7, omega: 0.035, M: 28.96 },
  { id: 'ch4', name: 'Methane CH₄', Tc: 190.56, pc: 45.99, omega: 0.011, M: 16.04 },
  { id: 'c3h8', name: 'Propane C₃H₈', Tc: 369.83, pc: 42.48, omega: 0.152, M: 44.1 },
  { id: 'nh3', name: 'Ammonia NH₃', Tc: 405.4, pc: 113.33, omega: 0.256, M: 17.03 },
  { id: 'r134a', name: 'R134a', Tc: 374.21, pc: 40.59, omega: 0.327, M: 102.03 },
  { id: 'h2o', name: 'Water H₂O', Tc: 647.1, pc: 220.64, omega: 0.344, M: 18.02 },
  { id: 'h2', name: 'Hydrogen H₂', Tc: 33.15, pc: 12.96, omega: -0.219, M: 2.016 },
];

export type EOS = 'ideal' | 'vdw' | 'rk' | 'pr';
export const EOS_LABEL: Record<EOS, string> = { ideal: 'Ideal gas', vdw: 'van der Waals', rk: 'Redlich–Kwong', pr: 'Peng–Robinson' };

/** cubic form p = RT/(v − b) − a(T)/(v² + u b v + w b²) */
interface Params {
  a: number;
  b: number;
  u: number;
  w: number;
  /** da/dT */
  dadT: number;
}
export function params(eos: EOS, s: Substance, T: number): Params {
  const { Tc, pc, omega } = s;
  if (eos === 'vdw') return { a: (27 * RB ** 2 * Tc ** 2) / (64 * pc), b: (RB * Tc) / (8 * pc), u: 0, w: 0, dadT: 0 };
  if (eos === 'rk') {
    const a0 = (0.42748 * RB ** 2 * Tc ** 2.5) / pc;
    return { a: a0 / Math.sqrt(T), b: (0.08664 * RB * Tc) / pc, u: 1, w: 0, dadT: -0.5 * a0 * T ** -1.5 };
  }
  if (eos === 'pr') {
    const ac = (0.45724 * RB ** 2 * Tc ** 2) / pc;
    const k = 0.37464 + 1.54226 * omega - 0.26992 * omega ** 2;
    const sq = 1 + k * (1 - Math.sqrt(T / Tc));
    return { a: ac * sq * sq, b: (0.0778 * RB * Tc) / pc, u: 2, w: -1, dadT: (-ac * k * sq) / Math.sqrt(T * Tc) };
  }
  return { a: 0, b: 0, u: 0, w: 0, dadT: 0 };
}

export function pressure(eos: EOS, s: Substance, T: number, v: number): number {
  if (eos === 'ideal') return (RB * T) / v;
  const P = params(eos, s, T);
  return (RB * T) / (v - P.b) - P.a / (v * v + P.u * P.b * v + P.w * P.b * P.b);
}
/** (∂p/∂T)_v */
export function dpdT(eos: EOS, s: Substance, T: number, v: number): number {
  if (eos === 'ideal') return RB / v;
  const P = params(eos, s, T);
  return RB / (v - P.b) - P.dadT / (v * v + P.u * P.b * v + P.w * P.b * P.b);
}

/** real roots of x³ + a2 x² + a1 x + a0 */
function cubicRoots(a2: number, a1: number, a0: number): number[] {
  const q = (3 * a1 - a2 * a2) / 9;
  const r = (9 * a2 * a1 - 27 * a0 - 2 * a2 ** 3) / 54;
  const disc = q ** 3 + r * r;
  if (disc > 0) {
    const s1 = Math.cbrt(r + Math.sqrt(disc));
    const s2 = Math.cbrt(r - Math.sqrt(disc));
    return [s1 + s2 - a2 / 3];
  }
  const th = Math.acos(Math.max(-1, Math.min(1, r / Math.sqrt(-(q ** 3)))));
  const m = 2 * Math.sqrt(-q);
  return [m * Math.cos(th / 3) - a2 / 3, m * Math.cos((th + 2 * Math.PI) / 3) - a2 / 3, m * Math.cos((th + 4 * Math.PI) / 3) - a2 / 3].sort((x, y) => x - y);
}

/** Compressibility factors Z (one or three real roots, ascending) at T, p. */
export function zRoots(eos: EOS, s: Substance, T: number, p: number): number[] {
  if (eos === 'ideal') return [1];
  const P = params(eos, s, T);
  const A = (P.a * p) / (RB * T) ** 2;
  const B = (P.b * p) / (RB * T);
  const { u, w } = P;
  // Z³ − (1 + B − uB) Z² + (A + wB² − uB − uB²) Z − (AB + wB² + wB³) = 0
  const a2 = -(1 + B - u * B);
  const a1 = A + w * B * B - u * B - u * B * B;
  const a0 = -(A * B + w * B * B + w * B ** 3);
  return cubicRoots(a2, a1, a0).filter((z) => z > B);
}

/** ln φ (fugacity coefficient) for a root Z. */
export function lnPhi(eos: EOS, s: Substance, T: number, p: number, Z: number): number {
  if (eos === 'ideal') return 0;
  const P = params(eos, s, T);
  const A = (P.a * p) / (RB * T) ** 2;
  const B = (P.b * p) / (RB * T);
  if (eos === 'vdw') return Z - 1 - Math.log(Z - B) - A / Z;
  if (eos === 'rk') return Z - 1 - Math.log(Z - B) - (A / B) * Math.log(1 + B / Z);
  const s2 = Math.SQRT2;
  return Z - 1 - Math.log(Z - B) - (A / (2 * s2 * B)) * Math.log((Z + (1 + s2) * B) / (Z + (1 - s2) * B));
}

/** Stable root (lowest Gibbs energy = lowest fugacity) and whether the state is liquid-like. */
export function stableZ(eos: EOS, s: Substance, T: number, p: number): { Z: number; liquid: boolean; roots: number[] } {
  const roots = zRoots(eos, s, T, p);
  if (roots.length === 1) return { Z: roots[0]!, liquid: roots[0]! < 0.3 && T < s.Tc, roots };
  const zl = roots[0]!;
  const zv = roots.at(-1)!;
  const liquid = lnPhi(eos, s, T, p, zl) < lnPhi(eos, s, T, p, zv);
  return { Z: liquid ? zl : zv, liquid, roots };
}

/** Vapour pressure of the EOS at T < Tc from equal fugacities (Maxwell equal-area rule). */
export function vaporPressure(eos: EOS, s: Substance, T: number): { p: number; vL: number; vV: number } | null {
  if (eos === 'ideal' || T >= s.Tc * 0.9999) return null;
  // start: Lee–Kesler / Wilson estimate
  let p = s.pc * 10 ** ((7 / 3) * (1 + s.omega) * (1 - s.Tc / T));
  for (let it = 0; it < 200; it++) {
    const r = zRoots(eos, s, T, p);
    if (r.length < 3) {
      // only one root: move p towards the two-phase region
      const P = params(eos, s, T);
      const B = (P.b * p) / (RB * T);
      p *= r[0]! > 0.3 || r[0]! - B > 0.5 ? 1.2 : 0.8;
      continue;
    }
    const zl = r[0]!;
    const zv = r[2]!;
    const f = lnPhi(eos, s, T, p, zl) - lnPhi(eos, s, T, p, zv);
    p *= Math.exp(f);
    if (Math.abs(f) < 1e-11) return { p, vL: (zl * RB * T) / p, vV: (zv * RB * T) / p };
  }
  return null;
}

/** Residual (departure) functions at T, p for the root Z: h − h_ig [kJ/kmol], s − s_ig [kJ/(kmol K)]. */
export function departure(eos: EOS, s: Substance, T: number, p: number, Z: number) {
  if (eos === 'ideal') return { h: 0, s: 0 };
  const P = params(eos, s, T);
  const B = (P.b * p) / (RB * T);
  const v = (Z * RB * T) / p;
  // ∫ over v from ∞ of the attractive term
  let I: number;
  if (eos === 'vdw') I = 1 / v;
  else if (eos === 'rk') I = Math.log(1 + P.b / v) / P.b;
  else I = Math.log((v + (1 + Math.SQRT2) * P.b) / (v + (1 - Math.SQRT2) * P.b)) / (2 * Math.SQRT2 * P.b);
  // bar·m³/kmol → kJ/kmol: × 100
  const h = (RB * T * (Z - 1) + (T * P.dadT - P.a) * I) * 100;
  const sDep = (RB * Math.log(Z - B) + P.dadT * I) * 100;
  return { h, s: sDep };
}

/**
 * Maxwell relation (∂s/∂v)_T = (∂p/∂T)_v, checked numerically: s(T, v) − s_ig(T, v) of the EOS is
 * differentiated with respect to v and compared with ∂p/∂T. Returns both sides [bar/K].
 */
export function maxwellCheck(eos: EOS, s: Substance, T: number, v: number) {
  const sTv = (vv: number) => {
    // entropy at (T, v) relative to the ideal gas at the same T and v_ref: R ln v + residual
    if (eos === 'ideal') return RB * Math.log(vv);
    const P = params(eos, s, T);
    let I: number;
    if (eos === 'vdw') I = 1 / vv;
    else if (eos === 'rk') I = Math.log(1 + P.b / vv) / P.b;
    else I = Math.log((vv + (1 + Math.SQRT2) * P.b) / (vv + (1 - Math.SQRT2) * P.b)) / (2 * Math.SQRT2 * P.b);
    return RB * Math.log(vv - P.b) + P.dadT * I;
  };
  const dv = v * 1e-6;
  return { dsdv: (sTv(v + dv) - sTv(v - dv)) / (2 * dv), dpdT: dpdT(eos, s, T, v) };
}

/** Temperature for a given p and v (bisection), used when a state point is dragged in the p,v diagram. */
export function temperaturePV(eos: EOS, s: Substance, p: number, v: number): number {
  let lo = s.Tc * 0.3;
  let hi = s.Tc * 10;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (pressure(eos, s, m, v) > p) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
