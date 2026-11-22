import { describe, expect, it } from 'vitest';
import { designFilter, prototypePoles, sallenKey } from '../filters';
import { fft, sample, seriesCoeffs, spectrum, synthesize } from '../fourier';
import { blockTF, reduceLoop } from '../loop';
import { bode, feedback, freq, margins, mul, normalize, roots, routh, series, stepInfo, stepResponse, tf } from '../poly';

describe('polynomials and transfer functions', () => {
  it('multiplies and finds roots', () => {
    expect(mul([1, 1], [2, 1])).toEqual([2, 3, 1]);
    const r = roots([6, -5, 1]); // (s−2)(s−3)
    expect(r.map((z) => z.re).sort()).toEqual([2, 3].map((v) => expect.closeTo(v, 9)) as unknown as number[]);
    const c = roots([1, 0, 1]); // ±j
    expect(Math.abs(c[0]!.im)).toBeCloseTo(1, 9);
  });
  it('closed loop of K/(s(s+1)) and its step response', () => {
    const G = tf([4], [0, 1, 1]);
    const T = normalize(feedback(G, tf([1], [1])));
    expect(T.den).toEqual([4, 1, 1]); // s² + s + 4
    const s = stepResponse(T, 20, 4000);
    const info = stepInfo(s.t, s.y, 1)!;
    // ζ = 0.25 → overshoot e^{−πζ/√(1−ζ²)} = 44.4 %
    expect(info.overshoot).toBeCloseTo(44.4, 0);
    expect(s.y.at(-1)).toBeCloseTo(1, 2);
  });
  it('first-order lag: −3 dB and −45° at ω = 1/T', () => {
    const r = freq(tf([1], [1, 2]), 0.5);
    expect(20 * Math.log10(r.mag)).toBeCloseTo(-3.0103, 3);
    expect((r.phase * 180) / Math.PI).toBeCloseTo(-45, 6);
  });
  it('margins of K/(s(s+1)(s+2))', () => {
    // phase crossover at ω = √2, critical gain 6 → with K = 2 the gain margin is 3 = 9.54 dB
    const L = tf([2], mul([0, 1], mul([1, 1], [2, 1])));
    const m = margins(L);
    expect(m.w180!).toBeCloseTo(Math.SQRT2, 2);
    expect(m.gm!).toBeCloseTo(20 * Math.log10(3), 1);
    expect(m.pm!).toBeGreaterThan(30);
  });
  it('dead time adds phase −ωT exactly', () => {
    const r = freq(tf([1], [1], 0.1), 10);
    expect(r.phase).toBeCloseTo(-1, 9);
  });
  it('Routh: s³ + s² + 2s + 8 has two right-half-plane roots', () => {
    expect(routh([8, 2, 1, 1]).changes).toBe(2);
    expect(routh([6, 11, 6, 1]).changes).toBe(0);
  });
  it('bode phase starts at −90° for an integrator', () => {
    expect(bode(tf([1], [0, 1]), 0.1, 10, 10)[0]!.deg).toBeCloseTo(-90, 6);
  });
});

describe('control loop reduction', () => {
  it('PI controller with PT1 plant: zero steady-state error, steps recorded', () => {
    const r = reduceLoop({
      forward: [
        { id: 'c', name: 'C', spec: { kind: 'PI', K: 2, Ti: 1 } },
        { id: 'g', name: 'G', spec: { kind: 'PT1', K: 1, T: 1 } },
      ],
      feedback: [],
      sign: -1,
    });
    expect(r.steps.map((s) => s.rule)).toEqual(['series', 'open', 'closed']);
    const s = stepResponse(r.T, 30, 3000);
    expect(s.y.at(-1)).toBeCloseTo(1, 3);
  });
  it('local feedback and parallel branch rules', () => {
    const r = reduceLoop({
      forward: [{ id: 'g', name: 'G', spec: { kind: 'I', K: 1 }, local: { spec: { kind: 'P', K: 1 }, sign: -1 }, parallel: { kind: 'P', K: 1 } }],
      feedback: [],
      sign: -1,
    });
    expect(r.steps.map((s) => s.rule)).toEqual(['parallel', 'feedback', 'open', 'closed']);
  });
  it('PID transfer function at low and high frequency', () => {
    const C = blockTF({ kind: 'PID', K: 2, Ti: 1, Td: 0.5 });
    expect(freq(C, 1e-4).mag).toBeCloseTo(2 / 1e-4, -1); // integral dominates
    expect(freq(C, 1e4).mag).toBeCloseTo(2 * (1 + 0.5 / 0.05), 0); // D limited by the filter
  });
});

