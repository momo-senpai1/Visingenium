import { describe, expect, it } from 'vitest';
import { solveShaft, torqueFromPower } from '../torsion';
import { solveTruss, type TNode } from '../truss';

const node = (id: string, x: number, y: number, support: TNode['support'] = 'none', Fx = 0, Fy = 0): TNode => ({ id, name: id, x, y, support, Fx, Fy });

describe('truss', () => {
  it('symmetric triangle: classic member forces', () => {
    // span 4 m, height 2 m (45° diagonals), 10 kN down at the apex
    const r = solveTruss({
      nodes: [node('A', 0, 0, 'pinned'), node('B', 4, 0, 'rollerX'), node('C', 2, 2, 'none', 0, -10)],
      bars: [{ id: 'AB', a: 'A', b: 'B' }, { id: 'AC', a: 'A', b: 'C' }, { id: 'BC', a: 'B', b: 'C' }],
      EA: 1e5,
    });
    expect(r.ok).toBe(true);
    expect(r.degree).toBe(0);
    expect(r.N.get('AC')).toBeCloseTo(-5 * Math.SQRT2, 6); // compression
    expect(r.N.get('AB')).toBeCloseTo(5, 6); // tension
    expect(r.R.get('A')!.Ry).toBeCloseTo(5, 6);
    expect(r.R.get('B')!.Ry).toBeCloseTo(5, 6);
    expect(r.R.get('A')!.Rx).toBeCloseTo(0, 9);
  });
  it('detects zero-force members and mechanisms', () => {
    const square = solveTruss({
      nodes: [node('A', 0, 0, 'pinned'), node('B', 2, 0, 'rollerX'), node('C', 2, 2), node('D', 0, 2, 'none', 5, 0)],
      bars: [{ id: 'AB', a: 'A', b: 'B' }, { id: 'BC', a: 'B', b: 'C' }, { id: 'CD', a: 'C', b: 'D' }, { id: 'DA', a: 'D', b: 'A' }],
      EA: 1e5,
    });
    expect(square.error).toBe('mechanism');
    const braced = solveTruss({
      nodes: [node('A', 0, 0, 'pinned'), node('B', 2, 0, 'rollerX'), node('C', 2, 2), node('D', 0, 2, 'none', 5, 0)],
      bars: [{ id: 'AB', a: 'A', b: 'B' }, { id: 'BC', a: 'B', b: 'C' }, { id: 'CD', a: 'C', b: 'D' }, { id: 'DA', a: 'D', b: 'A' }, { id: 'AC', a: 'A', b: 'C' }],
      EA: 1e5,
    });
    expect(braced.ok).toBe(true);
    expect(braced.R.get('A')!.Rx).toBeCloseTo(-5, 9);
    expect(braced.R.get('A')!.Ry + braced.R.get('B')!.Ry).toBeCloseTo(0, 9);
  });
});

describe('torsion', () => {
  it('cantilever shaft: τ = T/Wt, φ = TL/(G·Ip)', () => {
    const r = solveShaft({ segments: [{ id: 's', L: 1, D: 40, d: 0, G: 80 }], torques: [0, 500], rightFixed: false });
    const Ip = (Math.PI * 40 ** 4) / 32;
    expect(r.TA).toBeCloseTo(-500, 9);
    expect(r.segs[0]!.T).toBeCloseTo(500, 9);
    expect(r.segs[0]!.tau).toBeCloseTo((500e3 * 20) / Ip, 6);
    expect(r.rot[1]).toBeCloseTo((500e3 * 1000) / (80e3 * Ip), 9);
  });
  it('shaft clamped at both ends: torque splits by stiffness', () => {
    // equal segments, torque in the middle → each end takes half
    const r = solveShaft({ segments: [{ id: 'a', L: 1, D: 40, d: 0, G: 80 }, { id: 'b', L: 1, D: 40, d: 0, G: 80 }], torques: [0, 1000, 0], rightFixed: true });
    expect(r.TA).toBeCloseTo(-500, 6);
    expect(r.TB).toBeCloseTo(-500, 6);
    expect(r.rot[2]).toBeCloseTo(0, 12);
  });
  it('torque from power', () => {
    expect(torqueFromPower(15, 1450)).toBeCloseTo(98.79, 2);
  });
});
