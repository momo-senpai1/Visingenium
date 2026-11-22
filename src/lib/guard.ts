/**
 * Guards between the user interface and the engine (the engine itself stays unchanged):
 * input ranges the pages accept, and solver calls that report an error instead of crashing.
 */

import { simulate, type SimBlock, type SimResult, type SimWire } from '@/engine/control/blocksim';
import type { BlockSpec } from '@/engine/control/loop';

const clamp = (v: number | undefined, lo: number, hi: number, fallback: number) => (v === undefined || !Number.isFinite(v) ? fallback : Math.min(hi, Math.max(lo, v)));

/** Ranges for controller/plant parameters: integer order 1…20, dead time up to 10⁴ s, finite values. */
export function sanitizeSpec(s: BlockSpec): BlockSpec {
  const o: BlockSpec = { ...s };
  for (const k of ['K', 'T', 'Ti', 'Td', 'Tf', 'zeta', 'alpha'] as const) if (o[k] !== undefined) o[k] = clamp(o[k], -1e9, 1e9, 1);
  if (o.n !== undefined) o.n = Math.round(clamp(o.n, 1, 20, 1));
  if (o.Tt !== undefined) o.Tt = clamp(o.Tt, 0, 1e4, 0);
  if (o.num) o.num = o.num.filter(Number.isFinite).slice(0, 21);
  if (o.den) o.den = o.den.filter(Number.isFinite).slice(0, 21);
  return o;
}

/** Run a calculation; on an exception return `fallback(message)` instead of crashing the page. */
export function attempt<T>(fn: () => T, fallback: (msg: string) => T): T {
  try {
    return fn();
  } catch (e) {
    return fallback(String((e as Error)?.message ?? e));
  }
}

/** Block-diagram simulation with the ranges the simulator page accepts. */
export function runSimulation(blocks: SimBlock[], wires: SimWire[], tEnd: number, steps: number): SimResult {
  const T = clamp(tEnd, 1e-3, 1e7, 20);
  const n = Math.round(clamp(steps, 100, 20000, 2000));
  const safe = blocks.map((b) => (b.data.kind === 'tf' && b.data.spec ? { ...b, data: { ...b.data, spec: sanitizeSpec(b.data.spec) } } : b));
  // a dead time longer than ~10⁶ simulation steps would need a delay buffer of that size
  const tooLong = safe.find((b) => b.data.kind === 'tf' && (b.data.spec?.Tt ?? 0) / (T / n) > 1e6);
  if (tooLong) return { t: [], y: new Map(), scopes: [], ok: false, warnings: [{ key: '{name}: the dead time is far longer than the simulation step allows; shorten it or the simulation time.', vars: { name: tooLong.data.name } }] };
  return attempt(
    () => simulate(safe, wires, T, n),
    (msg) => ({ t: [], y: new Map(), scopes: [], ok: false, warnings: [{ key: 'The simulation failed: {msg}', vars: { msg } }] }),
  );
}
