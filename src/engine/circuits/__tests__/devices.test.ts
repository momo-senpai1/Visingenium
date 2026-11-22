import { describe, expect, it } from 'vitest';
import { simulateTransient, solveCircuit, type CCircuit, type CComponent } from '../solver';

const c = (id: string, kind: CComponent['kind'], params: CComponent['params'] = {}): CComponent => ({ id, kind, name: id, params });
let n = 0;
const w = (a: string, b: string) => ({ id: `w${n++}`, a, b });
const G = c('G', 'ground');

describe('semiconductors', () => {
  it('NPN common-emitter: active region, I_C ≈ β·I_B', () => {
    const r = solveCircuit({
      components: [c('V', 'vsource', { V: 12 }), c('RB', 'resistor', { R: 470e3 }), c('RC', 'resistor', { R: 2200 }), c('Q', 'npn', { beta: 100 }), G],
      wires: [w('V:a', 'RB:a'), w('V:a', 'RC:a'), w('RB:b', 'Q:b'), w('RC:b', 'Q:c'), w('Q:e', 'G:a'), w('V:b', 'G:a')],
    });
    const q = r.comps.get('Q')!;
    expect(r.ok).toBe(true);
    const Ib = q.pinI[0]!;
    const Ic = q.pinI[1]!;
    expect(Ib).toBeGreaterThan(20e-6);
    expect(Ib).toBeLessThan(26e-6);
    expect(Ic / Ib).toBeCloseTo(100, 0);
    expect(q.info).toContain('active');
    expect(r.kclResidual).toBeLessThan(1e-9);
  });
  it('NMOS switch: on when U_GS > U_th', () => {
    const mk = (Vg: number): CCircuit => ({
      components: [c('V', 'vsource', { V: 10 }), c('VG', 'vsource', { V: Vg }), c('RL', 'resistor', { R: 100 }), c('M', 'nmos', { Vt0: 2, K: 0.5 }), G],
      wires: [w('V:a', 'RL:a'), w('RL:b', 'M:d'), w('VG:a', 'M:g'), w('M:s', 'G:a'), w('V:b', 'G:a'), w('VG:b', 'G:a')],
    });
    expect(Math.abs(solveCircuit(mk(0)).comps.get('RL')!.I)).toBeLessThan(1e-9);
    expect(solveCircuit(mk(10)).comps.get('RL')!.I).toBeGreaterThan(0.09);
  });
  it('Zener holds about U_Z', () => {
    const r = solveCircuit({
      components: [c('V', 'vsource', { V: 12 }), c('R', 'resistor', { R: 470 }), c('Z', 'zener', { Vz: 5.1 }), G],
      wires: [w('V:a', 'R:a'), w('R:b', 'Z:b'), w('Z:a', 'G:a'), w('V:b', 'G:a')],
    });
    expect(-r.comps.get('Z')!.V).toBeGreaterThan(5.0);
    expect(-r.comps.get('Z')!.V).toBeLessThan(5.6);
  });
  it('bridge rectifier: DC output for either polarity', () => {
    const mk = (V: number): CCircuit => ({
      components: [c('V', 'vsource', { V }), c('B', 'bridge'), c('RL', 'resistor', { R: 1000 }), G],
      wires: [w('V:a', 'B:ac1'), w('V:b', 'B:ac2'), w('B:p', 'RL:a'), w('B:m', 'RL:b'), w('B:m', 'G:a')],
    });
    expect(solveCircuit(mk(10)).comps.get('RL')!.V).toBeGreaterThan(8.3);
    expect(solveCircuit(mk(-10)).comps.get('RL')!.V).toBeGreaterThan(8.3);
  });
});

