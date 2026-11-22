/**
 * Robustness of the solvers against extreme and invalid inputs, as they can be typed into the
 * pages: every numeric field of a valid example is replaced, one at a time, by 0, negative,
 * huge, tiny, NaN and ±Infinity. A solver may then report an error or return NaN/∞ values,
 * but it must never throw and never hang.
 *
 * The control-engineering solvers are called the way the pages call them: through the guards in
 * src/lib/guard.ts and with the ranges the inputs accept (the number fields reject NaN/∞).
 */

import { describe, expect, it } from 'vitest';
import { designFilter } from '@/engine/control/filters';
import { reduceLoop } from '@/engine/control/loop';
import { stepResponse, tf } from '@/engine/control/poly';
import { solveFin, solveWall } from '@/engine/heat/conduction';
import { convection } from '@/engine/heat/convection';
import { solveHX } from '@/engine/heat/exchanger';
import { exchange, shields, viewFactor } from '@/engine/heat/radiation';
import { semiInfinite, seriesTheta } from '@/engine/heat/transient';
import { solveBeam } from '@/engine/mechanics/beam';
import { solveShaft } from '@/engine/mechanics/torsion';
import { solveTruss } from '@/engine/mechanics/truss';
import { runSimulation, sanitizeSpec } from '@/lib/guard';
import { solvePipe } from '@/engine/fluid/pipe';
import { carnot, diesel, joule, otto, rankine } from '@/engine/thermo/cycles';
import { heatCool, humidify, mix, state as airState, xOf } from '@/engine/thermo/humidair';
import { binodal, gasMixture, ucst } from '@/engine/thermo/mixtures';
import { departure, stableZ, SUBSTANCES, vaporPressure } from '@/engine/thermo/realgas';

const EXTREMES = [0, -1, -1e9, 1e12, 1e-12, NaN, Infinity, -Infinity];
/** what a number field can deliver (non-finite input is rejected there) */
const TYPEABLE = [0, -1, -1e9, 1e12, 1e-12];
const LIMIT_MS = 3000;

/** All variants of `base` with one numeric leaf replaced by an extreme value. */
function variants<T>(base: T, values: number[]): { path: string; value: number; spec: T }[] {
  const out: { path: string; value: number; spec: T }[] = [];
  const walk = (node: unknown, path: (string | number)[]) => {
    if (typeof node === 'number') {
      for (const v of values) {
        const spec = structuredClone(base) as Record<string | number, unknown>;
        let o: Record<string | number, unknown> = spec;
        for (const k of path.slice(0, -1)) o = o[k] as Record<string | number, unknown>;
        o[path.at(-1)!] = v;
        out.push({ path: path.join('.'), value: v, spec: spec as T });
      }
    } else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, [...path, Array.isArray(node) ? Number(k) : k]);
  };
  walk(base, []);
  return out;
}

function check<T>(name: string, base: T, run: (s: T) => unknown, values = EXTREMES) {
  it(`${name}: never throws or hangs`, () => {
    const failures: string[] = [];
    for (const v of variants(base, values)) {
      const t0 = performance.now();
      try {
        run(v.spec);
      } catch (e) {
        failures.push(`${v.path} = ${v.value}: throws ${(e as Error).message}`);
        continue;
      }
      const ms = performance.now() - t0;
      if (ms > LIMIT_MS) failures.push(`${v.path} = ${v.value}: ${ms.toFixed(0)} ms`);
    }
    expect(failures).toEqual([]);
  });
}

