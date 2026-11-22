/**
 * Water and steam properties for cycle calculations.
 *
 * - Saturation line: IAPWS 1992 (Wagner & Pruß) vapour-pressure equation and the auxiliary
 *   equations for ρ', ρ'', h', h'', s', s'' (IAPWS SR1-86, revised 1992). Accurate to ≈0.1 %.
 * - Superheated steam: IAPWS-IF97 region 2 with the complete ideal-gas part and the first
 *   (virial-type) residual terms; accurate to ≈0.5 % in h and s up to about 100 bar.
 * - Compressed liquid: saturated liquid at the same temperature, pump work v·Δp (textbook model).
 *
 * Units: T [K], p [kPa], h [kJ/kg], s [kJ/(kg·K)], v [m³/kg].
 */

export const TC = 647.096;
export const PC = 22064; // kPa
const RHOC = 322;
export const R_W = 0.461526;
export const T_TRIPLE = 273.16;

const A = [-7.85951783, 1.84408259, -11.7866497, 22.6807411, -15.9618719, 1.80122502];

/** Saturation pressure [kPa] at T [K]. */
export function psat(T: number): number {
  const tau = 1 - T / TC;
  const s = A[0]! * tau + A[1]! * tau ** 1.5 + A[2]! * tau ** 3 + A[3]! * tau ** 3.5 + A[4]! * tau ** 4 + A[5]! * tau ** 7.5;
  return PC * Math.exp((TC / T) * s);
}
/** dp_s/dT [kPa/K] */
function dpsatdT(T: number): number {
  const tau = 1 - T / TC;
  const s = A[0]! * tau + A[1]! * tau ** 1.5 + A[2]! * tau ** 3 + A[3]! * tau ** 3.5 + A[4]! * tau ** 4 + A[5]! * tau ** 7.5;
  const ds = -(A[0]! + 1.5 * A[1]! * tau ** 0.5 + 3 * A[2]! * tau ** 2 + 3.5 * A[3]! * tau ** 2.5 + 4 * A[4]! * tau ** 3 + 7.5 * A[5]! * tau ** 6.5) / TC;
  const p = psat(T);
  return p * (-(TC / T ** 2) * s + (TC / T) * ds);
}

/** Saturation temperature [K] at p [kPa] (Newton on psat). */
export function tsat(p: number): number {
  const pp = Math.min(Math.max(p, 0.6117), PC);
  // start: Antoine-like guess
  let T = 373.15 * (1 + 0.05 * Math.log(pp / 101.325)) ** 1.4;
  T = Math.min(Math.max(T, T_TRIPLE), TC);
  for (let i = 0; i < 60; i++) {
    const f = Math.log(psat(T)) - Math.log(pp);
    const d = dpsatdT(T) / psat(T);
    const dT = f / d;
    T = Math.min(Math.max(T - dT, T_TRIPLE), TC - 1e-9);
    if (Math.abs(dT) < 1e-9) break;
  }
  return T;
}

const B = [1.99274064, 1.09965342, -0.510839303, -1.75493479, -45.5170352, -6.7469445e5];
const BE = [1 / 3, 2 / 3, 5 / 3, 16 / 3, 43 / 3, 110 / 3];
const C = [-2.0315024, -2.6830294, -5.38626492, -17.2991605, -44.7586581, -63.9201063];
const CE = [2 / 6, 4 / 6, 8 / 6, 18 / 6, 37 / 6, 71 / 6];
const D = { a: -1135.905627715, d1: -5.65134998e-8, d2: 2690.66631, d3: 127.287297, d4: -135.003439, d5: 0.981825814 };

export interface SatProps {
  T: number;
  p: number;
  vL: number;
  vV: number;
  hL: number;
  hV: number;
  sL: number;
  sV: number;
}

/** Saturated liquid and vapour at T [K]. */
export function satT(T0: number): SatProps {
  const T = Math.min(Math.max(T0, T_TRIPLE), TC);
  const tau = 1 - T / TC;
  const th = T / TC;
  const rhoL = RHOC * (1 + B.reduce((acc, b, i) => acc + b * tau ** BE[i]!, 0));
  const rhoV = RHOC * Math.exp(C.reduce((acc, c, i) => acc + c * tau ** CE[i]!, 0));
  const alpha = (1000 * (D.a + D.d1 * th ** -19 + D.d2 * th + D.d3 * th ** 4.5 + D.d4 * th ** 5 + D.d5 * th ** 54.5)) / 1000; // kJ/kg (α0 = 1000 J/kg)
  const phi = (1000 / TC) * (2319.5246 + (19 / 20) * D.d1 * th ** -20 + D.d2 * Math.log(th) + (9 / 7) * D.d3 * th ** 3.5 + (5 / 4) * D.d4 * th ** 4 + (109 / 107) * D.d5 * th ** 53.5) / 1000; // kJ/(kg K)
  const p = psat(T);
  const dp = dpsatdT(T); // kPa/K
  return {
    T,
    p,
    vL: 1 / rhoL,
    vV: 1 / rhoV,
    hL: alpha + (T / rhoL) * dp,
    hV: alpha + (T / rhoV) * dp,
    sL: phi + dp / rhoL,
    sV: phi + dp / rhoV,
  };
}
export const satP = (p: number) => satT(tsat(p));