describe('ICs and controlled sources', () => {
  it('inverting op-amp amplifier: gain −R2/R1', () => {
    const r = solveCircuit({
      components: [c('V', 'vsource', { V: 0.5 }), c('R1', 'resistor', { R: 1000 }), c('R2', 'resistor', { R: 10000 }), c('U', 'opamp'), G],
      wires: [w('V:a', 'R1:a'), w('R1:b', 'U:inn'), w('R2:a', 'U:inn'), w('R2:b', 'U:out'), w('U:inp', 'G:a'), w('V:b', 'G:a')],
    });
    expect(r.potentials[r.netOf.get('U:out')!]).toBeCloseTo(-5, 2);
  });
  it('op-amp saturates at its rails', () => {
    const r = solveCircuit({
      components: [c('V', 'vsource', { V: 1 }), c('R1', 'resistor', { R: 1000 }), c('R2', 'resistor', { R: 100000 }), c('U', 'opamp', { Vsat: 13.5 }), G],
      wires: [w('V:a', 'R1:a'), w('R1:b', 'U:inn'), w('R2:a', 'U:inn'), w('R2:b', 'U:out'), w('U:inp', 'G:a'), w('V:b', 'G:a')],
    });
    expect(r.potentials[r.netOf.get('U:out')!]).toBeCloseTo(-13.5, 1);
  });
  it('7805-type regulator', () => {
    const r = solveCircuit({
      components: [c('V', 'vsource', { V: 12 }), c('U', 'regulator', { Vreg: 5, drop: 2 }), c('RL', 'resistor', { R: 100 }), G],
      wires: [w('V:a', 'U:in'), w('U:gnd', 'G:a'), w('U:out', 'RL:a'), w('RL:b', 'G:a'), w('V:b', 'G:a')],
    });
    expect(r.comps.get('RL')!.V).toBeCloseTo(5, 2);
    expect(r.comps.get('V')!.I).toBeCloseTo(-0.05, 3);
  });
  it('VCVS, VCCS, CCVS, CCCS', () => {
    const base = (kind: CComponent['kind'], gain: number): CCircuit => ({
      components: [c('V', 'vsource', { V: 2 }), c('RS', 'resistor', { R: 1000 }), c('X', kind, { gain }), c('RL', 'resistor', { R: 1000 }), G],
      wires: [w('V:a', 'RS:a'), w('RS:b', 'X:cp'), w('X:cn', 'G:a'), w('X:op', 'RL:a'), w('RL:b', 'G:a'), w('X:on', 'G:a'), w('V:b', 'G:a')],
    });
    // VCVS: input sees open circuit → U_ctrl = 2 V → U_out = 10·2
    expect(solveCircuit(base('vcvs', 10)).comps.get('RL')!.V).toBeCloseTo(20, 6);
    expect(solveCircuit(base('vccs', 0.001)).comps.get('RL')!.V).toBeCloseTo(2, 6);
    // CCVS: control branch is a short → I_ctrl = 2 mA → U_out = 1000·2 mA
    expect(solveCircuit(base('ccvs', 1000)).comps.get('RL')!.V).toBeCloseTo(2, 6);
    expect(solveCircuit(base('cccs', 10)).comps.get('RL')!.V).toBeCloseTo(20, 6);
  });
  it('battery internal resistance and potentiometer', () => {
    const r = solveCircuit({
      components: [c('B', 'battery', { V: 9, r: 1 }), c('P', 'pot', { R: 8, pos: 0.25 }), G],
      wires: [w('B:a', 'P:a'), w('B:b', 'P:b'), w('B:b', 'G:a')],
    });
    expect(r.comps.get('B')!.V).toBeCloseTo(8, 9);
    expect(r.potentials[r.netOf.get('P:w')!]).toBeCloseTo(6, 9);
  });
});

describe('digital and behavioural', () => {
  it('logic gates follow their truth tables', () => {
    for (const [kind, table] of [
      ['and', [0, 0, 0, 1]],
      ['nand', [1, 1, 1, 0]],
      ['or', [0, 1, 1, 1]],
      ['nor', [1, 0, 0, 0]],
      ['xor', [0, 1, 1, 0]],
      ['xnor', [1, 0, 0, 1]],
    ] as const) {
      [0, 1, 2, 3].forEach((k) => {
        const r = solveCircuit({
          components: [c('A', 'logicIn', { on: !!(k & 2) }), c('B', 'logicIn', { on: !!(k & 1) }), c('X', kind), c('Y', 'logicOut')],
          wires: [w('A:out', 'X:in1'), w('B:out', 'X:in2'), w('X:out', 'Y:in')],
        });
        expect(r.comps.get('Y')!.logic ? 1 : 0, `${kind} ${k}`).toBe(table[k]);
      });
    }
  });
  it('D flip-flop clocked by toggling a logic input (state persists between solves)', () => {
    const mk = (d: boolean, clk: boolean): CCircuit => ({
      components: [c('D', 'logicIn', { on: d }), c('C', 'logicIn', { on: clk }), c('F', 'dff'), c('Y', 'logicOut')],
      wires: [w('D:out', 'F:d'), w('C:out', 'F:clk'), w('F:q', 'Y:in')],
    });
    let r = solveCircuit(mk(true, false));
    expect(r.comps.get('Y')!.logic).toBe(false);
    r = solveCircuit(mk(true, true), r.states); // rising edge → Q = D = 1
    expect(r.comps.get('Y')!.logic).toBe(true);
    r = solveCircuit(mk(false, true), r.states); // no edge → holds
    expect(r.comps.get('Y')!.logic).toBe(true);
  });
  it('inverter ring oscillator is flagged', () => {
    const r = solveCircuit({
      components: [c('A', 'not'), c('B', 'not'), c('C', 'not')],
      wires: [w('A:out', 'B:in1'), w('B:out', 'C:in1'), w('C:out', 'A:in1')],
    });
    expect(r.oscillating).toBe(true);
  });
  it('relay pulls in above its pull-in current and switches the contact', () => {
    const mk = (V: number): CCircuit => ({
      components: [c('V', 'vsource', { V }), c('K', 'relay', { Rcoil: 400, Ipull: 0.02 }), c('V2', 'vsource', { V: 5 }), c('L', 'resistor', { R: 100 }), G],
      wires: [w('V:a', 'K:c1'), w('K:c2', 'G:a'), w('V2:a', 'K:com'), w('K:no', 'L:a'), w('L:b', 'G:a'), w('V:b', 'G:a'), w('V2:b', 'G:a')],
    });
    expect(Math.abs(solveCircuit(mk(5)).comps.get('L')!.I)).toBeLessThan(1e-9);
    expect(solveCircuit(mk(12)).comps.get('L')!.I).toBeCloseTo(0.05, 3);
  });
  it('fuse blows above its rating', () => {
    const r = solveCircuit({
      components: [c('V', 'vsource', { V: 12 }), c('F', 'fuse', { rating: 1 }), c('R', 'resistor', { R: 5 }), G],
      wires: [w('V:a', 'F:a'), w('F:b', 'R:a'), w('R:b', 'G:a'), w('V:b', 'G:a')],
    });
    expect(r.comps.get('F')!.warn).toBe('blown');
    expect(Math.abs(r.comps.get('R')!.I)).toBeLessThan(1e-6);
  });
});

