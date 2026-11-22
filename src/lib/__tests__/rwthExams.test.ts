/**
 * Cross-check of the control engine against old RWTH "Regelungstechnik" exams (Aufgabe 2,
 * frequency domain). Each case rebuilds the exam's transfer function and compares the engine's
 * Bode/margin results with the hand solution worked out from the task text.
 */

import { describe, expect, it } from 'vitest';
import { bode, freq, margins, mul, tf, type TF } from '@/engine/control/poly';

const deg = (r: number) => (r * 180) / Math.PI;
const series = (...g: TF[]) => g.reduce((a, b) => tf(mul(a.num, b.num), mul(a.den, b.den), (a.delay ?? 0) + (b.delay ?? 0)));
/** PT2 in the exam form ω0² / ((jω)² + 2Dω0 jω + ω0²), coefficients in ascending powers */
const pt2 = (K: number, D: number, w0: number) => tf([K * w0 * w0], [w0 * w0, 2 * D * w0, 1]);

describe('RWTH RT exams, Aufgabe 2', () => {
  it('F22: PI controller from the Nyquist plot, maximum dead time from the asymptotes', () => {
    // GS = 5/(1+5jω)·e^{−Tt jω}, GR = 1 + 1/(jω) read from the Ortskurve (Re = 1, −j at ω = 1)
    const G0 = series(tf([5], [1, 5]), tf([1, 1], [0, 1]));
    expect(freq(tf([1, 1], [0, 1]), 1).im).toBeCloseTo(-1, 12); // GR(j·1) = 1 − j
    // asymptotes: 5/ω → 1/ω² (0.2 < ω < 1) → 1/ω; |G0| = 1 at ω_d = 1
    const phi = -90 - deg(Math.atan(5)) + deg(Math.atan(1));
    const TtMaxAsym = ((180 + phi) * Math.PI) / 180 / 1;
    expect(TtMaxAsym).toBeCloseTo(0.983, 2);
    // exact curve: the engine's margins give a slightly higher ω_d and thus a smaller Tt,max
    const m = margins(G0);
    expect(m.wc!).toBeGreaterThan(1);
    const TtMax = (m.pm! * Math.PI) / 180 / m.wc!;
    expect(TtMax).toBeLessThan(TtMaxAsym);
    // with that dead time the loop sits exactly on the stability limit
    const atLimit = margins(tf(G0.num, G0.den, TtMax));
    expect(Math.abs(atLimit.pm!)).toBeLessThan(0.5);
  });

  it('H21: integrator with all-pass — P gain for α_R = 45° and Ziegler–Nichols', () => {
    // GS = 2/(jω) · (1 − 2jω)/(1 + 2jω); φ = −90° − 2·arctan(2ω)
    const GS = series(tf([2], [0, 1]), tf([1, -2], [1, 2]));
    expect(freq(GS, 0.3).mag).toBeCloseTo(2 / 0.3, 9); // all-pass: magnitude 1
    // α_R = 45° → 2·arctan(2ω) = 45° → ω_d = tan(22.5°)/2, K = ω_d/2
    const wd = Math.tan(Math.PI / 8) / 2;
    const K45 = wd / 2;
    const m = margins(series(tf([K45], [1]), GS));
    expect(m.pm!).toBeCloseTo(45, 1);
    expect(m.wc!).toBeCloseTo(wd, 3);
    // critical gain: φ = −180° at ω = 0.5 → |GS| = 4 → K_krit = 0.25, T_krit = 4π; ZN: K = 0.5·K_krit
    const mk = margins(GS);
    expect(mk.w180!).toBeCloseTo(0.5, 3);
    const Kkrit = 10 ** (mk.gm! / 20);
    expect(Kkrit).toBeCloseTo(0.25, 3);
    expect(0.5 * Kkrit).toBeCloseTo(0.125, 3);
  });

  it('H23: parameters from the asymptotes and K for α_R = 75°', () => {
    // GR = 0.2(1 + 1/(2jω)); G0′ asymptote 10 at ω = 0.05 → 0.1·KS/ω → KS = 5; flat 1 → ω0 = 2
    const GR = tf([0.2, 0.4], [0, 2]);
    const KS = 5;
    expect((0.2 * KS) / (2 * 0.05)).toBeCloseTo(10, 12);
    // real curve passes ≈ 0.5 at ω0 = 2 → 1.03/(2D) = 0.5 → D ≈ 1
    const D = Math.hypot(1, 4) / 4 / (2 * 0.5);
    expect(D).toBeCloseTo(1.03, 2);
    const G0 = series(GR, pt2(KS, D, 2));
    expect(freq(G0, 2).mag).toBeCloseTo(0.5, 2);
    // K so that α_R = 75°: find ω with φ0′ = −105°, then K = 1/|G0′|
    const pts = bode(G0, 0.01, 100, 4000);
    const p = pts.find((q, i) => i > 0 && pts[i - 1]!.deg > -105 && q.deg <= -105)!;
    const K = 1 / 10 ** (p.db / 20);
    const m = margins(series(tf([K], [1]), G0));
    expect(m.pm!).toBeCloseTo(75, 0);
  });

  it('F23: PT2 parameters from two measured sine responses', () => {
    // ω1 ≪ ω0: amplitude 2 → 4, so K = 2; at ω2 = ω0 the phase is −90° and the gain K/(2D) = 10/2 = 5
    const K = 4 / 2;
    const D = K / (2 * (10 / 2));
    expect(D).toBeCloseTo(0.2, 12);
    const r = freq(pt2(K, D, 1), 1);
    expect(r.mag).toBeCloseTo(5, 9);
    expect(deg(r.phase)).toBeCloseTo(-90, 9);
  });

  it('H25: PD controller lifting the phase by 63.4° at ω_d = 3, and the cost of sampling', () => {
    // arctan(Tv·ω_d) = 63.4° → Tv = tan(63.4°)/3 ≈ 2/3 s
    const Tv = Math.tan((63.4 * Math.PI) / 180) / 3;
    expect(Tv).toBeCloseTo(0.667, 2);
    expect(deg(freq(tf([1, Tv], [1]), 3).phase)).toBeCloseTo(63.4, 6);
    // quasi-continuous: zero-order hold ≈ dead time T/2; phase loss ω_d·T/2 with T = 0.1 s
    const loss = deg(3 * 0.05);
    expect(loss).toBeCloseTo(8.6, 1);
    expect(55 - loss).toBeGreaterThan(30); // α_R ≈ 46° remains: still stable
  });

  it('all-pass and dead time: magnitude 1, phase falls without limit', () => {
    const ap = tf([1, -0.5], [1, 0.5]);
    for (const w of [0.1, 1, 10]) expect(freq(ap, w).mag).toBeCloseTo(1, 12);
    expect(deg(freq(ap, 2).phase)).toBeCloseTo(-2 * deg(Math.atan(1)), 9);
    expect(deg(freq(tf([1], [1], 0.5), 1).phase)).toBeCloseTo(-deg(0.5), 9);
  });
});
