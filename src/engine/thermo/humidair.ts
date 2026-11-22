/**
 * Humid air (Mollier h,x): ideal mixture of dry air and water vapour, per kg of dry air.
 * t [°C], p [kPa], x [kg water / kg dry air], h [kJ/kg dry air].
 */

import { psat as psatWater } from './steam';

export const CP_A = 1.006;
export const CP_V = 1.86;
export const R0 = 2501;
export const CW = 4.19;
const EPS = 0.622;

/** saturation pressure [kPa]: over water (IAPWS) for t ≥ 0.01 °C, over ice (Magnus) below */
export function ps(t: number): number {
  return t >= 0.01 ? psatWater(t + 273.15) : 0.6112 * Math.exp((22.46 * t) / (272.62 + t));
}
export const xSat = (t: number, p: number) => (EPS * ps(t)) / Math.max(p - ps(t), 1e-9);
export const xOf = (t: number, phi: number, p: number) => (EPS * phi * ps(t)) / Math.max(p - phi * ps(t), 1e-9);
export const phiOf = (t: number, x: number, p: number) => (x * p) / ((EPS + x) * ps(t));

/** specific enthalpy; above saturation the excess water is fog (liquid) */
export function h(t: number, x: number, p: number): number {
  const xs = xSat(t, p);
  if (x <= xs) return CP_A * t + x * (R0 + CP_V * t);
  return CP_A * t + xs * (R0 + CP_V * t) + (x - xs) * CW * t;
}

/** temperature from h and x (unsaturated or fog), by bisection */
export function tOf(hh: number, x: number, p: number): number {
  let lo = -40;
  let hi = 200;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (h(m, x, p) > hh) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

export function dewPoint(x: number, p: number): number {
  const pv = (x * p) / (EPS + x);
  let lo = -60;
  let hi = 150;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (ps(m) > pv) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/** adiabatic saturation (wet-bulb) temperature */
export function wetBulb(t: number, x: number, p: number): number {
  const h0 = h(t, x, p);
  let lo = -40;
  let hi = t;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    const xs = xSat(m, p);
    // energy balance: h(m, xs) = h0 + (xs − x) · c_w · m
    if (h(m, xs, p) - (h0 + (xs - x) * CW * m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

export interface AirState {
  t: number;
  x: number;
  h: number;
  phi: number;
  pv: number;
  tDew: number;
  tWet: number;
  rho: number;
  fog: boolean;
}
export function state(t: number, x: number, p: number): AirState {
  const xs = xSat(t, p);
  const pv = (Math.min(x, xs) * p) / (EPS + Math.min(x, xs));
  const T = t + 273.15;
  return {
    t,
    x,
    h: h(t, x, p),
    phi: Math.min(1, phiOf(t, x, p)),
    pv,
    tDew: dewPoint(Math.min(x, xs), p),
    tWet: wetBulb(t, Math.min(x, xs), p),
    rho: ((p * 1000) / (287.06 * T)) * (1 + x) / (1 + 1.6078 * x),
    fog: x > xs + 1e-12,
  };
}

/**
 * Heat or cool to t2 at constant x; below the dew point the air follows the saturation line
 * and the excess water condenses (cooling coil with surface below the dew point).
 */
export function heatCool(s1: AirState, t2: number, p: number) {
  const xs2 = xSat(t2, p);
  const x2 = Math.min(s1.x, xs2);
  const s2 = state(t2, x2, p);
  return { s2, q: s2.h - s1.h, condensate: Math.max(0, s1.x - x2) };
}

/** Adiabatic mixing of two air streams (mass of dry air m1, m2). */
export function mix(a: AirState, b: AirState, m1: number, m2: number, p: number) {
  const w = m1 / Math.max(m1 + m2, 1e-12);
  const x = w * a.x + (1 - w) * b.x;
  const hh = w * a.h + (1 - w) * b.h;
  return state(tOf(hh, x, p), x, p);
}

/** Adiabatic humidification with liquid water at t_w up to the relative humidity phi2 (h + Δx·c_w·t_w). */
export function humidify(s1: AirState, phi2: number, tw: number, p: number) {
  const target = Math.min(1, Math.max(s1.phi, phi2));
  let lo = s1.x;
  let hi = xSat(-40, p) + 0.2;
  for (let i = 0; i < 80; i++) {
    const x = (lo + hi) / 2;
    const t = tOf(s1.h + (x - s1.x) * CW * tw, x, p);
    if (phiOf(t, x, p) > target) hi = x;
    else lo = x;
  }
  const x = (lo + hi) / 2;
  const s2 = state(tOf(s1.h + (x - s1.x) * CW * tw, x, p), x, p);
  return { s2, water: x - s1.x };
}

/** Mollier skewed coordinate: y = (h − r₀ x)/c_pA ≈ temperature scale (isotherms rise slightly). */
export const mollierY = (t: number, x: number, p: number) => (h(t, x, p) - R0 * x) / CP_A;
export const tFromMollier = (y: number, x: number) => (y * CP_A) / (CP_A + CP_V * x);