describe('heat transfer', () => {
  check(
    'plane wall',
    { geometry: 'plane' as const, layers: [{ id: 'a', name: 'a', s: 0.24, lambda: 0.8 }, { id: 'b', name: 'b', s: 0.1, lambda: 0.04 }], A: 1, L: 1, ri: 0, Ti: 20, Ta: -10, alphaI: 8, alphaA: 25 },
    solveWall,
  );
  check('pipe wall', { geometry: 'cylinder' as const, layers: [{ id: 'i', name: 'i', s: 0.05, lambda: 0.05 }], A: 1, L: 2, ri: 0.05, Ti: 150, Ta: 20, alphaI: 0, alphaA: 10 }, solveWall);
  check('sphere wall', { geometry: 'sphere' as const, layers: [{ id: 'i', name: 'i', s: 0.05, lambda: 0.05 }], A: 1, L: 1, ri: 0.1, Ti: 150, Ta: 20, alphaI: 10, alphaA: 10 }, solveWall);
  check('fin', { shape: 'pin' as const, d: 0.005, w: 0, L: 0.05, lambda: 200, alpha: 25, Tb: 100, Tinf: 25, tip: 'adiabatic' as const }, solveFin);
  check('forced convection, plate', { kind: 'plate' as const, fluid: 'air' as const, Tf: 20, Tw: 60, u: 2, L: 0.5, Lpipe: 1, b: 1 }, convection);
  check('forced convection, pipe', { kind: 'pipe' as const, fluid: 'water' as const, Tf: 40, Tw: 60, u: 1.65, L: 0.02, Lpipe: 5, b: 5 }, convection);
  check('heat exchanger', { flow: 'counter' as const, mh: 1, cph: 4180, Th1: 90, mc: 2, cpc: 4180, Tc1: 15, k: 1000, A: 10 }, solveHX);
  check('heat exchanger, cross flow', { flow: 'cross' as const, mh: 1, cph: 4180, Th1: 90, mc: 2, cpc: 4180, Tc1: 15, k: 1000, A: 10 }, solveHX);
  check('radiation exchange', { T1: 600, T2: 300, e1: 0.8, e2: 0.5, ratio: 0.5 }, (s) => exchange('cylinders', s.T1, s.T2, s.e1, s.e2, s.ratio));
  check('radiation shields', { T1: 600, T2: 300, e1: 0.8, e2: 0.8, n: 2, es: 0.1 }, (s) => shields(s.T1, s.T2, s.e1, s.e2, s.n, s.es));
  check('view factor', { a: 1, b: 1, c: 0.5 }, (s) => [viewFactor('disks', s.a, s.b, s.c), viewFactor('parallelRect', s.a, s.b, s.c), viewFactor('perpRect', s.a, s.b, s.c)]);
  check('transient series', { Bi: 1, Fo: 0.5, xi: 0.5 }, (s) => (['plate', 'cylinder', 'sphere'] as const).map((b) => seriesTheta(b, s.Bi, s.Fo, s.xi)));
  check('semi-infinite body', { x: 0.01, t: 100, a: 1e-6, Ti: 20, Tinf: 100, alpha: 50, lambda: 1 }, (s) => semiInfinite(s.x, s.t, s.a, s.Ti, s.Tinf, s.alpha, s.lambda));
});

describe('mechanics', () => {
  check(
    'beam',
    {
      L: 6,
      supports: [{ id: 'A', x: 0, type: 'pinned' as const }, { id: 'B', x: 6, type: 'roller' as const }],
      hinges: [] as number[],
      points: [{ id: 'F', x: 3, F: 10, angle: 90 }],
      moments: [{ id: 'M', x: 2, M: 5 }],
      lines: [{ id: 'q', x1: 0, x2: 6, q1: 2, q2: 4 }],
      EI: 2e4,
      EA: 4e6,
    },
    solveBeam,
  );
  check(
    'truss',
    {
      nodes: [
        { id: 'A', name: 'A', x: 0, y: 0, support: 'pinned' as const, Fx: 0, Fy: 0 },
        { id: 'B', name: 'B', x: 4, y: 0, support: 'rollerX' as const, Fx: 0, Fy: 0 },
        { id: 'C', name: 'C', x: 2, y: 2, support: 'none' as const, Fx: 0, Fy: -10 },
      ],
      bars: [{ id: 'AB', a: 'A', b: 'B' }, { id: 'AC', a: 'A', b: 'C' }, { id: 'BC', a: 'B', b: 'C' }],
      EA: 1e5,
    },
    solveTruss,
  );
  check('shaft', { segments: [{ id: 'a', L: 1, D: 40, d: 10, G: 80 }, { id: 'b', L: 1, D: 30, d: 0, G: 80 }], torques: [0, 1000, -300], rightFixed: true }, solveShaft);
});

