/**
 * Heat exchanger rating: given both inlet temperatures, capacity rates and
 * k·A, the ε–NTU relations give the duty and outlet temperatures; the
 * temperature profiles along the area follow from the exact exponential
 * solution (co-/counter-current) and the LMTD is reported as a check.
 */

export type Flow = 'counter' | 'parallel' | 'cross';

export interface HXSpec {
  flow: Flow;
  /** hot / cold: mass flow [kg/s], cp [J/(kg K)], inlet [°C] */
  mh: number;
  cph: number;
  Th1: number;
  mc: number;
  cpc: number;
  Tc1: number;
  /** overall coefficient [W/(m²K)] and area [m²] */
  k: number;
  A: number;
}

export interface HXResult {
  ok: boolean;
  Ch: number;
  Cc: number;
  Cmin: number;
  Cr: number;
  NTU: number;
  eps: number;
  Q: number;
  Th2: number;
  Tc2: number;
  dTlm: number;
  /** profiles along the area fraction z = A/A_total; cold given at the same z (its flow direction depends on the arrangement) */
  profile: { z: number; Th: number; Tc: number }[];
}

export function effectiveness(flow: Flow, NTU: number, Cr: number): number {
  if (Cr < 1e-9) return 1 - Math.exp(-NTU);
  if (flow === 'parallel') return (1 - Math.exp(-NTU * (1 + Cr))) / (1 + Cr);
  if (flow === 'counter') {
    if (Math.abs(1 - Cr) < 1e-9) return NTU / (1 + NTU);
    const e = Math.exp(-NTU * (1 - Cr));
    return (1 - e) / (1 - Cr * e);
  }
  // cross flow, both fluids unmixed (approximation, Incropera 11.32)
  return 1 - Math.exp((NTU ** 0.22 / Cr) * (Math.exp(-Cr * NTU ** 0.78) - 1));
}

export function solveHX(s: HXSpec): HXResult {
  const Ch = s.mh * s.cph;
  const Cc = s.mc * s.cpc;
  const Cmin = Math.min(Ch, Cc);
  const Cmax = Math.max(Ch, Cc);
  const Cr = Cmin / Cmax;
  const NTU = (s.k * s.A) / Cmin;
  const eps = effectiveness(s.flow, NTU, Cr);
  const Q = eps * Cmin * (s.Th1 - s.Tc1);
  const Th2 = s.Th1 - Q / Ch;
  const Tc2 = s.Tc1 + Q / Cc;
  const d1 = s.flow === 'parallel' ? s.Th1 - s.Tc1 : s.Th1 - Tc2;
  const d2 = s.flow === 'parallel' ? Th2 - Tc2 : Th2 - s.Tc1;
  const dTlm = Math.abs(d1 - d2) < 1e-9 ? d1 : (d1 - d2) / Math.log(d1 / d2);
  const profile: HXResult['profile'] = [];
  const kA = s.k * s.A;
  for (let i = 0; i <= 100; i++) {
    const z = i / 100;
    if (s.flow === 'parallel') {
      const dT = (s.Th1 - s.Tc1) * Math.exp(-kA * z * (1 / Ch + 1 / Cc));
      // Th − Tc = dT and Ch(Th1 − Th) = Cc(Tc − Tc1)
      const Th = (Ch * s.Th1 + Cc * s.Tc1 + Cc * dT) / (Ch + Cc);
      profile.push({ z, Th, Tc: Th - dT });
    } else {
      // counter-current (cross flow drawn like counter-current): hot enters at z = 0, cold at z = 1
      const m = 1 / Ch - 1 / Cc;
      const dT0 = s.Th1 - Tc2; // at z = 0
      const dT = Math.abs(m) < 1e-15 ? dT0 : dT0 * Math.exp(-kA * z * m);
      // energy balance on [0, z]: Ch(Th1 − Th) = Cc(Tc2 − Tc), with Tc = Th − ΔT
      const Thz = Math.abs(Ch - Cc) < 1e-9 * Ch ? s.Th1 - (Q / Ch) * z : (Ch * s.Th1 - Cc * (Tc2 + dT)) / (Ch - Cc);
      const Tcz = Thz - dT;
      profile.push({ z, Th: Thz, Tc: Tcz });
    }
  }
  return { ok: Cmin > 0 && kA > 0, Ch, Cc, Cmin, Cr, NTU, eps, Q, Th2, Tc2, dTlm, profile };
}
