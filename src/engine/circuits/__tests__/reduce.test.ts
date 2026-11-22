import { describe, expect, it } from 'vitest';
import { lampR, type CComponent } from '../devices';
import { reduceNetwork } from '../reduce';
import { acSweep, solveCircuit, type CCircuit } from '../solver';

const c = (id: string, kind: CComponent['kind'], params: CComponent['params'] = {}): CComponent => ({ id, kind, name: id, params });
let n = 0;
const w = (a: string, b: string) => ({ id: `w${n++}`, a, b });
const val = (cmp: CComponent) => (cmp.kind === 'lamp' ? lampR(cmp.params) : cmp.params.R ?? 1000);

describe('network reduction', () => {
  it('(R1 ∥ R2) + R3 seen by the source, step by step', () => {
    const circ: CCircuit = {
      components: [c('U1', 'vsource', { V: 12 }), c('R1', 'resistor', { R: 1000 }), c('R2', 'resistor', { R: 1000 }), c('R3', 'resistor', { R: 1000 }), c('G', 'ground')],
      wires: [w('U1:a', 'R1:a'), w('U1:a', 'R2:a'), w('R1:b', 'R3:a'), w('R2:b', 'R3:a'), w('R3:b', 'U1:b'), w('U1:b', 'G:a')],
    };
    const dc = solveCircuit(circ);
    const others = { ...circ, components: circ.components.filter((x) => x.id !== 'U1') };
    const r = reduceNetwork(others, dc.netOf, dc.netOf.get('U1:a')!, dc.netOf.get('U1:b')!, 0, val);
    expect(r.ok).toBe(true);
    expect(r.Z!.re).toBeCloseTo(1500, 9);
    expect(r.steps.map((s) => s.kind)).toEqual(['parallel', 'series']);
    expect(r.check!.re).toBeCloseTo(1500, 6);
  });
  it('unbalanced bridge needs a star–delta step', () => {
    const circ: CCircuit = {
      components: [c('R1', 'resistor', { R: 100 }), c('R2', 'resistor', { R: 200 }), c('R3', 'resistor', { R: 300 }), c('R4', 'resistor', { R: 400 }), c('R5', 'resistor', { R: 500 }), c('G', 'ground')],
      wires: [w('R1:a', 'R3:a'), w('R1:b', 'R2:a'), w('R3:b', 'R4:a'), w('R2:b', 'R4:b'), w('R1:b', 'R5:a'), w('R5:b', 'R3:b'), w('R4:b', 'G:a')],
    };
    const dc = solveCircuit(circ);
    const r = reduceNetwork(circ, dc.netOf, dc.netOf.get('R1:a')!, dc.netOf.get('R4:b')!, 0, val);
    expect(r.steps.some((s) => s.kind === 'stardelta')).toBe(true);
    expect(r.Z!.re).toBeCloseTo(r.check!.re, 6);
  });
  it('RC impedance at a frequency', () => {
    const circ: CCircuit = { components: [c('R1', 'resistor', { R: 1000 }), c('C1', 'capacitor', { C: 1e-6 }), c('G', 'ground')], wires: [w('R1:b', 'C1:a'), w('C1:b', 'G:a')] };
    const dc = solveCircuit(circ);
    const f = 1000 / (2 * Math.PI); // ω = 1000 → X_C = 1000 Ω
    const r = reduceNetwork(circ, dc.netOf, dc.netOf.get('R1:a')!, dc.netOf.get('C1:b')!, f, val);
    expect(r.Z!.re).toBeCloseTo(1000, 6);
    expect(r.Z!.im).toBeCloseTo(-1000, 6);
  });
});

describe('AC analysis', () => {
  it('RC low-pass: −3 dB at f_c = 1/(2πRC)', () => {
    const circ: CCircuit = {
      components: [c('U1', 'acsource', { amp: 1, freq: 50 }), c('R1', 'resistor', { R: 1000 }), c('C1', 'capacitor', { C: 1e-6 }), c('G', 'ground')],
      wires: [w('U1:a', 'R1:a'), w('R1:b', 'C1:a'), w('C1:b', 'U1:b'), w('U1:b', 'G:a')],
    };
    const fc = 1 / (2 * Math.PI * 1000 * 1e-6);
    const r = acSweep(circ, 'U1', fc, fc, 1);
    const net = r.nets[r.netOf.get('C1:a')!]!;
    expect(20 * Math.log10(Math.hypot(net.re[0]!, net.im[0]!))).toBeCloseTo(-3.0103, 3);
  });
  it('inverting op-amp: gain −10 in the AC sweep', () => {
    const circ: CCircuit = {
      components: [c('U1', 'acsource', { amp: 1 }), c('R1', 'resistor', { R: 1000 }), c('R2', 'resistor', { R: 10000 }), c('OP', 'opamp'), c('G', 'ground')],
      wires: [w('U1:a', 'R1:a'), w('R1:b', 'OP:inn'), w('R2:a', 'OP:inn'), w('R2:b', 'OP:out'), w('OP:inp', 'G:a'), w('U1:b', 'G:a')],
    };
    const r = acSweep(circ, 'U1', 100, 100, 1);
    expect(r.nets[r.netOf.get('OP:out')!]!.re[0]).toBeCloseTo(-10, 2);
  });
});
