import { describe, expect, it } from 'vitest';
import { feedback, roots, tf } from '@/engine/control/poly';
import { nyquist } from '../nyquist';

const rhpClosed = (L: ReturnType<typeof tf>) => roots(feedback(L, tf([1], [1])).den).filter((p) => p.re > 1e-9).length;

describe('full Nyquist criterion', () => {
  it('stable PT3 loop: no encirclement', () => {
    const L = tf([2], [1, 3, 3, 1]); // 2/(s+1)³
    const r = nyquist(L);
    expect(r).toMatchObject({ P: 0, N: 0, Z: 0, stable: true });
  });
  it('PT3 with too much gain: two clockwise encirclements', () => {
    const L = tf([20], [1, 3, 3, 1]);
    const r = nyquist(L);
    expect(r.N).toBe(2);
    expect(r.Z).toBe(rhpClosed(L));
  });
  it('unstable plant stabilised by feedback: one counter-clockwise encirclement', () => {
    const L = tf([3], [-1, 1]); // 3/(s − 1)
    const r = nyquist(L);
    expect(r.P).toBe(1);
    expect(r.N).toBe(-1);
    expect(r.Z).toBe(0);
    expect(rhpClosed(L)).toBe(0);
  });
  it('unstable plant with too little gain stays unstable', () => {
    const L = tf([0.5], [-1, 1]);
    expect(nyquist(L).Z).toBe(1);
  });
  it('double integrator with lead: poles at the origin are bypassed', () => {
    const L = tf([1, 2], [0, 0, 1, 0.1]); // (1+2s)/(s²(1+0.1s))
    const r = nyquist(L);
    expect(r.atOrigin).toBe(2);
    expect(r.Z).toBe(rhpClosed(L));
    expect(r.stable).toBe(true);
  });
  it('double integrator without lead is unstable', () => {
    const L = tf([1], [0, 0, 1, 0.5]);
    const r = nyquist(L);
    expect(r.Z).toBe(rhpClosed(L));
    expect(r.Z).toBeGreaterThan(0);
  });
  it('dead time: stable below, unstable above the limit', () => {
    // L = e^{−sT}/s: phase margin 90° at ω = 1 → T_max = π/2
    expect(nyquist(tf([1], [0, 1], 1.4)).stable).toBe(true);
    expect(nyquist(tf([1], [0, 1], 1.7)).stable).toBe(false);
  });
});
