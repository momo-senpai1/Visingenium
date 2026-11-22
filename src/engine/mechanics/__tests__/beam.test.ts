import { describe, expect, it } from 'vitest';
import { sectionProps, solveBeam, type BeamModel } from '../beam';

const base = (over: Partial<BeamModel>): BeamModel => ({ L: 6, supports: [], hinges: [], points: [], moments: [], lines: [], EI: 2e4, EA: 4e6, ...over });
const at = (r: ReturnType<typeof solveBeam>, arr: number[], x: number) => {
  let k = 0;
  for (let i = 1; i < r.x.length; i++) if (Math.abs(r.x[i]! - x) < Math.abs(r.x[k]! - x)) k = i;
  return arr[k]!;
};

describe('beam statics', () => {
  it('simply supported, central point load: F/2 reactions, M = FL/4, w = FL³/48EI', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }], points: [{ id: 'F', x: 3, F: 10, angle: 90 }] }));
    expect(r.ok).toBe(true);
    expect(r.degree).toBe(0);
    expect(r.reactions.map((x) => x.Fz)).toEqual([-5, -5]);
    expect(r.max.M.v).toBeCloseTo(15, 6);
    expect(r.max.w.v).toBeCloseTo((10 * 6 ** 3) / (48 * 2e4), 9);
    expect(Math.abs(r.check.Fz) + Math.abs(r.check.M0)).toBeLessThan(1e-8);
  });
  it('cantilever with tip load: M_A = −F·L, Q = F', () => {
    const r = solveBeam(base({ L: 2, supports: [{ id: 'A', x: 0, type: 'fixed' }], points: [{ id: 'F', x: 2, F: 4, angle: 90 }] }));
    const A = r.reactions[0]!;
    expect(A.Fz).toBeCloseTo(-4, 9);
    expect(A.M).toBeCloseTo(8, 9); // counter-clockwise reaction holds the downward tip load
    expect(r.M[0]).toBeCloseTo(-8, 9); // hogging
    expect(r.Q[0]).toBeCloseTo(4, 9);
    expect(r.max.w.v).toBeCloseTo((4 * 8) / (3 * 2e4), 9);
  });
  it('uniform load on a simple beam: qL²/8 and 5qL⁴/384EI', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }], lines: [{ id: 'q', x1: 0, x2: 6, q1: 2, q2: 2 }] }));
    expect(r.max.M.v).toBeCloseTo((2 * 36) / 8, 4);
    expect(r.max.w.v).toBeCloseTo((5 * 2 * 6 ** 4) / (384 * 2e4), 7);
  });
  it('fixed–fixed beam under uniform load (indeterminate): end moments −qL²/12', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'fixed' }, { id: 'B', x: 6, type: 'fixed' }], lines: [{ id: 'q', x1: 0, x2: 6, q1: 2, q2: 2 }] }));
    expect(r.degree).toBe(3);
    expect(r.M[0]).toBeCloseTo(-(2 * 36) / 12, 5);
    expect(at(r, r.M, 3)).toBeCloseTo((2 * 36) / 24, 5);
  });
  it('triangular load: resultant qL/2 at 2L/3', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }], lines: [{ id: 'q', x1: 0, x2: 6, q1: 0, q2: 3 }] }));
    expect(r.reactions[0]!.Fz).toBeCloseTo(-3, 8);
    expect(r.reactions[1]!.Fz).toBeCloseTo(-6, 8);
  });
  it('inclined force gives a horizontal reaction at the pinned support; N in the beam', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }], points: [{ id: 'F', x: 2, F: 10, angle: 30 }] }));
    expect(r.reactions[0]!.Fx).toBeCloseTo(-10 * Math.cos(Math.PI / 6), 8);
    expect(at(r, r.N, 1)).toBeCloseTo(10 * Math.cos(Math.PI / 6), 8);
  });
  it('Gerber beam: hinge carries no moment', () => {
    const r = solveBeam(base({ L: 8, supports: [{ id: 'A', x: 0, type: 'fixed' }, { id: 'B', x: 8, type: 'roller' }], hinges: [4], lines: [{ id: 'q', x1: 0, x2: 8, q1: 1, q2: 1 }] }));
    expect(r.degree).toBe(0);
    expect(Math.abs(at(r, r.M, 4))).toBeLessThan(1e-6);
    expect(r.reactions[1]!.Fz).toBeCloseTo(-2, 6);
  });
  it('point moment on a simple beam', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'pinned' }, { id: 'B', x: 6, type: 'roller' }], moments: [{ id: 'M', x: 2, M: 12 }] }));
    expect(r.reactions[0]!.Fz).toBeCloseTo(-2, 8); // A_z = M/L upward... sign: pair with B
    expect(r.reactions[1]!.Fz).toBeCloseTo(2, 8);
  });
  it('detects a mechanism', () => {
    const r = solveBeam(base({ supports: [{ id: 'A', x: 0, type: 'roller' }, { id: 'B', x: 6, type: 'roller' }], points: [{ id: 'F', x: 3, F: 10, angle: 45 }] }));
    expect(r.error).toBe('mechanism');
  });
  it('section properties', () => {
    expect(sectionProps({ kind: 'rect', b: 100, h: 200 }).W).toBeCloseTo((100 * 200 ** 2) / 6);
    expect(sectionProps({ kind: 'circle', d: 50 }).I).toBeCloseTo((Math.PI * 50 ** 4) / 64);
  });
});
