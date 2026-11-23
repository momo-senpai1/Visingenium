import { describe, expect, it } from 'vitest';
import { incline, principal, profile, reduceForces, ropeRatio, section, togglePress } from '@/engine/mechanics/statics';
import { bucklingMode, cantileverEnergy, cantileverInfluence, channelShearCentre, euler, iBeamShear, mohr, rotateStress, solveBar, thinWalledTorsion } from '@/engine/mechanics/elasto';
import { ellipseMotion, impact, magnification, oscParams, rolling, simulate, sliderCrank } from '@/engine/mechanics/dynamics';

describe('statics', () => {
  it('reduces a couple to a pure moment', () => {
    const r = reduceForces([
      { x: 0, y: 0, F: 10, angle: 90 },
      { x: 2, y: 0, F: 10, angle: 270 },
    ]);
    expect(r.R).toBeCloseTo(0);
    expect(r.M).toBeCloseTo(-20);
    expect(r.line).toBeNull();
  });
  it('places the resultant on its line of action', () => {
    const r = reduceForces([
      { x: 1, y: 0, F: 10, angle: 90 },
      { x: 3, y: 0, F: 10, angle: 90 },
    ]);
    expect(r.R).toBeCloseTo(20);
    expect(r.M).toBeCloseTo(40);
    expect(r.line!.x).toBeCloseTo(2);
  });
  it('friction on an incline: rest, self-locking and sliding', () => {
    const rest = incline({ m: 10, alpha: 20, mu0: 0.5, mu: 0.4, F: 0 });
    expect(rest.state).toBe('rest');
    expect(rest.selfLocking).toBe(true);
    const slide = incline({ m: 10, alpha: 40, mu0: 0.5, mu: 0.4, F: 0 });
    expect(slide.state).toBe('down');
    expect(slide.a).toBeCloseTo(-9.81 * (Math.sin(40 * Math.PI / 180) - 0.4 * Math.cos(40 * Math.PI / 180)), 6);
    const up = incline({ m: 10, alpha: 20, mu0: 0.5, mu: 0.4, F: 200 });
    expect(up.state).toBe('up');
    expect(up.a).toBeGreaterThan(0);
  });
  it('rope friction ratio', () => {
    expect(ropeRatio(0.3, 180)).toBeCloseTo(Math.exp(0.3 * Math.PI));
  });
  it('rectangle and I-section second moments', () => {
    const r = section(profile('rect', 20, 60, 5))!;
    expect(r.Iy).toBeCloseTo((20 * 60 ** 3) / 12);
    expect(r.Iyz).toBeCloseTo(0);
    const i = section(profile('I', 100, 200, 10))!;
    expect(i.zS).toBeCloseTo(100);
    const expected = (100 * 200 ** 3) / 12 - (90 * 180 ** 3) / 12;
    expect(i.Iy).toBeCloseTo(expected, 3);
  });
  it('L-section has a product moment and rotated principal axes', () => {
    const l = section(profile('L', 60, 100, 10))!;
    expect(Math.abs(l.Iyz)).toBeGreaterThan(0);
    expect(l.I1 + l.I2).toBeCloseTo(l.Iy + l.Iz);
    const p = principal(l.Iy, l.Iz, l.Iyz);
    expect(p.I1).toBeGreaterThanOrEqual(p.I2);
  });
  it('box section equals the outer minus the inner rectangle', () => {
    const b = section(profile('box', 100, 100, 10))!;
    expect(b.A).toBeCloseTo(100 * 100 - 80 * 80);
    expect(b.Iy).toBeCloseTo((100 ** 4 - 80 ** 4) / 12);
  });
  it('toggle press by virtual work agrees with equilibrium', () => {
    const { H } = togglePress(1000, 10, 0.3);
    // each bar carries S = F/(2 sin α), horizontal component S cos α
    expect(H).toBeCloseTo((1000 / (2 * Math.sin(10 * Math.PI / 180))) * Math.cos(10 * Math.PI / 180));
  });
});

