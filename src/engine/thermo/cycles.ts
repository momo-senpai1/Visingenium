/**
 * Thermodynamic cycles: Carnot, Joule (Brayton), Otto, Diesel with air as ideal gas,
 * and Clausius–Rankine with water/steam. Every result has the state points, the process
 * paths for T,s and p,v diagrams, energy and exergy balances.
 *
 * Units: T [K], p [kPa], v [m³/kg], s [kJ/(kg K)], h, q, w, e [kJ/kg].
 */

import { PC, satP, satT, stateTP, statePH, statePS, statePX, tsat, TC, T_TRIPLE, type WaterState } from './steam';

export const AIR = { cp: 1.005, R: 0.287, get cv() { return this.cp - this.R; }, get k() { return this.cp / (this.cp - this.R); } };
const T_REF = 273.15;
const P_REF = 100;

export interface Pt {
  id: string;
  T: number;
  p: number;
  v: number;
  s: number;
  h: number;
  /** vapour quality (Rankine) */
  x?: number | null;
}
export interface Path {
  T: number[];
  s: number[];
  p: number[];
  v: number[];
  /** heat added (+) or rejected (−) on this path, for colouring */
  kind: 'heat-in' | 'heat-out' | 'work' | 'other';
}
export interface ExergyItem {
  name: string;
  loss: number;
}
export interface CycleResult {
  points: Pt[];
  paths: Path[];
  qIn: number;
  qOut: number;
  wNet: number;
  eta: number;
  /** Carnot efficiency between the extreme cycle temperatures */
  etaCarnot: number;
  /** exergy supplied with the heat (from a source at T_source) */
  exIn: number;
  losses: ExergyItem[];
  etaEx: number;
  extra: { label: string; value: number; unit: string }[];
  warnings: string[];
}

// ---------------------------------------------------------------- ideal gas helpers

export const gasS = (T: number, p: number) => AIR.cp * Math.log(T / T_REF) - AIR.R * Math.log(p / P_REF);
const gasPt = (id: string, T: number, p: number): Pt => ({ id, T, p, v: (AIR.R * T) / p, s: gasS(T, p), h: AIR.cp * (T - T_REF) });
/** pressure from T and s */
export const gasP = (T: number, s: number) => P_REF * Math.exp((AIR.cp * Math.log(T / T_REF) - s) / AIR.R);

const N = 40;
const lin = (a: number, b: number, i: number) => a + ((b - a) * i) / N;
/** ideal-gas path between two points with a given process type (polytropic sampling) */
function gasPath(a: Pt, b: Pt, type: 'isobar' | 'isochore' | 'isotherm' | 'isentrope' | 'line', kind: Path['kind']): Path {
  const P: Path = { T: [], s: [], p: [], v: [], kind };
  for (let i = 0; i <= N; i++) {
    let T: number;
    let p: number;
    if (type === 'isobar') {
      p = a.p;
      T = lin(a.T, b.T, i);
    } else if (type === 'isochore') {
      T = lin(a.T, b.T, i);
      p = (AIR.R * T) / a.v;
    } else if (type === 'isotherm') {
      T = a.T;
      const v = a.v * (b.v / a.v) ** (i / N);
      p = (AIR.R * T) / v;
    } else if (type === 'isentrope') {
      const v = a.v * (b.v / a.v) ** (i / N);
      p = a.p * (a.v / v) ** AIR.k;
      T = (p * v) / AIR.R;
    } else {
      // irreversible adiabatic: straight line in T,s (drawn dashed)
      T = lin(a.T, b.T, i);
      const s = lin(a.s, b.s, i);
      p = gasP(T, s);
    }
    P.T.push(T);
    P.p.push(p);
    P.v.push((AIR.R * T) / p);
    P.s.push(gasS(T, p));
  }
  return P;
}

/** Exergy bookkeeping for an adiabatic machine and for heat exchange with reservoirs. */
const exAdiabatic = (name: string, a: Pt, b: Pt, T0: number): ExergyItem => ({ name, loss: Math.max(0, T0 * (b.s - a.s)) });
/** heat q (> 0) taken from a reservoir at Tsrc while the fluid entropy rises by ds */
const exHeatIn = (name: string, q: number, ds: number, Tsrc: number, T0: number): ExergyItem => ({ name, loss: Math.max(0, T0 * (ds - q / Tsrc)) });
/** heat q (> 0) rejected to the environment at T0 while the fluid entropy falls by ds (> 0) */
const exHeatOut = (name: string, q: number, ds: number, T0: number): ExergyItem => ({ name, loss: Math.max(0, q - T0 * ds) });

