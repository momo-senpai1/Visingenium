/**
 * Cross-check of the control engine against hand calculations in the frequency domain.
 * Each case builds a transfer function and compares the engine's Bode/margin results with
 * the analytic solution.
 */

import { describe, expect, it } from 'vitest';
import { bode, freq, margins, mul, tf, type TF } from '@/engine/control/poly';

const deg = (r: number) => (r * 180) / Math.PI;
const series = (...g: TF[]) => g.reduce((a, b) => tf(mul(a.num, b.num), mul(a.den, b.den), (a.delay ?? 0) + (b.delay ?? 0)));
/** PT2 in the standard form ω0² / ((jω)² + 2Dω0 jω + ω0²), coefficients in ascending powers */
const pt2 = (K: number, D: number, w0: number) => tf([K * w0 * w0], [w0 * w0, 2 * D * w0, 1]);

describe('control engine vs. hand calculations (frequency domain)', () => {
  it('PI controller read from the Nyquist plot, maximum dead time from the asymptotes', () => {
    // GS = 4/(1+4jω)·e^{−Tt jω}, GR = 1 + 1/(jω) read from the Ortskurve (Re = 1, −j at ω = 1)
    const G0 = series(tf([4], [1, 4]), tf([1, 1], [0, 1]));
    expect(freq(tf([1, 1], [0, 1]), 1).im).toBeCloseTo(-1, 12); // GR(j·1) = 1 − j
    // asymptotes: 4/ω → 1/ω² (0.25 < ω < 1) → 1/ω; |G0| = 1 at ω_d = 1
    const phi = -90 - deg(Math.atan(4)) + deg(Math.atan(1));
    const TtMaxAsym = ((180 + phi) * Math.PI) / 180 / 1;
    expect(TtMaxAsym).toBeCloseTo(1.03, 2);
    // exact curve: the engine's margins give a slightly higher ω_d and thus a smaller Tt,max
    const m = margins(G0);
    expect(m.wc!).toBeGreaterThan(1);
    const TtMax = (m.pm! * Math.PI) / 180 / m.wc!;
    expect(TtMax).toBeLessThan(TtMaxAsym);
    // with that dead time the loop sits exactly on the stability limit
    const atLimit = margins(tf(G0.num, G0.den, TtMax));
    expect(Math.abs(atLimit.pm!)).toBeLessThan(0.5);
  });

  it('integrator with all-pass — P gain for α_R = 45° and Ziegler–Nichols', () => {
    // GS = 3/(jω) · (1 − 2jω)/(1 + 2jω); φ = −90° − 2·arctan(2ω)
    const GS = series(tf([3], [0, 1]), tf([1, -2], [1, 2]));
    expect(freq(GS, 0.3).mag).toBeCloseTo(3 / 0.3, 9); // all-pass: magnitude 1
    // α_R = 45° → 2·arctan(2ω) = 45° → ω_d = tan(22.5°)/2, K = ω_d/3
    const wd = Math.tan(Math.PI / 8) / 2;
    const K45 = wd / 3;
    const m = margins(series(tf([K45], [1]), GS));
    expect(m.pm!).toBeCloseTo(45, 1);
    expect(m.wc!).toBeCloseTo(wd, 3);
    // critical gain: φ = −180° at ω = 0.5 → |GS| = 6 → K_krit = 1/6, T_krit = 4π; ZN: K = 0.5·K_krit
    const mk = margins(GS);
    expect(mk.w180!).toBeCloseTo(0.5, 3);
    const Kkrit = 10 ** (mk.gm! / 20);
    expect(Kkrit).toBeCloseTo(1 / 6, 3);
    expect(0.5 * Kkrit).toBeCloseTo(1 / 12, 3);
  });

  it('parameters from the asymptotes and K for α_R = 75°', () => {
    // GR = 0.25(1 + 1/(2jω)); G0′ asymptote 10 at ω = 0.05 → 0.125·KS/ω → KS = 4; flat 1 → ω0 = 2.5
    const GR = tf([0.25, 0.5], [0, 2]);
    const KS = 4;
    expect((0.25 * KS) / (2 * 0.05)).toBeCloseTo(10, 12);
    // real curve passes ≈ 0.5 at ω0 = 2.5 → |GR(jω0)|·KS/(2D) = 0.5 → D = |1 − 0.2j| ≈ 1.02
    const D = Math.hypot(1, 0.2) / (2 * 0.5);
    expect(D).toBeCloseTo(1.02, 2);
    const G0 = series(GR, pt2(KS, D, 2.5));
    expect(freq(G0, 2.5).mag).toBeCloseTo(0.5, 2);
    // K so that α_R = 75°: find ω with φ0′ = −105°, then K = 1/|G0′|
    const pts = bode(G0, 0.01, 100, 4000);
    const p = pts.find((q, i) => i > 0 && pts[i - 1]!.deg > -105 && q.deg <= -105)!;
    const K = 1 / 10 ** (p.db / 20);
    const m = margins(series(tf([K], [1]), G0));
    expect(m.pm!).toBeCloseTo(75, 0);
  });

  it('PT2 parameters from two measured sine responses', () => {
    // ω1 ≪ ω0: amplitude 2 → 5, so K = 2.5; at ω2 = ω0 the phase is −90° and the gain K/(2D) = 16/2 = 8
    const K = 5 / 2;
    const D = K / (2 * (16 / 2));
    expect(D).toBeCloseTo(0.15625, 12);
    const r = freq(pt2(K, D, 1.2), 1.2);
    expect(r.mag).toBeCloseTo(8, 9);
    expect(deg(r.phase)).toBeCloseTo(-90, 9);
  });

  it('PD controller lifting the phase by 60° at ω_d = 4, and the cost of sampling', () => {
    // arctan(Tv·ω_d) = 60° → Tv = tan(60°)/4 ≈ 0.433 s
    const Tv = Math.tan((60 * Math.PI) / 180) / 4;
    expect(Tv).toBeCloseTo(0.433, 2);
    expect(deg(freq(tf([1, Tv], [1]), 4).phase)).toBeCloseTo(60, 6);
    // quasi-continuous: zero-order hold ≈ dead time T/2; phase loss ω_d·T/2 with T = 0.1 s
    const loss = deg(4 * 0.05);
    expect(loss).toBeCloseTo(11.5, 1);
    expect(55 - loss).toBeGreaterThan(30); // α_R ≈ 43° remains: still stable
  });

  it('all-pass and dead time: magnitude 1, phase falls without limit', () => {
    const ap = tf([1, -0.5], [1, 0.5]);
    for (const w of [0.1, 1, 10]) expect(freq(ap, w).mag).toBeCloseTo(1, 12);
    expect(deg(freq(ap, 2).phase)).toBeCloseTo(-2 * deg(Math.atan(1)), 9);
    expect(deg(freq(tf([1], [1], 0.5), 1).phase)).toBeCloseTo(-deg(0.5), 9);
  });
});
