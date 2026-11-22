/**
 * Validation of sheets loaded from files or local storage: a broken or manipulated file must not
 * be able to put the stores into a state that crashes the page.
 */

import { z } from 'zod';
import { DEVICES } from '@/engine/circuits/devices';

const num = z.number().finite();
const id = z.string().min(1).max(200);
const name = z.string().max(200);
const pos = z.object({ x: num, y: num });
/** numbers limited to a sane range (orders, counts) */
const small = (lo: number, hi: number) => num.min(lo).max(hi);

// ---------------------------------------------------------------------------
// control simulator

const blockSpec = z.object({
  kind: z.enum(['P', 'I', 'PI', 'PD', 'PID', 'lead', 'PT1', 'PT2', 'PTn', 'IT1', 'PTt', 'D', 'custom']),
  K: num.optional(),
  T: num.optional(),
  Ti: num.optional(),
  Td: num.optional(),
  Tf: num.optional(),
  zeta: num.optional(),
  n: small(1, 20).optional(),
  alpha: num.optional(),
  Tt: small(0, 1e6).optional(),
  num: z.array(num).max(30).optional(),
  den: z.array(num).max(30).optional(),
});
const simData = z.object({
  kind: z.enum(['source', 'sum', 'gain', 'tf', 'filter', 'sat', 'scope']),
  name,
  wave: z.enum(['step', 'ramp', 'sine', 'square', 'pulse', 'const', 'noise']).optional(),
  amp: num.optional(),
  t0: num.optional(),
  f: num.optional(),
  width: num.optional(),
  signs: z.string().regex(/^[+-]{1,4}$/).optional(),
  K: num.optional(),
  spec: blockSpec.optional(),
  approx: z.enum(['butterworth', 'chebyshev', 'bessel']).optional(),
  ftype: z.enum(['lowpass', 'highpass', 'bandpass', 'bandstop']).optional(),
  order: small(1, 10).optional(),
  fc: num.optional(),
  bw: num.optional(),
  ripple: num.optional(),
  lo: num.optional(),
  hi: num.optional(),
  inputs: small(1, 4).optional(),
  flip: z.boolean().optional(),
});
const simEdge = z.object({
  id,
  source: id,
  target: id,
  sourceHandle: z.literal('out').nullish(),
  targetHandle: z.string().regex(/^in[0-3]$/),
  type: z.string().optional(),
  markerEnd: z.unknown().optional(),
});
export const simSheet = z.object({
  nodes: z.array(z.object({ id, type: z.literal('cblock'), position: pos, data: simData })).max(500),
  edges: z.array(simEdge).max(2000),
  settings: z.object({ tEnd: small(1e-3, 1e7), steps: small(10, 1e5), src: z.string().optional(), out: z.string().optional() }).partial().optional(),
});

// ---------------------------------------------------------------------------
// circuit simulator

const kinds = Object.keys(DEVICES) as [string, ...string[]];
const param = z.union([num, z.boolean(), z.string().max(50)]);
export const circuitSheet = z.object({
  nodes: z
    .array(
      z.object({
        id,
        type: z.literal('ccomp'),
        position: pos,
        data: z.object({ kind: z.enum(kinds), name, params: z.record(z.string().max(40), param), rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]) }),
      }),
    )
    .max(500),
  edges: z.array(z.object({ id, type: z.string().optional(), source: id, target: id, sourceHandle: z.string().max(20).nullish(), targetHandle: z.string().max(20).nullish() })).max(2000),
  analysis: z
    .object({
      mode: z.enum(['dc', 'tran', 'ac']),
      tEnd: small(1e-12, 1e6),
      steps: small(1, 1e6),
      fromDC: z.boolean(),
      acInput: z.string().optional(),
      fMin: num.optional(),
      fMax: num.optional(),
    })
    .partial()
    .optional(),
});

/** Validate and drop wires that point to blocks which do not exist. */
export function checkSheet<T extends { nodes: { id: string }[]; edges: { source: string; target: string }[] }>(schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) return null;
  const ids = new Set(r.data.nodes.map((n) => n.id));
  if (ids.size !== r.data.nodes.length) return null;
  return { ...r.data, edges: r.data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}