function finish(points: Pt[], paths: Path[], qIn: number, qOut: number, Tsrc: number, T0: number, losses: ExergyItem[], extra: CycleResult['extra'], warnings: string[]): CycleResult {
  const wNet = qIn - qOut;
  const Tmax = Math.max(...points.map((p) => p.T));
  const Tmin = Math.min(...points.map((p) => p.T));
  const exIn = qIn * (1 - T0 / Tsrc);
  return {
    points,
    paths,
    qIn,
    qOut,
    wNet,
    eta: wNet / qIn,
    etaCarnot: 1 - Tmin / Tmax,
    exIn,
    losses,
    etaEx: exIn > 0 ? wNet / exIn : NaN,
    extra,
    warnings,
  };
}

// ---------------------------------------------------------------- Carnot (ideal gas)

export interface CarnotSpec {
  TL: number;
  TH: number;
  /** pressure at point 1 (start of the isentropic compression) */
  p1: number;
  /** entropy increase during heat addition [kJ/(kg K)] */
  ds: number;
  T0: number;
}
export function carnot(c: CarnotSpec): CycleResult {
  const TL = Math.max(1, Math.min(c.TL, c.TH - 1));
  const TH = c.TH;
  const ds = Math.max(1e-4, c.ds);
  const p1 = c.p1;
  const P1 = gasPt('1', TL, p1);
  const P2 = gasPt('2', TH, gasP(TH, P1.s));
  const P3 = gasPt('3', TH, gasP(TH, P1.s + ds));
  const P4 = gasPt('4', TL, gasP(TL, P1.s + ds));
  const qIn = TH * ds;
  const qOut = TL * ds;
  const paths = [gasPath(P1, P2, 'isentrope', 'work'), gasPath(P2, P3, 'isotherm', 'heat-in'), gasPath(P3, P4, 'isentrope', 'work'), gasPath(P4, P1, 'isotherm', 'heat-out')];
  const losses = [exHeatIn('Heat addition', qIn, ds, TH, c.T0), exHeatOut('Heat rejection', qOut, ds, c.T0)];
  return finish([P1, P2, P3, P4], paths, qIn, qOut, TH, c.T0, losses, [{ label: 'Pressure ratio p₂/p₁', value: P2.p / P1.p, unit: '' }], TL < c.T0 ? ['T_L is below the ambient temperature T₀.'] : []);
}

// ---------------------------------------------------------------- Joule / Brayton

export interface JouleSpec {
  T1: number;
  p1: number;
  /** pressure ratio p2/p1 */
  pr: number;
  /** turbine inlet temperature */
  T3: number;
  etaC: number;
  etaT: number;
  T0: number;
  /** temperature of the heat source (combustion) */
  Tsrc: number;
}
export function joule(c: JouleSpec): CycleResult {
  const k = AIR.k;
  const P1 = gasPt('1', c.T1, c.p1);
  const p2 = c.p1 * Math.max(1.0001, c.pr);
  const T2s = c.T1 * (p2 / c.p1) ** ((k - 1) / k);
  const T2 = c.T1 + (T2s - c.T1) / Math.min(1, Math.max(0.05, c.etaC));
  const P2 = gasPt('2', T2, p2);
  const T3 = Math.max(c.T3, T2 + 1);
  const P3 = gasPt('3', T3, p2);
  const T4s = T3 * (c.p1 / p2) ** ((k - 1) / k);
  const T4 = T3 - Math.min(1, Math.max(0.05, c.etaT)) * (T3 - T4s);
  const P4 = gasPt('4', T4, c.p1);
  const qIn = AIR.cp * (T3 - T2);
  const qOut = AIR.cp * (T4 - c.T1);
  const ideal = c.etaC >= 1 && c.etaT >= 1;
  const paths = [
    gasPath(P1, P2, ideal ? 'isentrope' : 'line', 'work'),
    gasPath(P2, P3, 'isobar', 'heat-in'),
    gasPath(P3, P4, ideal ? 'isentrope' : 'line', 'work'),
    gasPath(P4, P1, 'isobar', 'heat-out'),
  ];
  const Tsrc = Math.max(c.Tsrc, T3);
  const losses = [
    exAdiabatic('Compressor', P1, P2, c.T0),
    exHeatIn('Combustion / heat addition', qIn, P3.s - P2.s, Tsrc, c.T0),
    exAdiabatic('Turbine', P3, P4, c.T0),
    exHeatOut('Exhaust / heat rejection', qOut, P4.s - P1.s, c.T0),
  ];
  const wC = AIR.cp * (T2 - c.T1);
  const wT = AIR.cp * (T3 - T4);
  const warnings = wT <= wC ? ['The turbine delivers less work than the compressor needs: no net work.'] : [];
  return finish([P1, P2, P3, P4], paths, qIn, qOut, Tsrc, c.T0, losses, [
    { label: 'Compressor work', value: wC, unit: 'kJ/kg' },
    { label: 'Turbine work', value: wT, unit: 'kJ/kg' },
    { label: 'Back-work ratio w_C/w_T', value: wC / wT, unit: '' },
    { label: 'Ideal efficiency 1 − Π^(−(κ−1)/κ)', value: 1 - (1 / c.pr) ** ((k - 1) / k), unit: '' },
  ], warnings);
}

