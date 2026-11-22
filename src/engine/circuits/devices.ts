/**
 * Device library for the circuit simulator. Every device declares its pins,
 * the number of extra MNA unknowns (branch currents) it needs, and how it
 * stamps itself into the linear system — linearised around the current
 * Newton iterate for nonlinear devices, with companion models for capacitors
 * and inductors in transient analysis, and with the previous accepted
 * solution for digital/behavioural parts (gates, flip-flops, relays, 555).
 */

export type CKind =
  // sources
  | 'vsource'
  | 'isource'
  | 'acsource'
  | 'battery'
  | 'ground'
  // passive
  | 'resistor'
  | 'pot'
  | 'lamp'
  | 'capacitor'
  | 'inductor'
  | 'transformer'
  | 'fuse'
  | 'ldr'
  | 'thermistor'
  | 'speaker'
  // switches & relays
  | 'switch'
  | 'spdt'
  | 'dpdt'
  | 'pushNO'
  | 'pushNC'
  | 'relay'
  // diodes
  | 'diode'
  | 'zener'
  | 'led'
  | 'photodiode'
  | 'bridge'
  // transistors
  | 'npn'
  | 'pnp'
  | 'nmos'
  | 'pmos'
  | 'njfet'
  | 'pjfet'
  // controlled sources
  | 'vcvs'
  | 'vccs'
  | 'ccvs'
  | 'cccs'
  // ICs
  | 'opamp'
  | 'regulator'
  | 'timer555'
  // digital
  | 'logicIn'
  | 'clock'
  | 'logicOut'
  | 'buffer'
  | 'not'
  | 'and'
  | 'nand'
  | 'or'
  | 'nor'
  | 'xor'
  | 'xnor'
  | 'dff'
  | 'jkff'
  | 'tff'
  | 'srff'
  // meters
  | 'ammeter'
  | 'voltmeter'
  | 'probe';

export interface CParams {
  R?: number;
  V?: number;
  I?: number;
  Is?: number;
  n?: number;
  Vf?: number;
  Inom?: number;
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'white';
  Vnom?: number;
  Pnom?: number;
  Pmax?: number;
  closed?: boolean;
  C?: number;
  L?: number;
  Vz?: number;
  Iph?: number;
  light?: number;
  beta?: number;
  betaR?: number;
  Vt0?: number;
  K?: number;
  lambda?: number;
  Idss?: number;
  Vp?: number;
  gain?: number;
  Rcoil?: number;
  Ipull?: number;
  ratio?: number;
  k?: number;
  A?: number;
  Vsat?: number;
  Vlogic?: number;
  inputs?: number;
  freq?: number;
  amp?: number;
  offset?: number;
  wave?: 'sine' | 'square' | 'triangle';
  duty?: number;
  pos?: number;
  Rdark?: number;
  Rlight?: number;
  R25?: number;
  B?: number;
  T?: number;
  rating?: number;
  r?: number;
  Vreg?: number;
  drop?: number;
  /** spdt/dpdt/logicIn position or level */
  on?: boolean;
}

export interface CComponent {
  id: string;
  kind: CKind;
  name: string;
  params: CParams;
}

export const VT = 0.025852;
export const GMIN = 1e-12;
const R_ON = 1e-3;
/** winding resistance of inductors and transformers (avoids ideal loops with voltage sources at DC) */
const R_W = 1e-3;
const R_OUT = 25; // logic output resistance

export interface Env {
  mode: 'dc' | 'tran';
  t: number;
  h: number;
  /** pin voltage at the current Newton iterate / previous accepted solution */
  v: (pin: string) => number;
  vp: (pin: string) => number;
  /** branch current k of this device at the iterate / previous accepted solution */
  br: (k: number) => number;
  brp: (k: number) => number;
  /** persistent device state (digital levels, relay, fuse, flip-flops) */
  state: Record<string, number | boolean>;
  /** Newton junction limiting memory (per solve) */
  lim: Map<string, number>;
}

export interface Stamper {
  /** conductance between pins */
  g: (a: string, b: string, g: number) => void;
  /** current J flowing from a to b through the device */
  i: (a: string, b: string, J: number) => void;
  /** VCCS: current gm·(v(cp) − v(cn)) flowing from a to b through the device */
  gm: (a: string, b: string, cp: string, cn: string, gm: number) => void;
  /** branch k: incidence (current of branch k leaves pin a, enters pin b) */
  branch: (k: number, a: string, b: string) => void;
  /** constraint row of branch k: Σ coeff·v(pin) + Σ coeffB·i(branch) = rhs */
  rowV: (k: number, pin: string, coeff: number) => void;
  rowB: (k: number, k2: number, coeff: number) => void;
  rowRhs: (k: number, value: number) => void;
}

export interface Measure {
  /** current into each pin (same order as pins) */
  pinI: number[];
  /** main voltage / current for two-terminal display (a → b) */
  V?: number;
  I?: number;
  level?: number;
  info?: string;
  warn?: 'overload' | 'reverse' | 'short' | 'blown';
  logic?: boolean;
}