describe('control engineering (through the UI guards)', () => {
  // FilterPage and the simulator's filter block limit the order to 1…10
  check(
    'filter design',
    { n: 4, wc: 1000, bw: 200, ripple: 1 },
    (s) => {
      const n = Math.max(1, Math.min(10, Math.round(s.n)));
      return (['butterworth', 'chebyshev', 'bessel'] as const).flatMap((a) => (['lowpass', 'highpass', 'bandpass', 'bandstop'] as const).map((ty) => designFilter(a, ty, Math.min(n, a === 'bessel' ? 6 : 10), s.wc, s.bw, s.ripple)));
    },
    TYPEABLE,
  );
  check('step response', { tEnd: 10, a0: 1, a1: 2, a2: 1, b0: 1 }, (s) => stepResponse(tf([s.b0], [s.a0, s.a1, s.a2]), s.tEnd, 500), TYPEABLE);
  check(
    'loop reduction',
    { K: 2, Ti: 1, Td: 0.2, T: 1, n: 3, Tt: 0.5 },
    (s) =>
      reduceLoop({
        sign: -1,
        feedback: [{ id: 'h', name: 'H', spec: sanitizeSpec({ kind: 'PTt', K: 1, T: s.T, Tt: s.Tt }) }],
        forward: [
          { id: 'c', name: 'R', spec: sanitizeSpec({ kind: 'PID', K: s.K, Ti: s.Ti, Td: s.Td }) },
          { id: 'g', name: 'G', spec: sanitizeSpec({ kind: 'PTn', K: 1, T: s.T, n: s.n }) },
        ],
      }),
    TYPEABLE,
  );
  check(
    'block diagram simulation',
    { K: 2, T: 1, Tt: 0.5, n: 3, fc: 1, amp: 1, tEnd: 10, steps: 500 },
    (s) =>
      runSimulation(
        [
          { id: 'w', data: { kind: 'source', name: 'w', wave: 'step', amp: s.amp } },
          { id: 'e', data: { kind: 'sum', name: 'e', signs: '+-' } },
          { id: 'R', data: { kind: 'gain', name: 'R', K: s.K } },
          { id: 'G', data: { kind: 'tf', name: 'G', spec: { kind: 'PTt', K: 1, T: s.T, Tt: s.Tt } } },
          { id: 'G2', data: { kind: 'tf', name: 'G2', spec: { kind: 'PTn', K: 1, T: s.T, n: s.n } } },
          { id: 'F', data: { kind: 'filter', name: 'F', approx: 'butterworth', ftype: 'lowpass', order: 2, fc: s.fc } },
        ],
        [
          { source: 'w', target: 'e', targetHandle: 'in0' },
          { source: 'e', target: 'R', targetHandle: 'in0' },
          { source: 'R', target: 'G', targetHandle: 'in0' },
          { source: 'G', target: 'G2', targetHandle: 'in0' },
          { source: 'G2', target: 'F', targetHandle: 'in0' },
          { source: 'F', target: 'e', targetHandle: 'in1' },
        ],
        s.tEnd,
        s.steps,
      ),
    EXTREMES,
  );
});

describe('thermodynamics and fluid mechanics', () => {
  check('Carnot', { TL: 300, TH: 900, p1: 100, ds: 0.5, T0: 288 }, carnot);
  check('Joule', { T1: 288, p1: 100, pr: 12, T3: 1400, etaC: 0.86, etaT: 0.9, T0: 288, Tsrc: 2500 }, joule);
  check('Otto', { T1: 300, p1: 100, eps: 10, T3: 2400, T0: 288, Tsrc: 2500 }, otto);
  check('Diesel', { T1: 300, p1: 100, eps: 18, T3: 2200, T0: 288, Tsrc: 2500 }, diesel);
  check('Clausius–Rankine', { pc: 10, pb: 10000, T3: 773.15, etaT: 0.85, etaP: 0.8, T0: 288, Tsrc: 1473 }, rankine);
  check('real gas (PR)', { T: 290, p: 50 }, (s) => {
    const sub = SUBSTANCES[0]!;
    const z = stableZ('pr', sub, s.T, s.p);
    return [departure('pr', sub, s.T, s.p, z.Z), vaporPressure('pr', sub, s.T)];
  });
  check('miscibility gap', { a12: 1000, a21: 1300, T: 400 }, (s) => [binodal(s, s.T), ucst(s)]);
  check('gas mixture', { n1: 1, n2: 2, M: 28, cp: 29, p: 1, T: 300 }, (s) => gasMixture([{ name: 'a', n: s.n1, M: s.M, cp: s.cp }, { name: 'b', n: s.n2, M: 32, cp: 29 }], s.p, s.T));
  check('humid air', { t1: 25, phi: 0.6, t2: 12, p: 101.325, m: 0.3 }, (s) => {
    const a = airState(s.t1, xOf(s.t1, s.phi, s.p), s.p);
    return [heatCool(a, s.t2, s.p), mix(a, airState(s.t2, 0.005, s.p), s.m, 1 - s.m, s.p), humidify(a, 0.9, 15, s.p)];
  });
  check(
    'pipe flow',
    { T: 20, Q: 3, pIn: 1.5, k: 0.05, segments: [{ id: 'a', L: 1, d: 50, dz: 0, zeta: 0, inlet: 'sudden' as const }, { id: 'b', L: 0.2, d: 20, dz: 1, zeta: 0.5, inlet: 'smooth' as const }] },
    (s) => solvePipe({ ...s, fluid: 'water' }),
  );
});
