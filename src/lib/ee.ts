/**
 * Electrical-engineering fundamentals for the explainer pages: DC networks, first-order
 * transients, complex AC (phasors, RLC, power, three-phase), transformer, diode/rectifier,
 * bipolar transistor and induction motor. Pure functions, SI units.
 */

// ---------------------------------------------------------------- complex numbers
export interface Cx {
  re: number;
  im: number;
}
export const cx = (re: number, im = 0): Cx => ({ re, im });
export const polar = (r: number, phi: number): Cx => ({ re: r * Math.cos(phi), im: r * Math.sin(phi) });
export const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: Cx, b: Cx): Cx => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cabs = (a: Cx) => Math.hypot(a.re, a.im);
export const carg = (a: Cx) => Math.atan2(a.im, a.re);
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- DC
/** U feeds R1 in series with R2 ∥ R3 */
export function ohmNetwork(U: number, R1: number, R2: number, R3: number) {
  const R23 = (R2 * R3) / (R2 + R3);
  const R = R1 + R23;
  const I1 = U / R;
  const U1 = I1 * R1;
  const U23 = I1 * R23;
  return { R23, R, I1, I2: U23 / R2, I3: U23 / R3, U1, U23, P: U * I1, P1: U1 * I1, P2: (U23 * U23) / R2, P3: (U23 * U23) / R3 };
}

/** divider R1 (top) / R2 (bottom), optionally loaded with RL across R2 */
export function divider(U: number, R1: number, R2: number, RL: number | null) {
  const R2e = RL === null ? R2 : (R2 * RL) / (R2 + RL);
  const U2 = (U * R2e) / (R1 + R2e);
  return { R2e, U2, I: U / (R1 + R2e), unloaded: (U * R2) / (R1 + R2) };
}

/** Wheatstone bridge: left branch R1 (top) / R2, right branch R3 / R4, galvanometer Rg between the midpoints */
export function bridge(U: number, R1: number, R2: number, R3: number, R4: number, Rg: number) {
  const Va = (U * R2) / (R1 + R2);
  const Vb = (U * R4) / (R3 + R4);
  const Ud = Va - Vb;
  const Rth = (R1 * R2) / (R1 + R2) + (R3 * R4) / (R3 + R4);
  return { Va, Vb, Ud, Rth, Ig: Ud / (Rth + Rg), balanced: Math.abs(R1 * R4 - R2 * R3) < 1e-9 * Math.max(1, R1 * R4) };
}

// ---------------------------------------------------------------- first-order transients
/** RC: x = C [F]; RL: x = L [H]. Returns the storage voltage/current and the resistor current at time t after switching. */
export function firstOrder(kind: 'rc' | 'rl', R: number, x: number, U: number, on: boolean, t: number) {
  const tau = kind === 'rc' ? R * x : x / R;
  const e = Math.exp(-t / tau);
  if (kind === 'rc') {
    const uC = on ? U * (1 - e) : U * e;
    const i = (on ? U / R : -U / R) * e;
    return { tau, u: uC, i, uR: i * R, W: 0.5 * x * uC * uC };
  }
  const i = on ? (U / R) * (1 - e) : (U / R) * e;
  const uL = on ? U * e : -U * e;
  return { tau, u: uL, i, uR: i * R, W: 0.5 * x * i * i };
}

// ---------------------------------------------------------------- AC
export type Elem = 'R' | 'L' | 'C';
export function impedance(kind: Elem, R: number, L: number, C: number, w: number): Cx {
  return kind === 'R' ? cx(R) : kind === 'L' ? cx(0, w * L) : cx(0, -1 / (w * C));
}