export interface DeviceDef {
  pins: string[];
  branches?: (p: CParams) => number;
  nonlinear?: boolean;
  /** uses previous solution / state: needs the outer fixed-point loop in DC */
  behavioural?: boolean;
  defaults: CParams;
  stamp: (s: Stamper, c: CComponent, e: Env) => void;
  measure: (c: CComponent, e: Env) => Measure;
  /** after an accepted solution: update state; return true if the state changed */
  update?: (c: CComponent, e: Env) => boolean;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pnjlim(vNew: number, vOld: number, nVt: number, vcrit: number) {
  if (vNew > vcrit && Math.abs(vNew - vOld) > 2 * nVt) {
    if (vOld > 0) {
      const arg = 1 + (vNew - vOld) / nVt;
      return arg > 0 ? vOld + nVt * Math.log(arg) : vcrit;
    }
    return nVt * Math.log(vNew / nVt);
  }
  return vNew;
}

/** Linearised junction: returns limited voltage, current and conductance. */
function junction(e: Env, key: string, vRaw: number, Is: number, n: number) {
  const nVt = n * VT;
  const vcrit = nVt * Math.log(nVt / (Math.SQRT2 * Is));
  const old = e.lim.get(key) ?? 0.6;
  const v = pnjlim(vRaw, old, nVt, vcrit);
  e.lim.set(key, v);
  const ex = Math.exp(Math.min(v / nVt, 80));
  return { v, i: Is * (ex - 1), g: (Is * ex) / nVt + GMIN };
}

/** Exact junction current at a voltage (for measurements). */
const jcur = (v: number, Is: number, n: number) => Is * (Math.exp(Math.min(v / (n * VT), 80)) - 1);

/** Stamp a junction (diode) between anode a and cathode k. */
function stampDiode(s: Stamper, e: Env, key: string, a: string, k: string, Is: number, n: number) {
  const j = junction(e, key, e.v(a) - e.v(k), Is, n);
  s.g(a, k, j.g);
  s.i(a, k, j.i - j.g * j.v);
}

export const ledParams = (p: CParams) => {
  const n = 2;
  const Vf = p.Vf ?? 2;
  const Inom = p.Inom ?? 0.02;
  return { Is: Inom / (Math.exp(Vf / (n * VT)) - 1), n };
};
export const diodeParams = (c: { kind: CKind; params: CParams }) => (c.kind === 'led' ? ledParams(c.params) : { Is: c.params.Is ?? 2.52e-9, n: c.params.n ?? 1.752 });
export const lampR = (p: CParams) => (p.Vnom ?? 12) ** 2 / (p.Pnom ?? 5);
export const ldrR = (p: CParams) => Math.exp(Math.log(p.Rdark ?? 1e6) * (1 - (p.light ?? 0.5)) + Math.log(p.Rlight ?? 100) * (p.light ?? 0.5));
export const ntcR = (p: CParams) => (p.R25 ?? 10000) * Math.exp((p.B ?? 3950) * (1 / ((p.T ?? 25) + 273.15) - 1 / 298.15));

/** Source waveform value at time t. */
export function waveform(p: CParams, t: number, mode: 'dc' | 'tran') {
  const amp = p.amp ?? 5;
  const off = p.offset ?? 0;
  if (mode === 'dc') return off;
  const f = p.freq ?? 50;
  const ph = (t * f) % 1;
  switch (p.wave ?? 'sine') {
    case 'square':
      return off + (ph < (p.duty ?? 0.5) ? amp : -amp);
    case 'triangle':
      return off + amp * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph);
    default:
      return off + amp * Math.sin(2 * Math.PI * f * t);
  }
}

const twoPin = (I: number, V: number, extra: Partial<Measure> = {}): Measure => ({ pinI: [I, -I], V, I, ...extra });
const sw = (s: Stamper, a: string, b: string, closed: boolean) => {
  if (closed) s.g(a, b, 1 / R_ON);
};
const swI = (e: Env, a: string, b: string, closed: boolean) => (closed ? (e.v(a) - e.v(b)) / R_ON : 0);

/** Logic output: Thevenin source of level·Vlogic behind R_OUT, referenced to ground. */
function logicOut(s: Stamper, pin: string, high: boolean, Vl: number) {
  s.g(pin, '', 1 / R_OUT);
  s.i('', pin, (high ? Vl : 0) / R_OUT);
}
const logicOutI = (e: Env, pin: string, high: boolean, Vl: number) => (e.v(pin) - (high ? Vl : 0)) / R_OUT;
const hi = (e: Env, pin: string, Vl: number) => e.vp(pin) > Vl / 2;

/** Gate truth functions. */
const GATE: Record<string, (x: boolean[]) => boolean> = {
  buffer: (x) => x[0]!,
  not: (x) => !x[0],
  and: (x) => x.every(Boolean),
  nand: (x) => !x.every(Boolean),
  or: (x) => x.some(Boolean),
  nor: (x) => !x.some(Boolean),
  xor: (x) => x.filter(Boolean).length % 2 === 1,
  xnor: (x) => x.filter(Boolean).length % 2 === 0,
};

function gate(kind: keyof typeof GATE, nIn: number): DeviceDef {
  const ins = Array.from({ length: nIn }, (_, i) => `in${i + 1}`);
  return {
    pins: [...ins, 'out'],
    behavioural: true,
    defaults: { Vlogic: 5 },
    stamp: (s, c, e) => logicOut(s, 'out', !!e.state.q, c.params.Vlogic ?? 5),
    measure: (c, e) => {
      const Iout = logicOutI(e, 'out', !!e.state.q, c.params.Vlogic ?? 5);
      return { pinI: [...ins.map(() => 0), Iout], logic: !!e.state.q, info: `Q = ${e.state.q ? 1 : 0}` };
    },
    update: (c, e) => {
      const q = GATE[kind]!(ins.map((p) => hi(e, p, c.params.Vlogic ?? 5)));
      const changed = q !== !!e.state.q;
      e.state.q = q;
      return changed;
    },
  };
}

/** Flip-flop factory: edge-triggered on CLK (except SR latch). */
function flipflop(kind: 'dff' | 'jkff' | 'tff' | 'srff'): DeviceDef {
  const inputs = kind === 'dff' ? ['d', 'clk'] : kind === 'jkff' ? ['j', 'clk', 'k'] : kind === 'tff' ? ['t', 'clk'] : ['s', 'r'];
  return {
    pins: [...inputs, 'q', 'qn'],
    behavioural: true,
    defaults: { Vlogic: 5 },
    stamp: (s, c, e) => {
      const Vl = c.params.Vlogic ?? 5;
      logicOut(s, 'q', !!e.state.q, Vl);
      logicOut(s, 'qn', !e.state.q, Vl);
    },
    measure: (c, e) => {
      const Vl = c.params.Vlogic ?? 5;
      return { pinI: [...inputs.map(() => 0), logicOutI(e, 'q', !!e.state.q, Vl), logicOutI(e, 'qn', !e.state.q, Vl)], logic: !!e.state.q, info: `Q = ${e.state.q ? 1 : 0}` };
    },
    update: (c, e) => {
      const Vl = c.params.Vlogic ?? 5;
      const q0 = !!e.state.q;
      let q = q0;
      if (kind === 'srff') {
        const S = hi(e, 's', Vl);
        const R = hi(e, 'r', Vl);
        if (S && !R) q = true;
        else if (R && !S) q = false;
      } else {
        const clk = hi(e, 'clk', Vl);
        const rising = clk && !e.state.clk;
        e.state.clk = clk;
        if (rising) {
          if (kind === 'dff') q = hi(e, 'd', Vl);
          else if (kind === 'tff') q = hi(e, 't', Vl) ? !q0 : q0;
          else {
            const J = hi(e, 'j', Vl);
            const K = hi(e, 'k', Vl);
            q = J && K ? !q0 : J ? true : K ? false : q0;
          }
        }
      }
      e.state.q = q;
      return q !== q0;
    },
  };
}

