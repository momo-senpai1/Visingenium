/**
 * Pipe flow along a chain of segments: Reynolds number, regime, friction factor
 * (Hagen–Poiseuille / Colebrook–White), losses at area changes (Borda–Carnot), static and total
 * pressure along the pipe (extended Bernoulli equation) and a cavitation check.
 *
 * Units: SI internally; inputs d, k in mm, p in bar, Q in L/s, T in °C.
 */

import { psat } from '@/engine/thermo/steam';

export type FluidId = 'water' | 'air' | 'oil';
export interface FluidProps {
  rho: number;
  mu: number;
  /** vapour pressure [Pa] (cavitation); 0 if not relevant */
  pv: number;
}
export function fluidProps(f: FluidId, T: number, pAbsBar = 1.01325): FluidProps {
  if (f === 'water') {
    const t = Math.min(Math.max(T, 0.01), 99);
    const rho = 1000 * (1 - ((t + 288.9414) / (508929.2 * (t + 68.12963))) * (t - 3.9863) ** 2);
    const mu = 2.414e-5 * 10 ** (247.8 / (t + 273.15 - 140));
    return { rho, mu, pv: psat(t + 273.15) * 1000 };
  }
  if (f === 'air') {
    const Tk = T + 273.15;
    return { rho: (pAbsBar * 1e5) / (287.06 * Tk), mu: (1.716e-5 * (Tk / 273.15) ** 1.5 * 383.55) / (Tk + 110.4), pv: 0 };
  }
  // hydraulic / lubricating oil (ISO VG 46-like)
  return { rho: 870 - 0.6 * (T - 20), mu: 0.08 * Math.exp(-0.035 * (T - 20)), pv: 100 };
}

export interface Segment {
  id: string;
  /** length [m] */
  L: number;
  /** inner diameter [mm] */
  d: number;
  /** height change over the segment [m] (+ upward) */
  dz: number;
  /** extra loss coefficients in the segment (bends, valves), based on its velocity */
  zeta: number;
  /** transition into this segment from the previous one */
  inlet: 'sudden' | 'smooth';
}
export interface PipeSpec {
  fluid: FluidId;
  T: number;
  /** volume flow [L/s] */
  Q: number;
  /** static pressure at the inlet [bar abs] */
  pIn: number;
  /** wall roughness [mm] */
  k: number;
  segments: Segment[];
}

export type Regime = 'laminar' | 'transitional' | 'turbulent';
export interface SegResult {
  id: string;
  w: number;
  Re: number;
  regime: Regime;
  lambda: number;
  /** friction loss [Pa] */
  dpF: number;
  /** loss at the inlet transition [Pa] */
  dpIn: number;
  /** extra local losses [Pa] */
  dpZ: number;
}
export interface PipeResult {
  fluid: FluidProps;
  segs: SegResult[];
  /** samples along the pipe: x [m], static p [Pa abs], total p [Pa], geodetic height z [m] */
  profile: { x: number; p: number; pt: number; pd: number; z: number; seg: number }[];
  dpLoss: number;
  pOut: number;
  /** hydraulic power lost [W] */
  powerLoss: number;
  /** minimum static pressure and where */
  pMin: { p: number; x: number };
  cavitation: boolean;
}

/** Colebrook–White, solved by fixed-point iteration (start: Haaland). */
export function colebrook(Re: number, rel: number): number {
  let f = (-1.8 * Math.log10((rel / 3.7) ** 1.11 + 6.9 / Re)) ** -2;
  for (let i = 0; i < 50; i++) {
    const n = (-2 * Math.log10(rel / 3.7 + 2.51 / (Re * Math.sqrt(f)))) ** -2;
    if (Math.abs(n - f) < 1e-12) return n;
    f = n;
  }
  return f;
}
export function frictionFactor(Re: number, rel: number): { lambda: number; regime: Regime } {
  if (Re <= 0) return { lambda: 0, regime: 'laminar' };
  if (Re < 2300) return { lambda: 64 / Re, regime: 'laminar' };
  if (Re < 4000) {
    // transition: interpolate between laminar at 2300 and turbulent at 4000 (indicative only)
    const a = 64 / 2300;
    const b = colebrook(4000, rel);
    const f = (Re - 2300) / 1700;
    return { lambda: a + (b - a) * f, regime: 'transitional' };
  }
  return { lambda: colebrook(Re, rel), regime: 'turbulent' };
}

