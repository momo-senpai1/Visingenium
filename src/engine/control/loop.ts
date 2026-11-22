/**
 * Control loops: standard controllers and plants as transfer functions, and
 * the block-diagram reduction of a loop (series, parallel, feedback) recorded
 * step by step.
 */

import { feedback, mul, normalize, parallel, polyTex, pow, series, tf, tfTex, type TF } from './poly';

export type BlockKind = 'P' | 'I' | 'PI' | 'PD' | 'PID' | 'lead' | 'PT1' | 'PT2' | 'PTn' | 'IT1' | 'PTt' | 'D' | 'custom';

export interface BlockSpec {
  kind: BlockKind;
  /** parameters (by kind) */
  K?: number;
  T?: number;
  Ti?: number;
  Td?: number;
  /** derivative filter time constant (fraction of Td when ≤ 0: Td/10) */
  Tf?: number;
  zeta?: number;
  n?: number;
  alpha?: number;
  Tt?: number;
  num?: number[];
  den?: number[];
}

export const BLOCK_INFO: Record<BlockKind, { label: string; params: (keyof BlockSpec)[]; tex: string }> = {
  P: { label: 'P (gain)', params: ['K'], tex: 'K' },
  I: { label: 'I (integrator)', params: ['K'], tex: '\\frac{K}{s}' },
  PI: { label: 'PI controller', params: ['K', 'Ti'], tex: 'K\\left(1 + \\frac{1}{T_i s}\\right)' },
  PD: { label: 'PD controller (filtered D)', params: ['K', 'Td'], tex: 'K\\left(1 + \\frac{T_d s}{T_f s + 1}\\right)' },
  PID: { label: 'PID controller (filtered D)', params: ['K', 'Ti', 'Td'], tex: 'K\\left(1 + \\frac{1}{T_i s} + \\frac{T_d s}{T_f s + 1}\\right)' },
  lead: { label: 'Lead / lag compensator', params: ['K', 'T', 'alpha'], tex: 'K\\,\\frac{1 + T s}{1 + \\alpha T s}' },
  PT1: { label: 'PT1 (first order lag)', params: ['K', 'T'], tex: '\\frac{K}{T s + 1}' },
  PT2: { label: 'PT2 (second order)', params: ['K', 'T', 'zeta'], tex: '\\frac{K}{T^2 s^2 + 2 D T s + 1}' },
  PTn: { label: 'PTn (n equal lags)', params: ['K', 'T', 'n'], tex: '\\frac{K}{(T s + 1)^n}' },
  IT1: { label: 'IT1 (integrator with lag)', params: ['K', 'T'], tex: '\\frac{K}{s\\,(T s + 1)}' },
  PTt: { label: 'PT1 with dead time', params: ['K', 'T', 'Tt'], tex: '\\frac{K}{T s + 1}\\,e^{-T_t s}' },
  D: { label: 'D (differentiator, filtered)', params: ['K', 'T'], tex: '\\frac{K s}{T s + 1}' },
  custom: { label: 'Custom num/den', params: ['num', 'den'], tex: '\\frac{b(s)}{a(s)}' },
};

export function blockTF(b: BlockSpec): TF {
  const K = b.K ?? 1;
  const T = Math.max(b.T ?? 1, 1e-9);
  switch (b.kind) {
    case 'P':
      return tf([K], [1]);
    case 'I':
      return tf([K], [0, 1]);
    case 'PI': {
      const Ti = Math.max(b.Ti ?? 1, 1e-9);
      return tf([K, K * Ti], [0, Ti]);
    }
    case 'PD': {
      const Td = b.Td ?? 0.1;
      const Tf = b.Tf && b.Tf > 0 ? b.Tf : Td / 10 || 1e-6;
      // K(1 + Td s/(Tf s + 1)) = K((Tf + Td)s + 1)/(Tf s + 1)
      return tf([K, K * (Tf + Td)], [1, Tf]);
    }
    case 'PID': {
      const Ti = Math.max(b.Ti ?? 1, 1e-9);
      const Td = b.Td ?? 0.1;
      const Tf = b.Tf && b.Tf > 0 ? b.Tf : Td / 10 || 1e-6;
      // K[ Ti s (Tf s + 1) + (Tf s + 1) + Td Ti s² ] / [Ti s (Tf s + 1)]
      const num = [K, K * (Ti + Tf), K * (Ti * Tf + Td * Ti)];
      const den = [0, Ti, Ti * Tf];
      return tf(num, den);
    }
    case 'lead':
      return tf([K, K * T], [1, (b.alpha ?? 0.1) * T]);
    case 'PT1':
      return tf([K], [1, T]);
    case 'PT2': {
      const z = b.zeta ?? 0.5;
      return tf([K], [1, 2 * z * T, T * T]);
    }
    case 'PTn':
      return tf([K], pow([1, T], Math.max(1, Math.round(b.n ?? 3))));
    case 'IT1':
      return tf([K], [0, 1, T]);
    case 'PTt':
      return tf([K], [1, T], Math.max(0, b.Tt ?? 0.5));
    case 'D':
      return tf([0, K], [1, T]);
    case 'custom':
      return tf(b.num?.length ? b.num : [1], b.den?.length ? b.den : [1]);
  }
}