function bjt(pnp: boolean): DeviceDef {
  const sg = pnp ? -1 : 1;
  const currents = (c: CComponent, e: Env, lin: boolean) => {
    const Is = c.params.Is ?? 1e-14;
    const bf = c.params.beta ?? 100;
    const br = c.params.betaR ?? 1;
    const vbeRaw = sg * (e.v('b') - e.v('e'));
    const vbcRaw = sg * (e.v('b') - e.v('c'));
    let vbe = vbeRaw;
    let vbc = vbcRaw;
    if (lin) {
      const nVt = VT;
      const vcrit = nVt * Math.log(nVt / (Math.SQRT2 * Is));
      vbe = pnjlim(vbeRaw, e.lim.get(`${c.id}be`) ?? 0.6, nVt, vcrit);
      vbc = pnjlim(vbcRaw, e.lim.get(`${c.id}bc`) ?? -1, nVt, vcrit);
      e.lim.set(`${c.id}be`, vbe);
      e.lim.set(`${c.id}bc`, vbc);
    }
    const ef = Math.exp(Math.min(vbe / VT, 80));
    const er = Math.exp(Math.min(vbc / VT, 80));
    const icc = Is * (ef - er); // transport current
    const ibe = (Is / bf) * (ef - 1);
    const ibc = (Is / br) * (er - 1);
    const Ic = icc - ibc;
    const Ib = ibe + ibc;
    // derivatives
    const gf = (Is * ef) / VT;
    const gr = (Is * er) / VT;
    return { vbe, vbc, Ic, Ib, dIc_dvbe: gf, dIc_dvbc: -gr - gr / br, dIb_dvbe: gf / bf, dIb_dvbc: gr / br };
  };
  return {
    pins: ['b', 'c', 'e'],
    nonlinear: true,
    defaults: { beta: 100, betaR: 1, Is: 1e-14 },
    stamp: (s, c, e) => {
      const r = currents(c, e, true);
      // currents into the device: Ic at c, Ib at b, −(Ic+Ib) at e; linearise in vbe = sg(vb − ve), vbc = sg(vb − vc)
      // write as VCCS terms: I_c(into c) = Ic0 + a1·Δvbe + a2·Δvbc
      const terms = (into: string, I0: number, d1: number, d2: number) => {
        // device current flowing into pin "into" from outside == current leaving node "into" into the device
        // node KCL: current leaving node into device = sg·(I0 + d1(vbe − vbe0) + d2(vbc − vbc0))
        const Ieq = sg * (I0 - d1 * r.vbe - d2 * r.vbc);
        s.i(into, '', Ieq);
        s.gm(into, '', 'b', 'e', d1);
        s.gm(into, '', 'b', 'c', d2);
      };
      terms('c', r.Ic, r.dIc_dvbe, r.dIc_dvbc);
      terms('b', r.Ib, r.dIb_dvbe, r.dIb_dvbc);
      terms('e', -(r.Ic + r.Ib), -(r.dIc_dvbe + r.dIb_dvbe), -(r.dIc_dvbc + r.dIb_dvbc));
      s.g('b', 'e', GMIN);
      s.g('b', 'c', GMIN);
    },
    measure: (c, e) => {
      const r = currents(c, e, false);
      const Ic = sg * r.Ic;
      const Ib = sg * r.Ib;
      const vce = sg * (e.v('c') - e.v('e'));
      const region = r.vbe < 0.5 ? 'cut-off' : r.vbc > 0.4 ? 'saturation' : 'active';
      return { pinI: [Ib, Ic, -(Ic + Ib)], info: `I_C = ${fmtA(Ic)}, I_B = ${fmtA(Ib)}, U_CE = ${vce.toFixed(3)} V · ${region}` };
    },
  };
}

function mosfet(p: boolean): DeviceDef {
  const sg = p ? -1 : 1;
  const ids = (c: CComponent, vgs: number, vds: number) => {
    const Vt = c.params.Vt0 ?? 2;
    const K = c.params.K ?? 0.02;
    const lam = c.params.lambda ?? 0.01;
    const vov = vgs - Vt;
    if (vov <= 0) return { I: 0, gm: 0, gds: 0 };
    if (vds < vov) {
      const I = K * (vov * vds - (vds * vds) / 2) * (1 + lam * vds);
      return { I, gm: K * vds * (1 + lam * vds), gds: K * (vov - vds) * (1 + lam * vds) + K * (vov * vds - (vds * vds) / 2) * lam };
    }
    const I = (K / 2) * vov * vov * (1 + lam * vds);
    return { I, gm: K * vov * (1 + lam * vds), gds: (K / 2) * vov * vov * lam };
  };
  return {
    pins: ['g', 'd', 's'],
    nonlinear: true,
    defaults: { Vt0: 2, K: 0.02, lambda: 0.01 },
    stamp: (s, c, e) => {
      let d = 'd';
      let so = 's';
      let vds = sg * (e.v('d') - e.v('s'));
      if (vds < 0) {
        d = 's';
        so = 'd';
        vds = -vds;
      }
      const vgsRaw = sg * (e.v('g') - e.v(so));
      const old = e.lim.get(c.id) ?? vgsRaw;
      const vgs = Math.abs(vgsRaw - old) > 1 ? old + Math.sign(vgsRaw - old) : vgsRaw;
      e.lim.set(c.id, vgs);
      const r = ids(c, vgs, vds);
      // current from d to s (inside) = sg·(I + gm Δvgs + gds Δvds)
      s.i(d, so, sg * (r.I - r.gm * vgs - r.gds * vds));
      s.gm(d, so, 'g', so, r.gm);
      s.gm(d, so, d, so, r.gds);
      s.g('d', 's', GMIN);
    },
    measure: (c, e) => {
      let vds = sg * (e.v('d') - e.v('s'));
      const swap = vds < 0;
      if (swap) vds = -vds;
      const vgs = sg * (e.v('g') - e.v(swap ? 'd' : 's'));
      const I = sg * ids(c, vgs, vds).I * (swap ? -1 : 1);
      const vov = vgs - (c.params.Vt0 ?? 2);
      const region = vov <= 0 ? 'cut-off' : vds < vov ? 'triode' : 'saturation';
      return { pinI: [0, I, -I], info: `I_D = ${fmtA(I)}, U_GS = ${(sg * vgs).toFixed(3)} V · ${region}` };
    },
  };
}

