/**
 * Mass transfer: Fick's law, steady diffusion through a layer, one-sided
 * diffusion through a stagnant gas (Stefan) vs equimolar counter-diffusion,
 * transient diffusion into a semi-infinite medium, binary gas diffusion
 * coefficients (Fuller–Schettler–Giddings) and the heat/mass-transfer analogy.
 */

import { erf } from './transient';

export const R = 8.314462618;

/** Atomic diffusion volumes Σv and molar masses (Fuller et al.). */
export const GASES: Record<string, { name: string; M: number; v: number }> = {
  air: { name: 'Air', M: 28.96, v: 19.7 },
  N2: { name: 'Nitrogen N₂', M: 28.01, v: 18.5 },
  O2: { name: 'Oxygen O₂', M: 32.0, v: 16.3 },
  H2: { name: 'Hydrogen H₂', M: 2.016, v: 6.12 },
  CO2: { name: 'Carbon dioxide CO₂', M: 44.01, v: 26.7 },
  H2O: { name: 'Water vapour H₂O', M: 18.015, v: 13.1 },
  NH3: { name: 'Ammonia NH₃', M: 17.03, v: 20.7 },
  He: { name: 'Helium He', M: 4.003, v: 2.67 },
  ethanol: { name: 'Ethanol', M: 46.07, v: 50.36 },
  methanol: { name: 'Methanol', M: 32.04, v: 31.25 },
  acetone: { name: 'Acetone', M: 58.08, v: 66.86 },
  benzene: { name: 'Benzene', M: 78.11, v: 90.96 },
  toluene: { name: 'Toluene', M: 92.14, v: 111.48 },
};

/** Fuller: D_AB [m²/s] at T [K], p [bar]. */
export function fuller(a: string, b: string, T: number, p: number): number {
  const A = GASES[a]!;
  const B = GASES[b]!;
  const Mab = 2 / (1 / A.M + 1 / B.M);
  const D = (0.00143 * T ** 1.75) / (p * Math.sqrt(Mab) * (Math.cbrt(A.v) + Math.cbrt(B.v)) ** 2); // cm²/s
  return D * 1e-4;
}

/** Saturation pressure of water [bar] (Antoine, 1–100 °C). */
export const psatWater = (TC: number) => 10 ** (8.07131 - 1730.63 / (233.426 + TC)) / 750.062;

export interface StefanResult {
  /** total concentration c = p/(RT) [mol/m³] */
  c: number;
  /** molar flux of A [mol/(m² s)]: one-sided (Stefan), equimolar (Fick only) */
  nStefan: number;
  nEqui: number;
  /** Stefan correction factor */
  factor: number;
  profile: { x: number; yStefan: number; yEqui: number }[];
}

/** Diffusion of A through stagnant B over length L, mole fractions y0 (x = 0) and yL (x = L). */
export function stefan(D: number, T: number, p: number, L: number, y0: number, yL: number): StefanResult {
  const c = (p * 1e5) / (R * T);
  const nEqui = ((c * D) / L) * (y0 - yL);
  const nStefan = ((c * D) / L) * Math.log((1 - yL) / (1 - y0));
  const profile = Array.from({ length: 51 }, (_, i) => {
    const x = (L * i) / 50;
    const yS = 1 - (1 - y0) * ((1 - yL) / (1 - y0)) ** (x / L);
    return { x, yStefan: yS, yEqui: y0 + ((yL - y0) * x) / L };
  });
  return { c, nStefan, nEqui, factor: nStefan / nEqui, profile };
}

/** Transient diffusion into a semi-infinite medium: c(x,t) = c∞ + (cs − c∞)·erfc(x / 2√(Dt)). */
export const penetration = (x: number, t: number, D: number, cs: number, c0: number) => (t <= 0 ? c0 : c0 + (cs - c0) * (1 - erf(x / (2 * Math.sqrt(D * t)))));

/** Amount taken up per area until t (penetration theory): 2(cs − c0)√(Dt/π). */
export const uptake = (t: number, D: number, cs: number, c0: number) => 2 * (cs - c0) * Math.sqrt((D * t) / Math.PI);