/** Power-law exponent n of the turbulent velocity profile (Schlichting's table, interpolated in log Re). */
export function powerLawN(Re: number): number {
  const tab: [number, number][] = [
    [4e3, 6],
    [2.3e4, 6.6],
    [1.1e5, 7],
    [1.1e6, 8.8],
    [3.2e6, 10],
  ];
  if (Re <= tab[0]![0]) return 6;
  for (let i = 1; i < tab.length; i++) {
    const [r1, n1] = tab[i - 1]!;
    const [r2, n2] = tab[i]!;
    if (Re <= r2) return n1 + ((n2 - n1) * Math.log(Re / r1)) / Math.log(r2 / r1);
  }
  return 10;
}

/** u(r)/w_mean for a profile: laminar parabola or turbulent power law. */
export function velocityProfile(regime: Regime, Re: number, rR: number): number {
  const r = Math.min(1, Math.abs(rR));
  if (regime === 'laminar') return 2 * (1 - r * r);
  const n = powerLawN(Math.max(Re, 4000));
  return (((n + 1) * (2 * n + 1)) / (2 * n * n)) * (1 - r) ** (1 / n);
}

const G = 9.81;

export function solvePipe(s: PipeSpec): PipeResult {
  const fl = fluidProps(s.fluid, s.T, s.pIn);
  const Q = s.Q / 1000;
  const segs: SegResult[] = [];
  const profile: PipeResult['profile'] = [];
  let p = s.pIn * 1e5;
  let x = 0;
  let z = 0;
  let wPrev: number | null = null;
  let APrev: number | null = null;
  let dpLoss = 0;
  s.segments.forEach((g, i) => {
    const d = Math.max(g.d, 0.1) / 1000;
    const A = (Math.PI * d * d) / 4;
    const w = Q / A;
    const Re = (fl.rho * w * d) / fl.mu;
    const { lambda, regime } = frictionFactor(Re, s.k / Math.max(g.d, 0.1));
    // transition loss at the inlet of this segment
    let dpIn = 0;
    if (wPrev !== null && APrev !== null) {
      if (A > APrev) {
        // expansion: Borda–Carnot ζ = (1 − A1/A2)², based on the upstream velocity
        const zeta = (1 - APrev / A) ** 2 * (g.inlet === 'smooth' ? 0.15 : 1);
        dpIn = zeta * 0.5 * fl.rho * wPrev * wPrev;
      } else if (A < APrev) {
        // contraction: ζ ≈ 0.5 (1 − A2/A1)^0.75 (sudden), ≈ 0.04 (rounded nozzle), on the downstream velocity
        const zeta = g.inlet === 'smooth' ? 0.04 : 0.5 * (1 - A / APrev) ** 0.75;
        dpIn = zeta * 0.5 * fl.rho * w * w;
      }
      // Bernoulli across the transition (velocity change) plus its loss
      p += 0.5 * fl.rho * (wPrev * wPrev - w * w) - dpIn;
      profile.push({ x, p, pt: p + 0.5 * fl.rho * w * w + fl.rho * G * z, pd: 0.5 * fl.rho * w * w, z, seg: i });
    } else profile.push({ x, p, pt: p + 0.5 * fl.rho * w * w, pd: 0.5 * fl.rho * w * w, z, seg: i });
    const dpF = lambda * (g.L / d) * 0.5 * fl.rho * w * w;
    const dpZ = g.zeta * 0.5 * fl.rho * w * w;
    const n = 20;
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      const pp = p - f * (dpF + dpZ) - fl.rho * G * g.dz * f;
      profile.push({ x: x + g.L * f, p: pp, pt: pp + 0.5 * fl.rho * w * w + fl.rho * G * (z + g.dz * f), pd: 0.5 * fl.rho * w * w, z: z + g.dz * f, seg: i });
    }
    p -= dpF + dpZ + fl.rho * G * g.dz;
    x += g.L;
    z += g.dz;
    dpLoss += dpF + dpZ + dpIn;
    segs.push({ id: g.id, w, Re, regime, lambda, dpF, dpIn, dpZ });
    wPrev = w;
    APrev = A;
  });
  const pMin = profile.reduce((m, q) => (q.p < m.p ? { p: q.p, x: q.x } : m), { p: Infinity, x: 0 });
  return { fluid: fl, segs, profile, dpLoss, pOut: p, powerLoss: Q * dpLoss, pMin, cavitation: fl.pv > 0 && pMin.p < fl.pv };
}
