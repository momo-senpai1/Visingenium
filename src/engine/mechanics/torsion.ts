/**
 * Stepped circular shaft in torsion. Segments i = 1…n with length L, outer and
 * inner diameter and shear modulus G; torques act at the stations between
 * segments (station 0 = left end, station n = right end). The left end is
 * clamped; the right end is free or clamped (statically indeterminate, solved
 * with the compatibility condition Σφ = 0).
 *
 * Sign: torque vectors along +x (right-hand rule) positive; the internal
 * torque is positive when its vector points out of the cut face.
 */

export interface ShaftSegment {
  id: string;
  /** [m] */
  L: number;
  /** outer / inner diameter [mm] */
  D: number;
  d: number;
  /** shear modulus [GPa] */
  G: number;
}

export interface Shaft {
  segments: ShaftSegment[];
  /** applied torque per station [Nm], length n + 1 */
  torques: number[];
  rightFixed: boolean;
}

export interface SegmentResult {
  /** internal torque [Nm] */
  T: number;
  /** polar moment Ip [mm⁴] and section modulus Wt [mm³] */
  Ip: number;
  Wt: number;
  /** max shear stress [MPa] */
  tau: number;
  /** twist of the segment [rad] */
  phi: number;
}

export interface ShaftResult {
  ok: boolean;
  error?: 'empty' | 'geometry';
  /** reaction torques at the left and right end [Nm] */
  TA: number;
  TB: number;
  segs: SegmentResult[];
  /** cumulative rotation at each station [rad] */
  rot: number[];
  x: number[];
}

export const polar = (D: number, d: number) => {
  const Ip = (Math.PI * (D ** 4 - d ** 4)) / 32;
  return { Ip, Wt: Ip / (D / 2) };
};

/** Torque from transmitted power: T = P / (2π n). P in kW, n in 1/min → T in Nm. */
export const torqueFromPower = (PkW: number, rpm: number) => (PkW * 1000) / ((2 * Math.PI * rpm) / 60);

export function solveShaft(s: Shaft): ShaftResult {
  const n = s.segments.length;
  const empty: ShaftResult = { ok: false, TA: 0, TB: 0, segs: [], rot: [], x: [] };
  if (!n) return { ...empty, error: 'empty' };
  if (s.segments.some((g) => !(g.L > 0) || !(g.D > 0) || g.d < 0 || g.d >= g.D || !(g.G > 0))) return { ...empty, error: 'geometry' };
  const M = Array.from({ length: n + 1 }, (_, i) => s.torques[i] ?? 0);
  const props = s.segments.map((g) => polar(g.D, g.d));
  // compliance of segment i: L / (G Ip) in rad/Nm (G GPa → N/mm², Ip mm⁴, L m → mm)
  const f = s.segments.map((g, i) => (g.L * 1000) / (g.G * 1000 * props[i]!.Ip) * 1000);
  // internal torque in segment i with left reaction TA: T_i = −(TA + Σ_{k≤i} M_k)
  const partial = s.segments.map((_, i) => M.slice(0, i + 1).reduce((a, b) => a + b, 0));
  let TA: number;
  if (s.rightFixed) {
    // Σ f_i·T_i = 0 → Σ f_i·(TA + S_i) = 0
    const sf = f.reduce((a, b) => a + b, 0);
    TA = -f.reduce((a, fi, i) => a + fi * partial[i]!, 0) / sf;
  } else {
    TA = -M.reduce((a, b) => a + b, 0);
  }
  const segs = s.segments.map((_g, i) => {
    const T = -(TA + partial[i]!);
    const { Ip, Wt } = props[i]!;
    return { T: clean(T), Ip, Wt, tau: (T * 1000) / Wt, phi: f[i]! * T };
  });
  const TB = s.rightFixed ? -(TA + M.reduce((a, b) => a + b, 0)) : 0;
  const rot = [0];
  const x = [0];
  segs.forEach((sg, i) => {
    rot.push(rot[i]! + sg.phi);
    x.push(x[i]! + s.segments[i]!.L);
  });
  return { ok: true, TA: clean(TA), TB: clean(TB), segs, rot, x };
}

const clean = (v: number) => {
  const r = Number(v.toPrecision(10));
  return Math.abs(r) < 1e-9 ? 0 : r;
};