// ---------------------------------------------------------------- Otto and Diesel

export interface PistonSpec {
  T1: number;
  p1: number;
  /** compression ratio ε = v1/v2 */
  eps: number;
  /** maximum temperature T3 */
  T3: number;
  T0: number;
  Tsrc: number;
}
function piston(c: PistonSpec, diesel: boolean): CycleResult {
  const k = AIR.k;
  const eps = Math.max(1.01, c.eps);
  const P1 = gasPt('1', c.T1, c.p1);
  const v2 = P1.v / eps;
  const T2 = c.T1 * eps ** (k - 1);
  const P2 = gasPt('2', T2, (AIR.R * T2) / v2);
  const T3 = Math.max(c.T3, T2 + 1);
  const P3 = diesel ? gasPt('3', T3, P2.p) : gasPt('3', T3, (AIR.R * T3) / v2);
  const T4 = T3 * (P3.v / P1.v) ** (k - 1);
  const P4 = gasPt('4', T4, (AIR.R * T4) / P1.v);
  const qIn = diesel ? AIR.cp * (T3 - T2) : AIR.cv * (T3 - T2);
  const qOut = AIR.cv * (T4 - c.T1);
  const paths = [gasPath(P1, P2, 'isentrope', 'work'), gasPath(P2, P3, diesel ? 'isobar' : 'isochore', 'heat-in'), gasPath(P3, P4, 'isentrope', 'work'), gasPath(P4, P1, 'isochore', 'heat-out')];
  const Tsrc = Math.max(c.Tsrc, T3);
  const losses = [exHeatIn('Combustion / heat addition', qIn, P3.s - P2.s, Tsrc, c.T0), exHeatOut('Exhaust / heat rejection', qOut, P4.s - P1.s, c.T0)];
  const phi = P3.v / P2.v;
  const extra: CycleResult['extra'] = diesel
    ? [
        { label: 'Cut-off ratio φ = v₃/v₂', value: phi, unit: '' },
        { label: 'Ideal efficiency 1 − (φ^κ − 1)/(κ ε^(κ−1) (φ − 1))', value: 1 - (phi ** k - 1) / (k * eps ** (k - 1) * (phi - 1)), unit: '' },
      ]
    : [{ label: 'Ideal efficiency 1 − 1/ε^(κ−1)', value: 1 - 1 / eps ** (k - 1), unit: '' }];
  extra.push({ label: 'Maximum pressure', value: Math.max(P2.p, P3.p) / 100, unit: 'bar' }, { label: 'Mean effective pressure', value: (qIn - qOut) / (P1.v - v2) / 100, unit: 'bar' });
  const warnings = diesel && phi > eps ? ['The cut-off ratio exceeds the compression ratio: T₃ is too high for this ε.'] : [];
  return finish([P1, P2, P3, P4], paths, qIn, qOut, Tsrc, c.T0, losses, extra, warnings);
}
export const otto = (c: PistonSpec) => piston(c, false);
export const diesel = (c: PistonSpec) => piston(c, true);

// ---------------------------------------------------------------- Clausius–Rankine

export interface RankineSpec {
  /** condenser pressure [kPa] */
  pc: number;
  /** boiler pressure [kPa] */
  pb: number;
  /** live steam temperature [K] (≤ T_s: saturated steam) */
  T3: number;
  etaT: number;
  etaP: number;
  T0: number;
  /** temperature of the heat source (flue gas) */
  Tsrc: number;
}
const toPt = (id: string, w: WaterState): Pt => ({ id, T: w.T, p: w.p, v: w.v, s: w.s, h: w.h, x: w.x });

/** water path at constant pressure from state a to b (liquid → wet → vapour), sampled for the diagrams */
function waterIsobar(p: number, a: Pt, b: Pt, kind: Path['kind']): Path {
  const P: Path = { T: [], s: [], p: [], v: [], kind };
  for (let i = 0; i <= 3 * N; i++) {
    const h = a.h + ((b.h - a.h) * i) / (3 * N);
    const w = statePH(p, h);
    P.T.push(w.T);
    P.s.push(w.s);
    P.p.push(p);
    P.v.push(w.v);
  }
  return P;
}
function waterExpansion(a: Pt, b: Pt): Path {
  const P: Path = { T: [], s: [], p: [], v: [], kind: 'work' };
  for (let i = 0; i <= N; i++) {
    const p = a.p * (b.p / a.p) ** (i / N);
    const h = a.h + ((b.h - a.h) * i) / N;
    // the real expansion line: straight in h,s; sample with p log-spaced
    const w = statePH(p, h);
    P.T.push(w.T);
    P.s.push(w.s);
    P.p.push(p);
    P.v.push(w.v);
  }
  return P;
}