/** series RLC on a sine source of amplitude (rms) U at frequency f */
export function seriesRLC(R: number, L: number, C: number, U: number, f: number) {
  const w = 2 * Math.PI * f;
  const Z = cx(R, w * L - 1 / (w * C));
  const I = cdiv(cx(U), Z);
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const Q = Math.sqrt(L / C) / R;
  return { Z, I, phi: carg(Z), UR: cmul(I, cx(R)), UL: cmul(I, cx(0, w * L)), UC: cmul(I, cx(0, -1 / (w * C))), f0, Q, B: f0 / Q };
}

/** active, reactive and apparent power for rms U, I and phase φ (u ahead of i); C to compensate to cos φ₂ */
export function acPower(U: number, I: number, phi: number, f: number, cosTarget: number) {
  const P = U * I * Math.cos(phi);
  const Q = U * I * Math.sin(phi);
  const S = U * I;
  const phi2 = Math.acos(Math.min(1, Math.max(0, cosTarget))) * Math.sign(phi || 1);
  const Qc = Math.abs(Math.cos(phi)) < 1e-9 ? 0 : P * (Math.tan(phi) - Math.tan(phi2));
  const C = Qc > 0 ? Qc / (2 * Math.PI * f * U * U) : 0;
  return { P, Q, S, cos: Math.cos(phi), Qc, C, Iafter: Math.hypot(P, Q - Qc) / U };
}

/**
 * Three-phase supply with phase voltage Uph (rms), loads Z per phase.
 * 'star-n': star with neutral; 'star': star without neutral (star point shifts); 'delta'.
 */
export function threePhase(Uph: number, conn: 'star-n' | 'star' | 'delta', Z: [Cx, Cx, Cx]) {
  const U = [polar(Uph, 0), polar(Uph, rad(-120)), polar(Uph, rad(120))] as [Cx, Cx, Cx];
  if (conn === 'delta') {
    // phase k between lines k and k+1
    const Ul = [0, 1, 2].map((k) => csub(U[k]!, U[(k + 1) % 3]!));
    const Iph = Ul.map((u, k) => cdiv(u, Z[k]!));
    const Iline = [0, 1, 2].map((k) => csub(Iph[k]!, Iph[(k + 2) % 3]!));
    return { U, Uload: Ul, Iph, Iline, IN: cx(0), shift: cx(0), P: Ul.reduce((a, u, k) => a + cmul(u, conj(Iph[k]!)).re, 0) };
  }
  const Y = Z.map((z) => cdiv(cx(1), z));
  const shift =
    conn === 'star'
      ? cdiv(
          Y.reduce((a, y, k) => cadd(a, cmul(y, U[k]!)), cx(0)),
          Y.reduce((a, y) => cadd(a, y), cx(0)),
        )
      : cx(0);
  const Uload = U.map((u) => csub(u, shift));
  const Iph = Uload.map((u, k) => cmul(u, Y[k]!));
  const IN = Iph.reduce((a, i) => cadd(a, i), cx(0));
  return { U, Uload, Iph, Iline: Iph, IN: conn === 'star-n' ? IN : cx(0), shift, P: Uload.reduce((a, u, k) => a + cmul(u, conj(Iph[k]!)).re, 0) };
}
const conj = (a: Cx): Cx => ({ re: a.re, im: -a.im });

// ---------------------------------------------------------------- transformer
/** ideal transformer with a resistive load, plus magnetising current from the main inductance Lh (primary side) */
export function transformer(U1: number, N1: number, N2: number, RL: number, f: number, Lh: number) {
  const n = N1 / N2;
  const U2 = U1 / n;
  const I2 = U2 / RL;
  const Im = U1 / (2 * Math.PI * f * Lh);
  const I1load = I2 / n;
  return { n, U2, I2, I1load, Im, I1: Math.hypot(I1load, Im), Rin: RL * n * n, P: U2 * I2, phiMax: (U1 * Math.SQRT2) / (2 * Math.PI * f * N1) };
}

// ---------------------------------------------------------------- diode, rectifier
export const UT = 0.02585;
export const diodeI = (U: number, Is = 1e-14, n = 1) => Is * (Math.exp(Math.min(U / (n * UT), 80)) - 1);

