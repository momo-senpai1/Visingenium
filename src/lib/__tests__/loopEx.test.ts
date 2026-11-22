import { describe, expect, it } from 'vitest';
import { freq, margins } from '@/engine/control/poly';
import { reduceLoopEx, splitSpec } from '../loopEx';
import { nyquist } from '../nyquist';

describe('exam extras for the control loop', () => {
  it('ideal PD: phase lift arctan(Tv ω) without filter', () => {
    const { spec } = splitSpec({ kind: 'PD', K: 2, Td: 2 / 3, ideal: true });
    const r = reduceLoopEx({ sign: -1, feedback: [], forward: [{ id: 'c', name: 'R', spec }] });
    const f = freq(r.L, 3);
    expect((f.phase * 180) / Math.PI).toBeCloseTo(63.43, 1);
    expect(f.mag).toBeCloseTo(2 * Math.hypot(1, 2), 9);
  });
  it('ideal PID: K(1 + 1/(Ti s) + Td s)', () => {
    const r = reduceLoopEx({ sign: -1, feedback: [], forward: [{ id: 'c', name: 'R', spec: { kind: 'PID', K: 2, Ti: 5, Td: 0.5, ideal: true } as never }] });
    const f = freq(r.L, 1);
    // 2(1 + 1/(5j) + 0.5j) = 2 + j(1 − 0.4)
    expect(f.re).toBeCloseTo(2, 9);
    expect(f.im).toBeCloseTo(0.6, 9);
  });
  it('pure dead time block adds to the loop (F22 setting)', () => {
    const loop = {
      sign: -1 as const,
      feedback: [],
      forward: [
        { id: 'c', name: 'R', spec: { kind: 'PI' as const, K: 1, Ti: 1 } },
        { id: 'g', name: 'G', spec: { kind: 'PT1' as const, K: 5, T: 5 } },
        { id: 'd', name: 'Tt', spec: { kind: 'custom' as const, num: [1], den: [1], Tt: 0.5 } },
      ],
    };
    const r = reduceLoopEx(loop);
    expect(r.L.delay).toBeCloseTo(0.5, 12);
    const m0 = margins(reduceLoopEx({ ...loop, forward: loop.forward.slice(0, 2) }).L);
    const m = margins(r.L);
    expect(m.pm!).toBeCloseTo(m0.pm! - (0.5 * m0.wc! * 180) / Math.PI, 0);
    expect(nyquist(r.L).stable).toBe(true);
  });
});