export function rankine(c: RankineSpec): CycleResult {
  const pc = Math.min(Math.max(c.pc, 1), 1000);
  const pb = Math.min(Math.max(c.pb, pc * 1.5), 12000);
  const warnings: string[] = [];
  if (c.pb > 12000) warnings.push('Boiler pressure limited to 120 bar (accuracy of the steam model).');
  const S1 = satP(pc);
  const w1 = statePX(pc, 0);
  const P1 = toPt('1', w1);
  // pump
  const wp = (S1.vL * (pb - pc)) / Math.min(1, Math.max(0.05, c.etaP));
  const w2 = statePH(pb, w1.h + wp);
  const P2 = toPt('2', w2);
  // live steam
  const Ts = tsat(pb);
  const w3 = c.T3 > Ts + 0.01 ? stateTP(c.T3, pb) : statePX(pb, 1);
  const P3 = toPt('3', w3);
  // turbine
  const w4s = statePS(pc, w3.s);
  const h4 = w3.h - Math.min(1, Math.max(0.05, c.etaT)) * (w3.h - w4s.h);
  const w4 = statePH(pc, h4);
  const P4 = toPt('4', w4);
  if (w4.x !== null && w4.x < 0.88) warnings.push('Steam quality at the turbine exit below 0.88: risk of droplet erosion (raise T₃ or lower p_boiler).');
  const qIn = w3.h - w2.h;
  const qOut = w4.h - w1.h;
  const paths = [
    { T: [P1.T, P2.T], s: [P1.s, P2.s], p: [P1.p, P2.p], v: [P1.v, P2.v], kind: 'work' as const },
    waterIsobar(pb, P2, P3, 'heat-in'),
    waterExpansion(P3, P4),
    waterIsobar(pc, P4, P1, 'heat-out'),
  ];
  const Tsrc = Math.max(c.Tsrc, w3.T);
  const losses = [
    exAdiabatic('Pump', P1, P2, c.T0),
    exHeatIn('Boiler (heat transfer from the flue gas)', qIn, P3.s - P2.s, Tsrc, c.T0),
    exAdiabatic('Turbine', P3, P4, c.T0),
    exHeatOut('Condenser', qOut, P4.s - P1.s, c.T0),
  ];
  const wT = w3.h - w4.h;
  return finish([P1, P2, P3, P4], paths, qIn, qOut, Tsrc, c.T0, losses, [
    { label: 'Turbine work', value: wT, unit: 'kJ/kg' },
    { label: 'Pump work', value: wp, unit: 'kJ/kg' },
    { label: 'Steam quality at turbine exit x₄', value: w4.x ?? 1, unit: '' },
    { label: 'Saturation temperature boiler', value: Ts - 273.15, unit: '°C' },
    { label: 'Saturation temperature condenser', value: S1.T - 273.15, unit: '°C' },
    { label: 'Specific steam consumption', value: 3600 / (wT - wp), unit: 'kg/kWh' },
  ], warnings);
}

/** Two-phase dome of water for the diagrams. */
export function waterDome(n = 120) {
  const out: { T: number; sL: number; sV: number; p: number; vL: number; vV: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const T = T_TRIPLE + (TC - 0.01 - T_TRIPLE) * (1 - (1 - i / n) ** 1.5);
    const s = satT(T);
    out.push({ T, sL: s.sL, sV: s.sV, p: s.p, vL: s.vL, vV: s.vV });
  }
  return out;
}

/** An isobar of water across liquid, wet and superheated region, for background lines. */
export function waterIsobarLine(p: number, Tmax: number, n = 60) {
  const Ts = p < PC ? tsat(p) : NaN;
  const pts: { T: number; s: number; v: number }[] = [];
  if (Number.isFinite(Ts)) {
    for (let i = 0; i <= n / 3; i++) {
      const T = T_TRIPLE + 0.5 + ((Ts - T_TRIPLE - 0.5) * i) / (n / 3);
      const w = stateTP(T, p);
      pts.push({ T, s: w.s, v: w.v });
    }
    const S = satT(Ts);
    pts.push({ T: Ts, s: S.sV, v: S.vV });
  }
  const T0 = Number.isFinite(Ts) ? Ts + 0.05 : 650;
  for (let i = 1; i <= n; i++) {
    const T = T0 + ((Tmax - T0) * i) / n;
    const w = stateTP(T, p);
    pts.push({ T, s: w.s, v: w.v });
  }
  return pts;
}