function jfet(p: boolean): DeviceDef {
  const sg = p ? -1 : 1;
  const ids = (c: CComponent, vgs: number, vds: number) => {
    const Idss = c.params.Idss ?? 0.01;
    const Vp = -Math.abs(c.params.Vp ?? 2);
    const lam = c.params.lambda ?? 0.01;
    const b = Idss / (Vp * Vp);
    const vov = vgs - Vp;
    if (vov <= 0) return { I: 0, gm: 0, gds: 0 };
    if (vds < vov) {
      const I = b * (2 * vov * vds - vds * vds) * (1 + lam * vds);
      return { I, gm: 2 * b * vds * (1 + lam * vds), gds: b * (2 * vov - 2 * vds) * (1 + lam * vds) + b * (2 * vov * vds - vds * vds) * lam };
    }
    return { I: b * vov * vov * (1 + lam * vds), gm: 2 * b * vov * (1 + lam * vds), gds: b * vov * vov * lam };
  };
  return {
    pins: ['g', 'd', 's'],
    nonlinear: true,
    defaults: { Idss: 0.01, Vp: 2, lambda: 0.01 },
    stamp: (s, c, e) => {
      let d = 'd';
      let so = 's';
      let vds = sg * (e.v('d') - e.v('s'));
      if (vds < 0) {
        d = 's';
        so = 'd';
        vds = -vds;
      }
      const vgs = sg * (e.v('g') - e.v(so));
      const r = ids(c, vgs, vds);
      s.i(d, so, sg * (r.I - r.gm * vgs - r.gds * vds));
      s.gm(d, so, 'g', so, r.gm);
      s.gm(d, so, d, so, r.gds);
      s.g('d', 's', GMIN);
    },
    measure: (c, e) => {
      let vds = sg * (e.v('d') - e.v('s'));
      const swap = vds < 0;
      if (swap) vds = -vds;
      const vgs = sg * (e.v('g') - e.v(swap ? 'd' : 's'));
      const I = sg * ids(c, vgs, vds).I * (swap ? -1 : 1);
      return { pinI: [0, I, -I], info: `I_D = ${fmtA(I)}, U_GS = ${(sg * vgs).toFixed(3)} V` };
    },
  };
}

export const fmtA = (I: number) => {
  const a = Math.abs(I);
  return a >= 1 ? `${I.toFixed(3)} A` : a >= 1e-3 ? `${(I * 1e3).toFixed(3)} mA` : a >= 1e-6 ? `${(I * 1e6).toFixed(3)} µA` : `${(I * 1e9).toFixed(2)} nA`;
};

// ---------------------------------------------------------------------------
// the library
// ---------------------------------------------------------------------------

const resistorLike = (R: (p: CParams) => number, defaults: CParams, extra?: (c: CComponent, V: number, I: number) => Partial<Measure>): DeviceDef => ({
  pins: ['a', 'b'],
  defaults,
  stamp: (s, c) => s.g('a', 'b', 1 / Math.max(R(c.params), 1e-9)),
  measure: (c, e) => {
    const V = e.v('a') - e.v('b');
    const I = V / Math.max(R(c.params), 1e-9);
    return twoPin(I, V, extra?.(c, V, I));
  },
});

