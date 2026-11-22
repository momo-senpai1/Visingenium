import { describe, expect, it } from 'vitest';
import { freq } from '../poly';
import { filterTF, linearTF, openLoopTF, simulate, type SimBlock, type SimWire } from '../blocksim';

const loop = (ctrl: SimBlock['data'], plant: SimBlock['data']): { b: SimBlock[]; w: SimWire[] } => ({
  b: [
    { id: 'w', data: { kind: 'source', name: 'w', wave: 'step', amp: 1 } },
    { id: 's', data: { kind: 'sum', name: 'e', signs: '+-' } },
    { id: 'c', data: ctrl },
    { id: 'g', data: plant },
    { id: 'sc', data: { kind: 'scope', name: 'Scope', inputs: 2 } },
  ],
  w: [
    { source: 'w', target: 's', targetHandle: 'in0' },
    { source: 'g', target: 's', targetHandle: 'in1' },
    { source: 's', target: 'c', targetHandle: 'in0' },
    { source: 'c', target: 'g', targetHandle: 'in0' },
    { source: 'g', target: 'sc', targetHandle: 'in0' },
    { source: 'w', target: 'sc', targetHandle: 'in1' },
  ],
});

describe('block diagram simulator', () => {
  it('P controller + PT1: y = 0.8 (1 − e^{−5t})', () => {
    const { b, w } = loop({ kind: 'gain', name: 'R', K: 4 }, { kind: 'tf', name: 'G', spec: { kind: 'PT1', K: 1, T: 1 } });
    const r = simulate(b, w, 2, 2000);
    const y = r.y.get('g')!;
    expect(y[200]!).toBeCloseTo(0.8 * (1 - Math.exp(-1)), 2);
    expect(y.at(-1)!).toBeCloseTo(0.8, 3);
    expect(r.scopes[0]!.traces.map((t) => t.name)).toEqual(['G', 'w']);
    const lin = linearTF(b, w, 'w', 'g');
    expect(lin.ok).toBe(true);
    expect(lin.T!.num[0]! / lin.T!.den[0]!).toBeCloseTo(0.8, 6);
    expect(lin.T!.den.length).toBe(2);
    expect(lin.T!.den[0]!).toBeCloseTo(5, 6);
  });
  it('PI + PT1 removes the steady-state error and matches the closed loop poles', () => {
    const { b, w } = loop({ kind: 'tf', name: 'R', spec: { kind: 'PI', K: 2, Ti: 1 } }, { kind: 'tf', name: 'G', spec: { kind: 'PT1', K: 1, T: 1 } });
    const r = simulate(b, w, 10, 2000);
    expect(r.y.get('g')!.at(-1)!).toBeCloseTo(1, 3);
    const lin = linearTF(b, w, 'w', 'g');
    // PI zero cancels the PT1 pole: T = 2/(s + 2)
    expect(lin.T!.den.length).toBe(2);
    expect(lin.T!.den[0]!).toBeCloseTo(2, 4);
  });
  it('dead time shifts the response', () => {
    const b: SimBlock[] = [
      { id: 'u', data: { kind: 'source', name: 'u', wave: 'step' } },
      { id: 'g', data: { kind: 'tf', name: 'G', spec: { kind: 'PTt', K: 1, T: 1, Tt: 1 } } },
    ];
    const r = simulate(b, [{ source: 'u', target: 'g', targetHandle: 'in0' }], 3, 3000);
    const y = r.y.get('g')!;
    expect(y[900]!).toBeCloseTo(0, 6);
    expect(y[2000]!).toBeCloseTo(1 - Math.exp(-1), 2);
  });
  it('solves an algebraic loop exactly, with saturation', () => {
    const b: SimBlock[] = [
      { id: 'u', data: { kind: 'source', name: 'u', wave: 'step', amp: 1 } },
      { id: 's', data: { kind: 'sum', name: 'e', signs: '+-' } },
      { id: 'k', data: { kind: 'gain', name: 'K', K: 3 } },
      { id: 'q', data: { kind: 'sat', name: 'S', lo: -0.5, hi: 0.5 } },
    ];
    const w: SimWire[] = [
      { source: 'u', target: 's', targetHandle: 'in0' },
      { source: 'k', target: 's', targetHandle: 'in1' },
      { source: 's', target: 'k', targetHandle: 'in0' },
      { source: 'k', target: 'q', targetHandle: 'in0' },
    ];
    const r = simulate(b, w, 1, 10);
    expect(r.y.get('k')!.at(-1)!).toBeCloseTo(0.75, 9);
    expect(r.y.get('q')!.at(-1)!).toBeCloseTo(0.5, 9);
    expect(r.warnings.some((x) => /Algebraic/.test(x.key))).toBe(true);
  });
  it('unstable loop is reported', () => {
    const { b, w } = loop({ kind: 'gain', name: 'R', K: 20 }, { kind: 'tf', name: 'G', spec: { kind: 'PTn', K: 1, T: 1, n: 3 } });
    const lin = linearTF(b, w, 'w', 'g');
    expect(lin.T!.den.length).toBe(4);
    const r = simulate(b, w, 200, 4000);
    expect(r.warnings.some((x) => /unstable/.test(x.key)) || Math.abs(r.y.get('g')!.at(-1)!) > 1e6).toBe(true);
  });
  it('disturbance input: transfer function to the output', () => {
    const { b, w } = loop({ kind: 'gain', name: 'R', K: 4 }, { kind: 'tf', name: 'G', spec: { kind: 'PT1', K: 1, T: 1 } });
    // disturbance added at the plant input
    b.push({ id: 'z', data: { kind: 'source', name: 'z', wave: 'step' } }, { id: 's2', data: { kind: 'sum', name: 'u', signs: '++' } });
    const w2 = w.filter((x) => !(x.source === 'c' && x.target === 'g'));
    w2.push({ source: 'c', target: 's2', targetHandle: 'in0' }, { source: 'z', target: 's2', targetHandle: 'in1' }, { source: 's2', target: 'g', targetHandle: 'in0' });
    const lin = linearTF(b, w2, 'z', 'g');
    expect(lin.T!.num[0]! / lin.T!.den[0]!).toBeCloseTo(0.2, 6);
  });
  it('open loop cut at the summing point', () => {
    const { b, w } = loop({ kind: 'gain', name: 'R', K: 4 }, { kind: 'tf', name: 'G', spec: { kind: 'PT1', K: 1, T: 1 } });
    const L = openLoopTF(b, w, 's');
    expect(L.ok).toBe(true);
    expect(L.T!.num[0]! / L.T!.den[0]!).toBeCloseTo(4, 6);
    expect(L.T!.den.length).toBe(2);
  });
  it('filter block: Butterworth low-pass −3 dB at f_c, simulated step settles at 1', () => {
    const d = { kind: 'filter' as const, name: 'F', approx: 'butterworth' as const, ftype: 'lowpass' as const, order: 4, fc: 2 };
    expect(20 * Math.log10(freq(filterTF(d), 2 * Math.PI * 2).mag)).toBeCloseTo(-3.01, 1);
    const r = simulate([{ id: 'u', data: { kind: 'source', name: 'u', wave: 'step' } }, { id: 'f', data: d }], [{ source: 'u', target: 'f', targetHandle: 'in0' }], 5, 2000);
    expect(r.y.get('f')!.at(-1)!).toBeCloseTo(1, 3);
  });
});
