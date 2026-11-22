/**
 * Exam-style extras for the control-loop page, layered on top of the loop reducer:
 *  - ideal PD / PID controllers K(1 + T_d s), K(1 + 1/(T_i s) + T_d s) without derivative filter,
 *  - a pure dead time (or any b(s)/a(s)·e^{−sTt}) as a "custom" block with T_t.
 * Ideal controllers are handed to the reducer as exact polynomials; dead times of blocks in the
 * main forward/feedback chain are added to F and H afterwards (series → delays add up).
 */

import { reduceLoop, type BlockSpec, type LoopBlock, type LoopSpec } from '@/engine/control/loop';
import { feedback, series, tf, type TF } from '@/engine/control/poly';

/** extra fields the page stores on a block (ignored by the engine) */
export type BlockSpecEx = BlockSpec & { ideal?: boolean };

/** the rational part of a block and the dead time that has to be added separately */
export function splitSpec(s: BlockSpecEx): { spec: BlockSpec; delay: number } {
  const K = s.K ?? 1;
  if (s.ideal && s.kind === 'PD') {
    const Td = s.Td ?? 0.1;
    return { spec: { kind: 'custom', num: [K, K * Td], den: [1] }, delay: 0 };
  }
  if (s.ideal && s.kind === 'PID') {
    const Ti = Math.max(s.Ti ?? 1, 1e-9);
    const Td = s.Td ?? 0.1;
    // K(Ti s + 1 + Ti Td s²)/(Ti s)
    return { spec: { kind: 'custom', num: [K, K * Ti, K * Ti * Td], den: [0, Ti] }, delay: 0 };
  }
  if (s.kind === 'custom' && (s.Tt ?? 0) > 0) return { spec: { ...s, Tt: undefined }, delay: s.Tt! };
  return { spec: s, delay: 0 };
}

const mapBlocks = (bs: LoopBlock[]) => {
  let delay = 0;
  const blocks = bs.map((b) => {
    const main = splitSpec(b.spec);
    delay += main.delay;
    return {
      ...b,
      spec: main.spec,
      parallel: b.parallel ? splitSpec(b.parallel).spec : b.parallel,
      local: b.local ? { ...b.local, spec: splitSpec(b.local.spec).spec } : b.local,
    };
  });
  return { blocks, delay };
};

/** true when a block uses one of the extras (for notices) */
export const usesDelay = (loop: LoopSpec) =>
  [...loop.forward, ...loop.feedback].some((b) => b.spec.kind === 'PTt' || (b.spec.kind === 'custom' && (b.spec.Tt ?? 0) > 0) || b.parallel?.kind === 'PTt' || b.local?.spec.kind === 'PTt');

export function reduceLoopEx(loop: LoopSpec) {
  const f = mapBlocks(loop.forward);
  const h = mapBlocks(loop.feedback);
  const r = reduceLoop({ ...loop, forward: f.blocks, feedback: h.blocks });
  if (!f.delay && !h.delay) return r;
  const F: TF = tf(r.F.num, r.F.den, (r.F.delay ?? 0) + f.delay);
  const H: TF = tf(r.H.num, r.H.den, (r.H.delay ?? 0) + h.delay);
  const L = series(F, H);
  const T = feedback(F, H, loop.sign);
  const S = feedback(tf([1], [1]), L, loop.sign);
  return { ...r, F, H, L, T, S };
}