describe('strength of materials', () => {
  it("Mohr's circle: invariants and principal directions", () => {
    const p = { sx: 80, sz: -20, txz: 40 };
    const m = mohr(p);
    expect(m.s1 + m.s2).toBeCloseTo(60);
    const r = rotateStress(p, m.phi);
    expect(r.s1).toBeCloseTo(m.s1);
    expect(r.t).toBeCloseTo(0);
  });
  it('bar: free thermal expansion and clamped thermal stress', () => {
    const seg = { l: 1000, A: 100, E: 200, alpha: 12 };
    const free = solveBar({ segs: [seg, seg], F: 0, dT: 50, rightWall: false, gap: 0 })!;
    expect(free.u2).toBeCloseTo(12e-6 * 50 * 2000);
    const clamped = solveBar({ segs: [seg, seg], F: 0, dT: 50, rightWall: true, gap: 0 })!;
    expect(clamped.sigma[0]).toBeCloseTo(-200e3 * 12e-6 * 50);
    expect(clamped.u2).toBeCloseTo(0);
  });
  it('bar: load shared by both segments when clamped', () => {
    const seg = { l: 500, A: 100, E: 200, alpha: 0 };
    const r = solveBar({ segs: [seg, seg], F: 10, dT: 0, rightWall: true, gap: 0 })!;
    expect(r.N[0]).toBeCloseTo(5);
    expect(r.N[1]).toBeCloseTo(-5);
  });
  it('closed tube is far stiffer in torsion than the slit one', () => {
    const r = thinWalledTorsion(100, 50, 3, 1e6, 80e3);
    expect(r.tauClosed).toBeCloseTo(1e6 / (2 * 5000 * 3));
    expect(r.thetaOpen / r.thetaClosed).toBeGreaterThan(100);
  });
  it('I-beam shear: web maximum and channel shear centre', () => {
    const s = iBeamShear(100, 10, 200, 6, 50e3);
    expect(s.tauMaxWeb).toBeGreaterThan(s.web(100));
    expect(s.web(100)).toBeCloseTo((s.flange(50) * 2 * 10) / 6);
    expect(channelShearCentre(50, 100)).toBeCloseTo(7500 / 400);
  });
  it("Castigliano and Maxwell's reciprocity", () => {
    const EI = 2e11;
    const { f } = cantileverEnergy(1000, 2000, EI);
    expect(f).toBeCloseTo((1000 * 2000 ** 3) / (3 * EI));
    expect(cantileverInfluence(800, 1500, EI)).toBeCloseTo(cantileverInfluence(1500, 800, EI));
  });
  it('Euler buckling cases', () => {
    const r2 = euler(2, 1000, 210e3, 1e4, 100, 200);
    expect(r2.Fk).toBeCloseTo((Math.PI ** 2 * 210e3 * 1e4) / 1e6);
    expect(euler(4, 1000, 210e3, 1e4, 100, 200).Fk / r2.Fk).toBeCloseTo(4);
    for (const c of [1, 2, 3, 4] as const) {
      expect(Math.abs(bucklingMode(c, 0))).toBeLessThan(1e-9);
      let mx = 0;
      for (let k = 0; k <= 100; k++) mx = Math.max(mx, Math.abs(bucklingMode(c, k / 100)));
      expect(mx).toBeCloseTo(1, 2);
    }
    expect(Math.abs(bucklingMode(3, 1))).toBeLessThan(1e-3);
  });
});

describe('dynamics', () => {
  it('circle: no tangential acceleration, a_n = v²/r', () => {
    const k = ellipseMotion(2, 2, 3, 0.4);
    expect(k.at).toBeCloseTo(0);
    expect(k.an).toBeCloseTo((k.v * k.v) / 2);
    expect(k.rho).toBeCloseTo(2);
  });
  it('slider-crank: instantaneous centre matches differentiation', () => {
    const s = sliderCrank(0.1, 0.35, 60, 10);
    expect(s.vBic).toBeCloseTo(Math.abs(s.vB), 6);
    const h = 1e-4;
    const x = (p: number) => sliderCrank(0.1, 0.35, p, 10).B.x;
    const num = ((x(60 + h) - x(60 - h)) / (2 * h)) * (180 / Math.PI) * 10;
    expect(s.vB).toBeCloseTo(num, 4);
  });
  it('rolling: cylinder vs ring, slipping on a steep slope', () => {
    expect(rolling('cylinder', 30, 0.5, 0.4).a).toBeCloseTo((9.81 * 0.5) / 1.5);
    expect(rolling('ring', 30, 0.5, 0.4).a).toBeCloseTo((9.81 * 0.5) / 2);
    expect(rolling('ring', 70, 0.2, 0.15).rolls).toBe(false);
  });
  it('impact conserves momentum; e = 0 is fully plastic', () => {
    const r = impact(2, 3, 1, -1, 0.6);
    expect(2 * r.u1 + r.u2).toBeCloseTo(2 * 3 - 1);
    expect(r.u2 - r.u1).toBeCloseTo(0.6 * 4);
    const p = impact(2, 3, 1, -1, 0);
    expect(p.u1).toBeCloseTo(p.u2);
    expect(impact(1, 2, 1, 0, 1).loss).toBeCloseTo(0);
  });
  it('oscillator parameters, magnification and simulation', () => {
    const o = { m: 2, c: 800, d: 8 };
    const p = oscParams(o);
    expect(p.w0).toBeCloseTo(20);
    expect(p.D).toBeCloseTo(0.1);
    expect(magnification(1, 0.1).V).toBeCloseTo(5);
    expect(magnification(1, 0.1).psi).toBeCloseTo(90);
    const free = simulate({ m: 1, c: 1, d: 0 }, 1, 0, 0, 0, 2 * Math.PI, 2000);
    expect(free.at(-1)!.x).toBeCloseTo(1, 5);
  });
});