describe('transient', () => {
  it('RC charging: U_C(τ) ≈ 63 %', () => {
    const tau = 1e-3;
    const r = simulateTransient(
      { components: [c('V', 'vsource', { V: 10 }), c('R', 'resistor', { R: 1000 }), c('C', 'capacitor', { C: 1e-6 }), G], wires: [w('V:a', 'R:a'), w('R:b', 'C:a'), w('C:b', 'G:a'), w('V:b', 'G:a')] },
      5 * tau,
      5000,
    );
    const net = r.netOf.get('C:a')!;
    const k = r.t.findIndex((t) => t >= tau);
    expect(r.nets[net]![k]).toBeCloseTo(6.32, 1);
  });
  it('transformer steps down by the turns ratio', () => {
    const r = simulateTransient(
      {
        components: [c('V', 'acsource', { amp: 10, freq: 50 }), c('T', 'transformer', { L: 10, ratio: 0.5, k: 0.9999 }), c('RL', 'resistor', { R: 10000 }), G, c('G2', 'ground')],
        wires: [w('V:a', 'T:p1'), w('V:b', 'T:p2'), w('V:b', 'G:a'), w('T:s1', 'RL:a'), w('T:s2', 'RL:b'), w('T:s2', 'G2:a')],
      },
      0.06,
      3000,
    );
    const net = r.netOf.get('RL:a')!;
    const peak = Math.max(...r.nets[net]!.slice(1000));
    expect(peak).toBeGreaterThan(4.5);
    expect(peak).toBeLessThan(5.2);
  });
  it('555 astable oscillates near f = 1.44 / ((R1 + 2R2)·C)', () => {
    const R1 = 1000;
    const R2 = 10000;
    const C = 1e-6;
    const r = simulateTransient(
      {
        components: [c('V', 'vsource', { V: 9 }), c('U', 'timer555'), c('R1', 'resistor', { R: R1 }), c('R2', 'resistor', { R: R2 }), c('C', 'capacitor', { C }), c('RL', 'resistor', { R: 10000 }), G],
        wires: [
          w('V:a', 'U:vcc'), w('V:a', 'U:reset'), w('V:b', 'G:a'), w('U:gnd', 'G:a'),
          w('V:a', 'R1:a'), w('R1:b', 'U:dis'), w('R1:b', 'R2:a'), w('R2:b', 'U:thres'), w('R2:b', 'U:trig'), w('R2:b', 'C:a'), w('C:b', 'G:a'),
          w('U:out', 'RL:a'), w('RL:b', 'G:a'),
        ],
      },
      0.1,
      20000,
    );
    const out = r.nets[r.netOf.get('U:out')!]!;
    const times: number[] = [];
    for (let i = 1; i < out.length; i++) if (out[i - 1]! < 3 && out[i]! >= 3) times.push(r.t[i]!);
    const f = (times.length - 2) / (times.at(-1)! - times[1]!);
    expect(f).toBeGreaterThan(55);
    expect(f).toBeLessThan(80); // 1.44/(21k·1µ) = 68.6 Hz
  });
  it('clock drives a T flip-flop: output toggles at half the clock rate', () => {
    const r = simulateTransient(
      {
        components: [c('K', 'clock', { freq: 100 }), c('H', 'logicIn', { on: true }), c('F', 'tff'), c('Y', 'logicOut')],
        wires: [w('K:out', 'F:clk'), w('H:out', 'F:t'), w('F:q', 'Y:in')],
      },
      0.1,
      4000,
    );
    const q = r.logic.get('Y')!;
    let toggles = 0;
    for (let i = 1; i < q.length; i++) if (q[i] !== q[i - 1]) toggles++;
    // 100 Hz for 0.1 s = 10 rising edges = 10 toggles (Q runs at 50 Hz)
    expect(toggles).toBeGreaterThanOrEqual(9);
    expect(toggles).toBeLessThanOrEqual(11);
  });
});