/** operating point of a diode in series with R on U (bisection on U − I R − U_D = 0) */
export function diodeOP(U: number, R: number, Is = 1e-14, n = 1) {
  let lo = -Math.abs(U) - 1;
  let hi = Math.max(U, 0) + 1;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (diodeI(m, Is, n) * R + m > U) hi = m;
    else lo = m;
  }
  const Ud = (lo + hi) / 2;
  return { Ud, I: diodeI(Ud, Is, n) };
}

/** rectifier on a sine of peak Up; output smoothed by C ∥ RL. Constant-forward-voltage diodes, time-stepped. */
export function rectifier(mode: 'half' | 'bridge', Up: number, f: number, C: number, RL: number, UF = 0.7, periods = 4, n = 1600) {
  const dt = periods / f / n;
  const drops = mode === 'half' ? UF : 2 * UF;
  let v = 0;
  const out: { t: number; us: number; uo: number; on: boolean }[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k * dt;
    const us = Up * Math.sin(2 * Math.PI * f * t);
    const src = (mode === 'half' ? us : Math.abs(us)) - drops;
    let on = false;
    if (C <= 0) {
      v = Math.max(0, src);
      on = src > 0;
    } else {
      v -= (v / (RL * C)) * dt;
      if (src > v) {
        v = src;
        on = true;
      }
    }
    out.push({ t, us, uo: v, on });
  }
  const last = out.filter((p) => p.t >= (periods - 1) / f);
  const max = Math.max(...last.map((p) => p.uo));
  const min = Math.min(...last.map((p) => p.uo));
  const mean = last.reduce((a, p) => a + p.uo, 0) / last.length;
  return { pts: out, ripple: max - min, mean, est: C > 0 ? (Up - drops) / RL / ((mode === 'half' ? 1 : 2) * f * C) : NaN };
}

// ---------------------------------------------------------------- bipolar transistor
/** simple NPN output characteristic: active region with Early effect, soft saturation knee */
export const bjtIc = (Ib: number, Uce: number, beta: number, VA = 80) => (Uce <= 0 ? 0 : beta * Ib * (1 - Math.exp(-Uce / 0.12)) * (1 + Uce / VA));

/** common-emitter stage: base driven from Ubb through Rb, collector to Ucc through Rc */
export function bjtStage(Ucc: number, Rc: number, Rb: number, Ubb: number, beta: number) {
  const Ib = Math.max(0, (Ubb - 0.7) / Rb);
  let lo = 0;
  let hi = Ucc;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (Ucc - bjtIc(Ib, m, beta) * Rc > m) lo = m;
    else hi = m;
  }
  const Uce = (lo + hi) / 2;
  const Ic = (Ucc - Uce) / Rc;
  const region = Ib === 0 ? 'cutoff' : Uce < 0.3 ? 'saturation' : 'active';
  return { Ib, Uce, Ic, region: region as 'cutoff' | 'saturation' | 'active', P: Uce * Ic };
}

// ---------------------------------------------------------------- induction motor
/** Kloss formula M(s) = 2 Mk / (s/sk + sk/s) */
export const kloss = (s: number, sk: number, Mk: number) => (s <= 0 ? 0 : (2 * Mk) / (s / sk + sk / s));

/** stable operating point (0 < s < sk) for a load torque ML, or null when ML > Mk (motor stalls) */
export function motorOP(ML: number, sk: number, Mk: number, f: number, p: number) {
  const ns = (60 * f) / p;
  if (ML > Mk) return { ns, s: null as number | null, n: 0 };
  if (ML <= 0) return { ns, s: 0, n: ns };
  let lo = 1e-9;
  let hi = sk;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (kloss(m, sk, Mk) < ML) lo = m;
    else hi = m;
  }
  const s = (lo + hi) / 2;
  return { ns, s, n: ns * (1 - s) };
}