describe('filters', () => {
  it('Butterworth: −3 dB at the cut-off for every order', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const d = designFilter('butterworth', 'lowpass', n, 1000, 0);
      expect(20 * Math.log10(freq(d.tf, 1000).mag)).toBeCloseTo(-3.0103, 2);
      expect(freq(d.tf, 1).mag).toBeCloseTo(1, 6);
    }
  });
  it('high-pass and band-pass shapes', () => {
    const hp = designFilter('butterworth', 'highpass', 3, 100, 0);
    expect(freq(hp.tf, 1e5).mag).toBeCloseTo(1, 4);
    expect(20 * Math.log10(freq(hp.tf, 100).mag)).toBeCloseTo(-3.01, 1);
    const bp = designFilter('butterworth', 'bandpass', 2, 1000, 200);
    expect(freq(bp.tf, 1000).mag).toBeCloseTo(1, 4);
    expect(freq(bp.tf, 10).mag).toBeLessThan(0.01);
  });
  it('Chebyshev ripple and Bessel −3 dB', () => {
    const ch = designFilter('chebyshev', 'lowpass', 4, 1, 0, 1);
    expect(20 * Math.log10(freq(ch.tf, 1).mag)).toBeCloseTo(-1, 1);
    const be = designFilter('bessel', 'lowpass', 4, 1, 0);
    expect(20 * Math.log10(freq(be.tf, 1).mag)).toBeCloseTo(-3, 0);
    expect(prototypePoles('butterworth', 4).length).toBe(2);
  });
  it('Sallen–Key low-pass reproduces ω0 and Q', () => {
    const w0 = 2 * Math.PI * 1000;
    const Q = 0.7071;
    const v = sallenKey('lowpass', w0, Q);
    const w = 1 / Math.sqrt(v.R1 * v.R2! * v.C1 * v.C2!);
    const q = Math.sqrt(v.R1 * v.R2! * v.C1 * v.C2!) / (v.C2! * (v.R1 + v.R2!));
    expect(w).toBeCloseTo(w0, 6);
    expect(q).toBeCloseTo(Q, 6);
  });
});

describe('Fourier', () => {
  it('square wave: odd harmonics 4A/(πk); synthesis approaches the wave', () => {
    const c = seriesCoeffs({ wave: 'square', f: 1, amp: 1 }, 9);
    expect(c.b[1]).toBeCloseTo(4 / Math.PI, 12);
    expect(c.b[2]).toBe(0);
    const y = synthesize(seriesCoeffs({ wave: 'square', f: 1, amp: 1 }, 199), 1, [0.25], 199)[0]!;
    expect(y).toBeCloseTo(1, 1);
  });
  it('FFT finds the amplitude of a sine', () => {
    const N = 1024;
    const fs = 1024;
    const t = Array.from({ length: N }, (_, i) => i / fs);
    const sp = spectrum(sample({ wave: 'sine', f: 64, amp: 3 }, t), fs, 'rect');
    expect(sp[64]!.amp).toBeCloseTo(3, 6);
    const re = [1, 0, 0, 0];
    const im = [0, 0, 0, 0];
    fft(re, im);
    expect(re).toEqual([1, 1, 1, 1]);
  });
  it('series of a series loop step', () => {
    expect(series(tf([1], [1, 1]), tf([2], [1])).num).toEqual([2]);
  });
});
