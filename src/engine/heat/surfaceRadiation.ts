/** Radiation balance at one surface of a wall (gray, diffuse: α = ε by Kirchhoff, α + ρ + τ = 1). */

import { SIGMA } from './radiation';

export interface Optics {
  /** emissivity ε = absorptivity α */
  eps: number;
  /** transmissivity τ */
  tau: number;
}

export interface FaceFlows {
  /** incident radiation G [W/m²] */
  G: number;
  /** reflected ρ·G */
  refl: number;
  /** absorbed α·G */
  abs: number;
  /** transmitted τ·G */
  trans: number;
  /** self-emission ε·σ·T⁴ */
  emis: number;
  /** reflectivity ρ = 1 − ε − τ */
  rho: number;
  /** net radiative flux into the surface: α·G − ε·σ·T⁴ */
  net: number;
}

/** Flows at a surface of temperature `TsC` [°C] that is hit by the irradiation `G` [W/m²]. */
export function faceFlows(G: number, o: Optics, TsC: number): FaceFlows {
  const rho = Math.max(0, 1 - o.eps - o.tau);
  const emis = o.eps * SIGMA * (TsC + 273.15) ** 4;
  const abs = o.eps * G;
  return { G, refl: rho * G, abs, trans: o.tau * G, emis, rho, net: abs - emis };
}
