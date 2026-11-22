import { describe, expect, it } from 'vitest';
import { acPower, bjtStage, bridge, cabs, carg, cx, deg, diodeOP, divider, firstOrder, kloss, motorOP, ohmNetwork, rectifier, seriesRLC, threePhase, transformer } from '../ee';

describe('DC', () => {
  it('Kirchhoff holds in the series–parallel network', () => {
    const r = ohmNetwork(12, 100, 200, 300);
    expect(r.I1).toBeCloseTo(r.I2 + r.I3, 12); // node rule
    expect(r.U1 + r.U23).toBeCloseTo(12, 12); // mesh rule
    expect(r.P).toBeCloseTo(r.P1 + r.P2 + r.P3, 10); // energy
  });
  it('loading a divider pulls its output down', () => {
    const a = divider(10, 1000, 1000, null);
    expect(a.U2).toBeCloseTo(5, 12);
    expect(divider(10, 1000, 1000, 1000).U2).toBeCloseTo(10 / 3, 12);
  });
  it('a balanced bridge carries no galvanometer current', () => {
    const b = bridge(10, 100, 200, 300, 600, 50);
    expect(b.balanced).toBe(true);
    expect(Math.abs(b.Ig)).toBeLessThan(1e-12);
  });
});

describe('transients', () => {
  it('RC reaches 63 % after τ, RL current likewise', () => {
    const rc = firstOrder('rc', 1000, 1e-6, 10, true, 1e-3);
    expect(rc.tau).toBeCloseTo(1e-3, 12);
    expect(rc.u / 10).toBeCloseTo(1 - Math.exp(-1), 12);
    const rl = firstOrder('rl', 10, 0.1, 10, true, 0.01);
    expect(rl.i).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(rl.u + rl.uR).toBeCloseTo(10, 12); // mesh rule at any time
  });
});

describe('AC', () => {
  it('series RLC at resonance is purely resistive', () => {
    const L = 0.1;
    const C = 1e-6;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const r = seriesRLC(10, L, C, 1, f0);
    expect(r.f0).toBeCloseTo(f0, 9);
    expect(r.phi).toBeCloseTo(0, 9);
    expect(cabs(r.I)).toBeCloseTo(0.1, 9);
    expect(cabs(r.UL) / 1).toBeCloseTo(r.Q, 6); // voltage rise Q·U
  });
  it('power triangle and compensation', () => {
    const p = acPower(230, 10, Math.acos(0.7), 50, 1);
    expect(p.S ** 2).toBeCloseTo(p.P ** 2 + p.Q ** 2, 6);
    expect(p.Qc).toBeCloseTo(p.Q, 6);
    expect(p.Iafter).toBeCloseTo(7, 6);
  });
  it('symmetric star load: neutral current zero, line voltage √3', () => {
    const Z = cx(10, 5);
    const r = threePhase(230, 'star-n', [Z, Z, Z]);
    expect(cabs(r.IN)).toBeLessThan(1e-9);
    const d = threePhase(230, 'delta', [Z, Z, Z]);
    expect(cabs(d.Uload[0]!)).toBeCloseTo(230 * Math.sqrt(3), 6);
    expect(cabs(d.Iline[0]!) / cabs(d.Iph[0]!)).toBeCloseTo(Math.sqrt(3), 6);
    expect(deg(carg(d.Uload[0]!))).toBeCloseTo(30, 6);
  });
  it('unsymmetric star without neutral shifts the star point', () => {
    const r = threePhase(230, 'star', [cx(10), cx(20), cx(40)]);
    expect(cabs(r.shift)).toBeGreaterThan(1);
    const sum = r.Iph.reduce((a, i) => ({ re: a.re + i.re, im: a.im + i.im }), cx(0));
    expect(cabs(sum)).toBeLessThan(1e-9);
  });
  it('transformer ratios', () => {
    const t = transformer(230, 1000, 100, 2.3, 50, 10);
    expect(t.U2).toBeCloseTo(23, 9);
    expect(t.I1load).toBeCloseTo(1, 9);
    expect(t.Rin).toBeCloseTo(230, 9);
  });
});

describe('electronics and machines', () => {
  it('silicon diode sits near 0.6–0.8 V', () => {
    const d = diodeOP(5, 1000);
    expect(d.Ud).toBeGreaterThan(0.5);
    expect(d.Ud).toBeLessThan(0.9);
    expect(d.I * 1000 + d.Ud).toBeCloseTo(5, 6);
  });
  it('rectifier ripple matches I/(fC)', () => {
    const r = rectifier('bridge', 15, 50, 2200e-6, 100, 0.7, 6, 6000);
    expect(r.ripple).toBeGreaterThan(0.5 * r.est);
    expect(r.ripple).toBeLessThan(1.3 * r.est);
    const h = rectifier('half', 10, 50, 0, 100);
    expect(Math.min(...h.pts.map((p) => p.uo))).toBe(0);
  });
  it('transistor stage: cut-off, active, saturation', () => {
    expect(bjtStage(12, 1000, 100e3, 0.5, 150).region).toBe('cutoff');
    const a = bjtStage(12, 1000, 470e3, 2, 150);
    expect(a.region).toBe('active');
    expect(a.Ic).toBeCloseTo(150 * a.Ib, 1);
    expect(bjtStage(12, 1000, 10e3, 5, 150).region).toBe('saturation');
  });
  it('Kloss curve peaks at the breakdown slip; operating point on the stable branch', () => {
    expect(kloss(0.2, 0.2, 50)).toBeCloseTo(50, 12);
    const op = motorOP(20, 0.2, 50, 50, 2);
    expect(op.ns).toBe(1500);
    expect(op.s!).toBeLessThan(0.2);
    expect(kloss(op.s!, 0.2, 50)).toBeCloseTo(20, 6);
    expect(motorOP(60, 0.2, 50, 50, 2).s).toBeNull();
  });
});