// ---------------------------------------------------------------- IF97 region 2 (superheated)

const J0 = [0, 1, -5, -4, -3, -2, -1, 2, 3];
const N0 = [-9.6927686500217, 10.086655968018, -0.005608791128302, 0.071452738081455, -0.40710498223928, 1.4240819171444, -4.383951131945, -0.28408632460772, 0.021268463753307];
const RES: [number, number, number][] = [
  [1, 0, -0.0017731742473213],
  [1, 1, -0.017834862292358],
  [1, 2, -0.045996013696365],
  [1, 3, -0.057581259083432],
  [1, 6, -0.05032527872793],
  [2, 1, -3.3032641670203e-5],
  [2, 2, -1.8948987516315e-4],
  [2, 4, -3.9392777243355e-3],
  [2, 7, -4.3797295650573e-2],
  [2, 36, -2.6674547914087e-5],
];

/** Superheated steam at T [K], p [kPa]. */
export function steamPT(T: number, p: number): { h: number; s: number; v: number } {
  const pi = p / 1000;
  const tau = 540 / T;
  let g0 = Math.log(pi);
  let g0t = 0;
  for (let i = 0; i < 9; i++) {
    g0 += N0[i]! * tau ** J0[i]!;
    g0t += N0[i]! * J0[i]! * tau ** (J0[i]! - 1);
  }
  let gr = 0;
  let grp = 0;
  let grt = 0;
  for (const [I, J, n] of RES) {
    gr += n * pi ** I * (tau - 0.5) ** J;
    grp += n * I * pi ** (I - 1) * (tau - 0.5) ** J;
    grt += n * pi ** I * J * (tau - 0.5) ** (J - 1);
  }
  const h = R_W * T * tau * (g0t + grt);
  const s = R_W * (tau * (g0t + grt) - (g0 + gr));
  const v = ((R_W * T) / p) * pi * (1 / pi + grp);
  return { h, s, v };
}

// ---------------------------------------------------------------- general state

export type Phase = 'liquid' | 'wet' | 'vapour';
export interface WaterState {
  T: number;
  p: number;
  h: number;
  s: number;
  v: number;
  /** vapour quality (wet region only), else null */
  x: number | null;
  phase: Phase;
}

/** State from p and T (liquid: saturated liquid at T plus v·Δp; vapour: region 2). */
export function stateTP(T: number, p: number): WaterState {
  const Ts = tsat(p);
  if (T > Ts + 1e-9 || p >= PC) {
    const r = steamPT(T, p);
    return { T, p, ...r, x: null, phase: 'vapour' };
  }
  const L = satT(T);
  return { T, p, h: L.hL + L.vL * (p - L.p), s: L.sL, v: L.vL, x: null, phase: 'liquid' };
}

/** Wet steam at p with quality x. */
export function statePX(p: number, x: number): WaterState {
  const S = satP(p);
  const q = Math.min(1, Math.max(0, x));
  return { T: S.T, p, h: S.hL + q * (S.hV - S.hL), s: S.sL + q * (S.sV - S.sL), v: S.vL + q * (S.vV - S.vL), x: q, phase: 'wet' };
}

/** State from p and s (isentropic expansion end point). */
export function statePS(p: number, s: number): WaterState {
  const S = satP(p);
  if (s <= S.sV) {
    if (s >= S.sL) return statePX(p, (s - S.sL) / (S.sV - S.sL));
    // compressed / subcooled liquid: s ≈ s'(T)
    let lo = T_TRIPLE;
    let hi = S.T;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (satT(m).sL > s) hi = m;
      else lo = m;
    }
    return stateTP((lo + hi) / 2, p);
  }
  let lo = S.T;
  let hi = 2000;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (steamPT(m, p).s > s) hi = m;
    else lo = m;
  }
  return stateTP((lo + hi) / 2 + 1e-9, p);
}

/** State from p and h (throttle, turbine with efficiency). */
export function statePH(p: number, h: number): WaterState {
  const S = satP(p);
  if (h <= S.hV) {
    if (h >= S.hL) return statePX(p, (h - S.hL) / (S.hV - S.hL));
    let lo = T_TRIPLE;
    let hi = S.T;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (stateTP(m, p).h > h) hi = m;
      else lo = m;
    }
    return stateTP((lo + hi) / 2, p);
  }
  let lo = S.T;
  let hi = 2000;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (steamPT(m, p).h > h) hi = m;
    else lo = m;
  }
  return stateTP((lo + hi) / 2 + 1e-9, p);
}

/** Superheated (or saturated) state from T and s: the pressure whose isobar passes through (T, s). */
export function pressureTS(T: number, s: number): number {
  let lo = 0.6117;
  let hi = Math.min(PC, T < TC ? psat(T) : PC);
  // s decreases with p along an isotherm
  for (let i = 0; i < 100; i++) {
    const m = Math.sqrt(lo * hi);
    if (steamPT(T, m).s > s) lo = m;
    else hi = m;
  }
  return Math.sqrt(lo * hi);
}
