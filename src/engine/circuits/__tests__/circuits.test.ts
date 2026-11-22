import { describe, expect, it } from 'vitest';
import { solveCircuit, type CCircuit, type CComponent } from '../solver';
import { formatSI, parseSI } from '../units';

const comp = (id: string, kind: CComponent['kind'], params: CComponent['params'] = {}): CComponent => ({ id, kind, name: id, params });
const w = (a: string, b: string, i = 0) => ({ id: `w${a}${b}${i}`, a, b });

describe('SI units', () => {
  it('parses engineering notation', () => {
    expect(parseSI('4k7')).toBeCloseTo(4700);
    expect(parseSI('4,7 kΩ')).toBeCloseTo(4700);
    expect(parseSI('10m')).toBeCloseTo(0.01);
    expect(parseSI('2.2µ')).toBeCloseTo(2.2e-6);
    expect(parseSI('1M')).toBe(1e6);
    expect(parseSI('abc')).toBeNull();
  });
  it('formats with prefixes', () => {
    expect(formatSI(0.0123, 'A')).toBe('12.3 mA');
    expect(formatSI(4700, 'Ω')).toBe('4.7 kΩ');
    expect(formatSI(-1.5, 'W')).toBe('-1.5 W');
  });
});

describe('DC solver', () => {
  it('voltage divider: Kirchhoff and Ohm', () => {
    const c: CCircuit = {
      components: [comp('V1', 'vsource', { V: 12 }), comp('R1', 'resistor', { R: 1000 }), comp('R2', 'resistor', { R: 2000 }), comp('G', 'ground')],
      wires: [w('V1:a', 'R1:a'), w('R1:b', 'R2:a'), w('R2:b', 'V1:b'), w('V1:b', 'G:a')],
    };
    const r = solveCircuit(c);
    expect(r.ok).toBe(true);
    expect(r.comps.get('R2')!.V).toBeCloseTo(8, 9);
    expect(r.comps.get('R1')!.I).toBeCloseTo(0.004, 9);
    expect(r.comps.get('V1')!.P).toBeCloseTo(-0.048, 9); // delivers 48 mW
    expect(Math.abs(r.powerBalance)).toBeLessThan(1e-9);
    expect(r.kclResidual).toBeLessThan(1e-9);
  });
  it('LED with series resistor runs near its nominal current', () => {
    const c: CCircuit = {
      components: [comp('V1', 'vsource', { V: 9 }), comp('R1', 'resistor', { R: 360 }), comp('D1', 'led', { Vf: 2, Inom: 0.02, color: 'red' }), comp('G', 'ground')],
      wires: [w('V1:a', 'R1:a'), w('R1:b', 'D1:a'), w('D1:b', 'V1:b'), w('V1:b', 'G:a')],
    };
    const r = solveCircuit(c);
    const d = r.comps.get('D1')!;
    expect(r.ok).toBe(true);
    expect(d.I).toBeGreaterThan(0.018);
    expect(d.I).toBeLessThan(0.0205);
    expect(d.V).toBeGreaterThan(1.9);
    expect(r.kclResidual).toBeLessThan(1e-9);
  });
  it('reverse diode blocks', () => {
    const c: CCircuit = {
      components: [comp('V1', 'vsource', { V: 5 }), comp('R1', 'resistor', { R: 1000 }), comp('D1', 'diode'), comp('G', 'ground')],
      wires: [w('V1:a', 'R1:a'), w('R1:b', 'D1:b'), w('D1:a', 'V1:b'), w('V1:b', 'G:a')],
    };
    const r = solveCircuit(c);
    expect(Math.abs(r.comps.get('D1')!.I)).toBeLessThan(1e-8);
    expect(r.comps.get('D1')!.V).toBeCloseTo(-5, 4);
  });
  it('silicon diode forward drop ≈ 0.6–0.75 V at a few mA', () => {
    const c: CCircuit = {
      components: [comp('V1', 'vsource', { V: 5 }), comp('R1', 'resistor', { R: 1000 }), comp('D1', 'diode'), comp('G', 'ground')],
      wires: [w('V1:a', 'R1:a'), w('R1:b', 'D1:a'), w('D1:b', 'V1:b'), w('V1:b', 'G:a')],
    };
    const v = solveCircuit(c).comps.get('D1')!.V;
    expect(v).toBeGreaterThan(0.6);
    expect(v).toBeLessThan(0.75);
  });
  it('current source, ammeter, open switch, lamp', () => {
    const c: CCircuit = {
      components: [
        comp('I1', 'isource', { I: 0.5 }),
        comp('A1', 'ammeter'),
        comp('L1', 'lamp', { Vnom: 12, Pnom: 6 }),
        comp('S1', 'switch', { closed: false }),
        comp('R9', 'resistor', { R: 1 }),
        comp('G', 'ground'),
      ],
      wires: [w('I1:a', 'A1:a'), w('A1:b', 'L1:a'), w('L1:b', 'I1:b'), w('I1:b', 'G:a'), w('A1:b', 'S1:a'), w('S1:b', 'R9:a'), w('R9:b', 'G:a')],
    };
    const r = solveCircuit(c);
    expect(r.comps.get('A1')!.I).toBeCloseTo(0.5, 9);
    expect(r.comps.get('L1')!.V).toBeCloseTo(12, 6); // 0.5 A · 24 Ω
    expect(r.comps.get('L1')!.level).toBeCloseTo(1, 6);
    expect(r.comps.get('R9')!.I).toBeCloseTo(0, 9);
  });
  it('Wheatstone bridge balanced: no current in the bridge', () => {
    const c: CCircuit = {
      components: [
        comp('V', 'vsource', { V: 10 }),
        comp('R1', 'resistor', { R: 100 }),
        comp('R2', 'resistor', { R: 200 }),
        comp('R3', 'resistor', { R: 150 }),
        comp('R4', 'resistor', { R: 300 }),
        comp('R5', 'resistor', { R: 50 }),
        comp('G', 'ground'),
      ],
      wires: [w('V:a', 'R1:a'), w('V:a', 'R3:a'), w('R1:b', 'R2:a'), w('R3:b', 'R4:a'), w('R2:b', 'V:b'), w('R4:b', 'V:b'), w('R1:b', 'R5:a'), w('R5:b', 'R3:b'), w('V:b', 'G:a')],
    };
    expect(Math.abs(solveCircuit(c).comps.get('R5')!.I)).toBeLessThan(1e-12);
  });
  it('reports a loop of ideal voltage sources as singular', () => {
    const c: CCircuit = {
      components: [comp('V1', 'vsource', { V: 5 }), comp('V2', 'vsource', { V: 3 }), comp('G', 'ground')],
      wires: [w('V1:a', 'V2:a'), w('V1:b', 'V2:b'), w('V1:b', 'G:a')],
    };
    expect(solveCircuit(c).error).toBe('singular');
  });
  it('flags floating parts', () => {
    const c: CCircuit = {
      components: [comp('V1', 'vsource', { V: 5 }), comp('R1', 'resistor', { R: 10 }), comp('R2', 'resistor', { R: 10 }), comp('G', 'ground')],
      wires: [w('V1:a', 'R1:a'), w('R1:b', 'V1:b'), w('V1:b', 'G:a')],
    };
    const r = solveCircuit(c);
    expect(r.floating.length).toBe(2); // both pins of R2
  });
});