export interface LoopBlock {
  id: string;
  name: string;
  spec: BlockSpec;
  /** optional block in parallel (outputs added) */
  parallel?: BlockSpec | null;
  /** optional local (minor) feedback around this block */
  local?: { spec: BlockSpec; sign: 1 | -1 } | null;
}

export interface LoopSpec {
  forward: LoopBlock[];
  feedback: LoopBlock[];
  sign: 1 | -1;
}

export interface ReduceStep {
  rule: 'parallel' | 'feedback' | 'series' | 'closed' | 'open';
  title: string;
  /** LaTeX of the rule and the result */
  formula: string;
  result: TF;
}

/** Reduce the loop to its open-loop and closed-loop transfer functions, recording every step. */
export function reduceLoop(loop: LoopSpec) {
  const steps: ReduceStep[] = [];
  const reduceChain = (blocks: LoopBlock[], sym: string): TF => {
    const parts: TF[] = [];
    for (const b of blocks) {
      let g = blockTF(b.spec);
      if (b.parallel) {
        const g2 = blockTF(b.parallel);
        const r = parallel(g, g2);
        steps.push({ rule: 'parallel', title: `${b.name}: parallel branch`, formula: `G_{${b.name}} + G_{${b.name}}' = ${tfTex(g)} + ${tfTex(g2)} = ${tfTex(normalize(r))}`, result: r });
        g = r;
      }
      if (b.local) {
        const h = blockTF(b.local.spec);
        const r = feedback(g, h, b.local.sign);
        steps.push({
          rule: 'feedback',
          title: `${b.name}: local feedback`,
          formula: `\\frac{G}{1 ${b.local.sign < 0 ? '+' : '-'} G H} = \\frac{${tfTex(g)}}{1 ${b.local.sign < 0 ? '+' : '-'} ${tfTex(g)}\\cdot ${tfTex(h)}} = ${tfTex(normalize(r))}`,
          result: r,
        });
        g = r;
      }
      parts.push(g);
    }
    if (!parts.length) return tf([1], [1]);
    let acc = parts[0]!;
    for (let i = 1; i < parts.length; i++) acc = series(acc, parts[i]!);
    if (parts.length > 1)
      steps.push({ rule: 'series', title: `${sym}: blocks in series multiply`, formula: `${sym} = ${parts.map((p) => `\\left(${tfTex(p)}\\right)`).join('\\cdot')} = ${tfTex(normalize(acc))}`, result: acc });
    return acc;
  };
  const F = reduceChain(loop.forward, 'G_F');
  const H = reduceChain(loop.feedback, 'G_R');
  const L = series(F, H);
  steps.push({ rule: 'open', title: 'Open loop', formula: `L(s) = G_F\\,G_R = ${tfTex(normalize(L))}`, result: L });
  const T = feedback(F, H, loop.sign);
  steps.push({
    rule: 'closed',
    title: 'Closed loop (reference → output)',
    formula: `T(s) = \\frac{G_F}{1 ${loop.sign < 0 ? '+' : '-'} G_F G_R} = \\frac{${tfTexNum(F, H)}}{${tfTexDen(F, H, loop.sign)}} = ${tfTex(normalize(T))}`,
    result: T,
  });
  // sensitivity S = 1/(1 + L): error response
  const S = feedback(tf([1], [1]), L, loop.sign);
  return { F, H, L, T, S, steps };
}

const tfTexNum = (F: TF, H: TF) => polyTex(mul(F.num, H.den));
const tfTexDen = (F: TF, H: TF, sign: number) => `${polyTex(mul(F.den, H.den))} ${sign < 0 ? '+' : '-'} (${polyTex(mul(F.num, H.num))})`;