export const DEVICES: Record<CKind, DeviceDef> = {
  ground: { pins: ['a'], defaults: {}, stamp: () => undefined, measure: () => ({ pinI: [0] }) },
  resistor: resistorLike((p) => p.R ?? 1000, { R: 1000 }, (c, V, I) => (c.params.Pmax && V * I > c.params.Pmax ? { warn: 'overload' } : {})),
  lamp: resistorLike(lampR, { Vnom: 12, Pnom: 5 }, (c, V, I) => {
    const level = (V * I) / (c.params.Pnom ?? 5);
    return { level, warn: level > 1.2 ? 'overload' : undefined };
  }),
  speaker: resistorLike((p) => p.R ?? 8, { R: 8 }),
  ldr: resistorLike(ldrR, { Rdark: 1e6, Rlight: 100, light: 0.5 }, (c) => ({ info: `R = ${ldrR(c.params).toPrecision(4)} Ω` })),
  thermistor: resistorLike(ntcR, { R25: 10000, B: 3950, T: 25 }, (c) => ({ info: `R(${c.params.T ?? 25} °C) = ${ntcR(c.params).toPrecision(4)} Ω` })),
  pot: {
    pins: ['a', 'w', 'b'],
    defaults: { R: 10000, pos: 0.5 },
    stamp: (s, c) => {
      const R = c.params.R ?? 10000;
      const p = Math.min(Math.max(c.params.pos ?? 0.5, 0), 1);
      s.g('a', 'w', 1 / Math.max(p * R, 1e-3));
      s.g('w', 'b', 1 / Math.max((1 - p) * R, 1e-3));
    },
    measure: (c, e) => {
      const R = c.params.R ?? 10000;
      const p = Math.min(Math.max(c.params.pos ?? 0.5, 0), 1);
      const Iaw = (e.v('a') - e.v('w')) / Math.max(p * R, 1e-3);
      const Iwb = (e.v('w') - e.v('b')) / Math.max((1 - p) * R, 1e-3);
      return { pinI: [Iaw, Iwb - Iaw, -Iwb], V: e.v('a') - e.v('b'), I: Iaw, info: `U_wiper = ${(e.v('w') - e.v('b')).toFixed(3)} V` };
    },
  },
  fuse: {
    pins: ['a', 'b'],
    behavioural: true,
    defaults: { rating: 1, R: 0.01 },
    stamp: (s, c, e) => {
      if (!e.state.blown) s.g('a', 'b', 1 / (c.params.R ?? 0.01));
    },
    measure: (c, e) => {
      const V = e.v('a') - e.v('b');
      const I = e.state.blown ? 0 : V / (c.params.R ?? 0.01);
      return twoPin(I, V, e.state.blown ? { warn: 'blown', info: 'blown' } : {});
    },
    update: (c, e) => {
      if (e.state.blown) return false;
      const I = (e.vp('a') - e.vp('b')) / (c.params.R ?? 0.01);
      if (Math.abs(I) > (c.params.rating ?? 1)) {
        e.state.blown = true;
        return true;
      }
      return false;
    },
  },
  vsource: {
    pins: ['a', 'b'],
    branches: () => 1,
    defaults: { V: 12 },
    stamp: (s, c) => {
      s.branch(0, 'a', 'b');
      s.rowV(0, 'a', 1);
      s.rowV(0, 'b', -1);
      s.rowRhs(0, c.params.V ?? 0);
    },
    measure: (_c, e) => {
      const I = e.br(0);
      return twoPin(I, e.v('a') - e.v('b'), Math.abs(I) > 100 ? { warn: 'short' } : {});
    },
  },
  battery: {
    pins: ['a', 'b'],
    branches: () => 1,
    defaults: { V: 9, r: 1 },
    stamp: (s, c) => {
      s.branch(0, 'a', 'b');
      s.rowV(0, 'a', 1);
      s.rowV(0, 'b', -1);
      s.rowB(0, 0, -(c.params.r ?? 0));
      s.rowRhs(0, c.params.V ?? 9);
    },
    measure: (_c, e) => twoPin(e.br(0), e.v('a') - e.v('b')),
  },
  acsource: {
    pins: ['a', 'b'],
    branches: () => 1,
    defaults: { amp: 5, freq: 50, offset: 0, wave: 'sine', duty: 0.5 },
    stamp: (s, c, e) => {
      s.branch(0, 'a', 'b');
      s.rowV(0, 'a', 1);
      s.rowV(0, 'b', -1);
      s.rowRhs(0, waveform(c.params, e.t, e.mode));
    },
    measure: (_c, e) => twoPin(e.br(0), e.v('a') - e.v('b')),
  },
  isource: {
    pins: ['a', 'b'],
    defaults: { I: 0.01 },
    stamp: (s, c) => s.i('b', 'a', c.params.I ?? 0.01),
    measure: (c, e) => twoPin(-(c.params.I ?? 0.01), e.v('a') - e.v('b')),
  },
  capacitor: {
    pins: ['a', 'b'],
    defaults: { C: 1e-6 },
    stamp: (s, c, e) => {
      if (e.mode === 'dc') return;
      const g = (c.params.C ?? 1e-6) / e.h;
      s.g('a', 'b', g);
      s.i('a', 'b', -g * (e.vp('a') - e.vp('b')));
    },
    measure: (c, e) => {
      const V = e.v('a') - e.v('b');
      const I = e.mode === 'dc' ? 0 : ((c.params.C ?? 1e-6) / e.h) * (V - (e.vp('a') - e.vp('b')));
      return twoPin(I, V);
    },
  },
  inductor: {
    pins: ['a', 'b'],
    branches: () => 1,
    defaults: { L: 1e-3 },
    stamp: (s, c, e) => {
      s.branch(0, 'a', 'b');
      s.rowV(0, 'a', 1);
      s.rowV(0, 'b', -1);
      s.rowB(0, 0, -R_W);
      if (e.mode === 'tran') {
        const Lh = (c.params.L ?? 1e-3) / e.h;
        s.rowB(0, 0, -Lh);
        s.rowRhs(0, -Lh * e.brp(0));
      }
    },
    measure: (_c, e) => twoPin(e.br(0), e.v('a') - e.v('b')),
  },
  transformer: {
    // primary p1–p2, secondary s1–s2; L1, turns ratio n = N2/N1, coupling k
    pins: ['p1', 'p2', 's1', 's2'],
    branches: () => 2,
    defaults: { L: 1, ratio: 0.1, k: 0.999 },
    stamp: (s, c, e) => {
      s.branch(0, 'p1', 'p2');
      s.branch(1, 's1', 's2');
      s.rowV(0, 'p1', 1);
      s.rowV(0, 'p2', -1);
      s.rowV(1, 's1', 1);
      s.rowV(1, 's2', -1);
      s.rowB(0, 0, -R_W);
      s.rowB(1, 1, -R_W);
      if (e.mode === 'tran') {
        const L1 = c.params.L ?? 1;
        const L2 = L1 * (c.params.ratio ?? 0.1) ** 2;
        const M = (c.params.k ?? 0.999) * Math.sqrt(L1 * L2);
        const h = e.h;
        s.rowB(0, 0, -L1 / h);
        s.rowB(0, 1, -M / h);
        s.rowB(1, 0, -M / h);
        s.rowB(1, 1, -L2 / h);
        s.rowRhs(0, -(L1 * e.brp(0) + M * e.brp(1)) / h);
        s.rowRhs(1, -(M * e.brp(0) + L2 * e.brp(1)) / h);
      }
    },
    measure: (_c, e) => ({ pinI: [e.br(0), -e.br(0), e.br(1), -e.br(1)], info: `U₁ = ${(e.v('p1') - e.v('p2')).toFixed(3)} V, U₂ = ${(e.v('s1') - e.v('s2')).toFixed(3)} V` }),
  },
  switch: {
    pins: ['a', 'b'],
    defaults: { closed: true },
    stamp: (s, c) => sw(s, 'a', 'b', !!c.params.closed),
    measure: (c, e) => twoPin(swI(e, 'a', 'b', !!c.params.closed), e.v('a') - e.v('b')),
  },
  pushNO: {
    pins: ['a', 'b'],
    defaults: { on: false },
    stamp: (s, c) => sw(s, 'a', 'b', !!c.params.on),
    measure: (c, e) => twoPin(swI(e, 'a', 'b', !!c.params.on), e.v('a') - e.v('b')),
  },
  pushNC: {
    pins: ['a', 'b'],
    defaults: { on: false },
    stamp: (s, c) => sw(s, 'a', 'b', !c.params.on),
    measure: (c, e) => twoPin(swI(e, 'a', 'b', !c.params.on), e.v('a') - e.v('b')),
  },
  spdt: {
    pins: ['com', 'a', 'b'],
    defaults: { on: false },
    stamp: (s, c) => {
      sw(s, 'com', 'a', !c.params.on);
      sw(s, 'com', 'b', !!c.params.on);
    },
    measure: (c, e) => {
      const Ia = swI(e, 'com', 'a', !c.params.on);
      const Ib = swI(e, 'com', 'b', !!c.params.on);
      return { pinI: [Ia + Ib, -Ia, -Ib], info: c.params.on ? 'com → 2' : 'com → 1' };
    },
  },
  dpdt: {
    pins: ['com1', 'a1', 'b1', 'com2', 'a2', 'b2'],
    defaults: { on: false },
    stamp: (s, c) => {
      sw(s, 'com1', 'a1', !c.params.on);
      sw(s, 'com1', 'b1', !!c.params.on);
      sw(s, 'com2', 'a2', !c.params.on);
      sw(s, 'com2', 'b2', !!c.params.on);
    },
    measure: (c, e) => {
      const r = [1, 2].flatMap((k) => {
        const Ia = swI(e, `com${k}`, `a${k}`, !c.params.on);
        const Ib = swI(e, `com${k}`, `b${k}`, !!c.params.on);
        return [Ia + Ib, -Ia, -Ib];
      });
      return { pinI: r, info: c.params.on ? 'position 2' : 'position 1' };
    },
  },
  relay: {
    // coil c1–c2, contact com with normally-open "no" and normally-closed "nc"
    pins: ['c1', 'c2', 'com', 'no', 'nc'],
    behavioural: true,
    defaults: { Rcoil: 400, Ipull: 0.02 },
    stamp: (s, c, e) => {
      s.g('c1', 'c2', 1 / (c.params.Rcoil ?? 400));
      sw(s, 'com', 'no', !!e.state.on);
      sw(s, 'com', 'nc', !e.state.on);
    },
    measure: (c, e) => {
      const Ic = (e.v('c1') - e.v('c2')) / (c.params.Rcoil ?? 400);
      const Ino = swI(e, 'com', 'no', !!e.state.on);
      const Inc = swI(e, 'com', 'nc', !e.state.on);
      return { pinI: [Ic, -Ic, Ino + Inc, -Ino, -Inc], info: `${e.state.on ? 'energised' : 'released'} · I_coil = ${fmtA(Ic)}` };
    },
    update: (c, e) => {
      const Ic = Math.abs((e.vp('c1') - e.vp('c2')) / (c.params.Rcoil ?? 400));
      const Ip = c.params.Ipull ?? 0.02;
      const on = e.state.on ? Ic > 0.5 * Ip : Ic > Ip; // hysteresis: drop-out at half the pull-in current
      const changed = on !== !!e.state.on;
      e.state.on = on;
      return changed;
    },
  },
  diode: {
    pins: ['a', 'b'],
    nonlinear: true,
    defaults: { Is: 2.52e-9, n: 1.752 },
    stamp: (s, c, e) => stampDiode(s, e, c.id, 'a', 'b', c.params.Is ?? 2.52e-9, c.params.n ?? 1.752),
    measure: (c, e) => {
      const V = e.v('a') - e.v('b');
      return twoPin(jcur(V, c.params.Is ?? 2.52e-9, c.params.n ?? 1.752), V);
    },
  },
  led: {
    pins: ['a', 'b'],
    nonlinear: true,
    defaults: { Vf: 2, Inom: 0.02, color: 'red' },
    stamp: (s, c, e) => {
      const { Is, n } = ledParams(c.params);
      stampDiode(s, e, c.id, 'a', 'b', Is, n);
    },
    measure: (c, e) => {
      const { Is, n } = ledParams(c.params);
      const V = e.v('a') - e.v('b');
      const I = jcur(V, Is, n);
      const level = Math.max(0, I) / (c.params.Inom ?? 0.02);
      return twoPin(I, V, { level, warn: level > 1.5 ? 'overload' : V < -5 ? 'reverse' : undefined });
    },
  },
  zener: {
    pins: ['a', 'b'],
    nonlinear: true,
    defaults: { Is: 1e-12, n: 1, Vz: 5.1 },
    stamp: (s, c, e) => {
      const Is = c.params.Is ?? 1e-12;
      const n = c.params.n ?? 1;
      const Vz = c.params.Vz ?? 5.1;
      stampDiode(s, e, c.id, 'a', 'b', Is, n);
      // breakdown: a diode from b to a, shifted by Vz
      // breakdown branch normalised to 1 mA just above U_Z
      const j = junction(e, `${c.id}z`, e.v('b') - e.v('a') - Vz, 1e-3, 1);
      s.g('b', 'a', j.g);
      // I(v_ba) = j.i + j.g·((v_ba − Vz) − j.v)
      s.i('b', 'a', j.i - j.g * (j.v + Vz));
    },
    measure: (c, e) => {
      const Is = c.params.Is ?? 1e-12;
      const n = c.params.n ?? 1;
      const V = e.v('a') - e.v('b');
      const I = jcur(V, Is, n) - jcur(-V - (c.params.Vz ?? 5.1), 1e-3, 1);
      return twoPin(I, V, { info: V < -(c.params.Vz ?? 5.1) * 0.95 ? 'breakdown' : undefined });
    },
  },
  photodiode: {
    pins: ['a', 'b'],
    nonlinear: true,
    defaults: { Is: 1e-9, n: 1.5, Iph: 0.001, light: 0.5 },
    stamp: (s, c, e) => {
      stampDiode(s, e, c.id, 'a', 'b', c.params.Is ?? 1e-9, c.params.n ?? 1.5);
      s.i('b', 'a', (c.params.Iph ?? 0.001) * (c.params.light ?? 0.5));
    },
    measure: (c, e) => {
      const V = e.v('a') - e.v('b');
      return twoPin(jcur(V, c.params.Is ?? 1e-9, c.params.n ?? 1.5) - (c.params.Iph ?? 0.001) * (c.params.light ?? 0.5), V);
    },
  },
  bridge: {
    // ac1, ac2, plus, minus
    pins: ['ac1', 'ac2', 'p', 'm'],
    nonlinear: true,
    defaults: { Is: 2.52e-9, n: 1.752 },
    stamp: (s, c, e) => {
      const Is = c.params.Is ?? 2.52e-9;
      const n = c.params.n ?? 1.752;
      stampDiode(s, e, `${c.id}1`, 'ac1', 'p', Is, n);
      stampDiode(s, e, `${c.id}2`, 'ac2', 'p', Is, n);
      stampDiode(s, e, `${c.id}3`, 'm', 'ac1', Is, n);
      stampDiode(s, e, `${c.id}4`, 'm', 'ac2', Is, n);
    },
    measure: (c, e) => {
      const Is = c.params.Is ?? 2.52e-9;
      const n = c.params.n ?? 1.752;
      const d = (a: string, k: string) => jcur(e.v(a) - e.v(k), Is, n);
      const i1 = d('ac1', 'p');
      const i2 = d('ac2', 'p');
      const i3 = d('m', 'ac1');
      const i4 = d('m', 'ac2');
      return { pinI: [i1 - i3, i2 - i4, -(i1 + i2), i3 + i4], info: `U_DC = ${(e.v('p') - e.v('m')).toFixed(3)} V` };
    },
  },
  npn: bjt(false),
  pnp: bjt(true),
  nmos: mosfet(false),
  pmos: mosfet(true),
  njfet: jfet(false),
  pjfet: jfet(true),
  vcvs: {
    // control cp–cn, output op–on: U_out = μ·U_ctrl
    pins: ['cp', 'cn', 'op', 'on'],
    branches: () => 1,
    defaults: { gain: 10 },
    stamp: (s, c) => {
      const mu = c.params.gain ?? 10;
      s.branch(0, 'op', 'on');
      s.rowV(0, 'op', 1);
      s.rowV(0, 'on', -1);
      s.rowV(0, 'cp', -mu);
      s.rowV(0, 'cn', mu);
    },
    measure: (_c, e) => ({ pinI: [0, 0, e.br(0), -e.br(0)], info: `U_out = ${(e.v('op') - e.v('on')).toFixed(4)} V` }),
  },
  vccs: {
    // I = gm·U_ctrl leaves through "op" into the circuit
    pins: ['cp', 'cn', 'op', 'on'],
    defaults: { gain: 0.001 },
    stamp: (s, c) => s.gm('on', 'op', 'cp', 'cn', c.params.gain ?? 0.001),
    measure: (c, e) => {
      const I = (c.params.gain ?? 0.001) * (e.v('cp') - e.v('cn'));
      return { pinI: [0, 0, -I, I], info: `I_out = ${fmtA(I)}` };
    },
  },
  ccvs: {
    // control current through the cp–cn short; U_out = r·I_ctrl
    pins: ['cp', 'cn', 'op', 'on'],
    branches: () => 2,
    defaults: { gain: 1000 },
    stamp: (s, c) => {
      s.branch(0, 'cp', 'cn');
      s.rowV(0, 'cp', 1);
      s.rowV(0, 'cn', -1);
      s.branch(1, 'op', 'on');
      s.rowV(1, 'op', 1);
      s.rowV(1, 'on', -1);
      s.rowB(1, 0, -(c.params.gain ?? 1000));
    },
    measure: (_c, e) => ({ pinI: [e.br(0), -e.br(0), e.br(1), -e.br(1)], info: `I_ctrl = ${fmtA(e.br(0))}` }),
  },
  cccs: {
    // I_out = β·I_ctrl leaves through "op"
    pins: ['cp', 'cn', 'op', 'on'],
    branches: () => 2,
    defaults: { gain: 10 },
    stamp: (s, c) => {
      s.branch(0, 'cp', 'cn');
      s.rowV(0, 'cp', 1);
      s.rowV(0, 'cn', -1);
      // output current as a branch: i1 = β·i0, flowing from on to op inside (leaving op into the circuit)
      s.branch(1, 'on', 'op');
      s.rowB(1, 1, 1);
      s.rowB(1, 0, -(c.params.gain ?? 10));
    },
    measure: (_c, e) => ({ pinI: [e.br(0), -e.br(0), -e.br(1), e.br(1)], info: `I_out = ${fmtA(e.br(1))}` }),
  },
  opamp: {
    // non-inverting +, inverting −, output (referenced to ground); smooth saturation at ±Vsat
    pins: ['inp', 'inn', 'out'],
    branches: () => 1,
    nonlinear: true,
    defaults: { A: 1e5, Vsat: 13.5 },
    stamp: (s, c, e) => {
      const A = c.params.A ?? 1e5;
      const Vs = c.params.Vsat ?? 13.5;
      const vd = e.v('inp') - e.v('inn');
      const f = Vs * Math.tanh((A * vd) / Vs);
      const df = A * (1 - Math.tanh((A * vd) / Vs) ** 2);
      s.branch(0, 'out', '');
      s.rowV(0, 'out', 1);
      s.rowV(0, 'inp', -df);
      s.rowV(0, 'inn', df);
      s.rowRhs(0, f - df * vd);
    },
    measure: (c, e) => {
      const vo = e.v('out');
      return { pinI: [0, 0, e.br(0)], info: `U_out = ${vo.toFixed(4)} V${Math.abs(vo) > 0.98 * (c.params.Vsat ?? 13.5) ? ' · saturated' : ''}` };
    },
  },
  regulator: {
    // in, gnd, out: U_out = min(U_reg, U_in − U_drop), pass current from in to out
    pins: ['in', 'gnd', 'out'],
    branches: () => 1,
    nonlinear: true,
    defaults: { Vreg: 5, drop: 2 },
    stamp: (s, c, e) => {
      const Vr = c.params.Vreg ?? 5;
      const vin = e.v('in') - e.v('gnd');
      const x = vin - (c.params.drop ?? 2);
      // smooth min(Vr, x) with softness 0.05 V; and ≥ 0
      const w = 0.05;
      const m = 0.5 * (Vr + x - Math.sqrt((Vr - x) ** 2 + w * w));
      const dm = 0.5 * (1 - (x - Vr) / Math.sqrt((Vr - x) ** 2 + w * w));
      s.branch(0, 'in', 'out');
      s.rowV(0, 'out', 1);
      s.rowV(0, 'gnd', -1 + dm);
      s.rowV(0, 'in', -dm);
      s.rowRhs(0, Math.max(m, 0) - dm * vin);
    },
    measure: (_c, e) => ({ pinI: [e.br(0), 0, -e.br(0)], info: `U_out = ${(e.v('out') - e.v('gnd')).toFixed(3)} V` }),
  },
  timer555: {
    // gnd, trig, out, reset, ctrl, thres, dis, vcc — behavioural: comparators at 1/3 and 2/3 VCC, SR flip-flop, discharge switch
    pins: ['gnd', 'trig', 'out', 'reset', 'ctrl', 'thres', 'dis', 'vcc'],
    behavioural: true,
    defaults: {},
    stamp: (s, _c, e) => {
      // internal divider 5k–5k–5k between vcc, ctrl, gnd (only the ctrl tap is modelled: 10k to vcc… 5k to gnd)
      s.g('vcc', 'ctrl', 1 / 5000);
      s.g('ctrl', 'gnd', 1 / 10000);
      const vcc = e.vp('vcc') - e.vp('gnd');
      s.g('out', 'gnd', 1 / R_OUT);
      s.i('gnd', 'out', (e.state.q ? Math.max(vcc - 1.5, 0) : 0) / R_OUT);
      if (!e.state.q) s.g('dis', 'gnd', 1 / 10);
    },
    measure: (_c, e) => {
      const vcc = e.v('vcc') - e.v('gnd');
      const Iout = (e.v('out') - e.v('gnd') - (e.state.q ? Math.max(vcc - 1.5, 0) : 0)) / R_OUT;
      const Idis = e.state.q ? 0 : (e.v('dis') - e.v('gnd')) / 10;
      const Ivc = (e.v('vcc') - e.v('ctrl')) / 5000;
      const Icg = (e.v('ctrl') - e.v('gnd')) / 10000;
      return { pinI: [-Iout - Idis - Icg, 0, Iout, 0, Icg - Ivc, 0, Idis, Ivc], logic: !!e.state.q, info: `OUT ${e.state.q ? 'high' : 'low'}` };
    },
    update: (_c, e) => {
      const ctrl = e.vp('ctrl') - e.vp('gnd');
      const q0 = !!e.state.q;
      let q = q0;
      const resetLow = e.vp('reset') - e.vp('gnd') < 0.7;
      if (resetLow) q = false;
      else if (e.vp('trig') - e.vp('gnd') < ctrl / 2) q = true;
      else if (e.vp('thres') - e.vp('gnd') > ctrl) q = false;
      e.state.q = q;
      return q !== q0;
    },
  },
  logicIn: {
    pins: ['out'],
    defaults: { on: false, Vlogic: 5 },
    stamp: (s, c) => logicOut(s, 'out', !!c.params.on, c.params.Vlogic ?? 5),
    measure: (c, e) => ({ pinI: [logicOutI(e, 'out', !!c.params.on, c.params.Vlogic ?? 5)], logic: !!c.params.on, info: c.params.on ? '1' : '0' }),
  },
  clock: {
    pins: ['out'],
    defaults: { freq: 100, Vlogic: 5 },
    stamp: (s, c, e) => logicOut(s, 'out', e.mode === 'tran' && (e.t * (c.params.freq ?? 100)) % 1 < 0.5, c.params.Vlogic ?? 5),
    measure: (c, e) => {
      const high = e.mode === 'tran' && (e.t * (c.params.freq ?? 100)) % 1 < 0.5;
      return { pinI: [logicOutI(e, 'out', high, c.params.Vlogic ?? 5)], logic: high };
    },
  },
  logicOut: {
    pins: ['in'],
    defaults: { Vlogic: 5 },
    stamp: () => undefined,
    measure: (c, e) => {
      const high = e.v('in') > (c.params.Vlogic ?? 5) / 2;
      return { pinI: [0], logic: high, V: e.v('in'), info: high ? 'H' : 'L' };
    },
  },
  buffer: gate('buffer', 1),
  not: gate('not', 1),
  and: gate('and', 2),
  nand: gate('nand', 2),
  or: gate('or', 2),
  nor: gate('nor', 2),
  xor: gate('xor', 2),
  xnor: gate('xnor', 2),
  dff: flipflop('dff'),
  jkff: flipflop('jkff'),
  tff: flipflop('tff'),
  srff: flipflop('srff'),
  ammeter: {
    pins: ['a', 'b'],
    branches: () => 1,
    defaults: {},
    stamp: (s) => {
      s.branch(0, 'a', 'b');
      s.rowV(0, 'a', 1);
      s.rowV(0, 'b', -1);
    },
    measure: (_c, e) => twoPin(e.br(0), e.v('a') - e.v('b')),
  },
  voltmeter: { pins: ['a', 'b'], defaults: {}, stamp: () => undefined, measure: (_c, e) => twoPin(0, e.v('a') - e.v('b')) },
  probe: { pins: ['a'], defaults: {}, stamp: () => undefined, measure: (_c, e) => ({ pinI: [0], V: e.v('a') }) },
};

/** Gates with a configurable number of inputs. */
export function pinsOf(c: { kind: CKind; params: CParams }): string[] {
  if (['and', 'nand', 'or', 'nor'].includes(c.kind) && (c.params.inputs ?? 2) === 3) return ['in1', 'in2', 'in3', 'out'];
  return DEVICES[c.kind].pins;
}
export function deviceOf(c: { kind: CKind; params: CParams }): DeviceDef {
  if (['and', 'nand', 'or', 'nor'].includes(c.kind) && (c.params.inputs ?? 2) === 3) return gate(c.kind as 'and', 3);
  return DEVICES[c.kind];
}
