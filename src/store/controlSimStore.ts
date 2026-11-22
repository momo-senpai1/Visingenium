/** Block-diagram simulator state (React Flow nodes and wires). */

import { addEdge, applyEdgeChanges, applyNodeChanges, MarkerType, type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/components/mechanics/common';
import type { BlockSpec } from '@/engine/control/loop';
import type { SimBlockData } from '@/engine/control/blocksim';
import { checkSheet, simSheet } from './sheetSchemas';

export type SNodeData = SimBlockData & Record<string, unknown>;
export type SNode = Node<SNodeData, 'cblock'>;
export type SEdge = Edge;

/** Palette entries: a block kind with preset parameters. */
export interface Preset {
  id: string;
  label: string;
  prefix: string;
  data: Omit<SimBlockData, 'name'>;
}
const spec = (s: BlockSpec) => ({ kind: 'tf' as const, spec: s });
export const PRESETS: { title: string; items: Preset[] }[] = [
  {
    title: 'Sources',
    items: [
      { id: 'step', label: 'Step', prefix: 'w', data: { kind: 'source', wave: 'step', amp: 1, t0: 0 } },
      { id: 'ramp', label: 'Ramp', prefix: 'w', data: { kind: 'source', wave: 'ramp', amp: 1, t0: 0 } },
      { id: 'sine', label: 'Sine', prefix: 'w', data: { kind: 'source', wave: 'sine', amp: 1, f: 0.2, t0: 0 } },
      { id: 'square', label: 'Square wave', prefix: 'w', data: { kind: 'source', wave: 'square', amp: 1, f: 0.05, t0: 0 } },
      { id: 'pulse', label: 'Pulse', prefix: 'w', data: { kind: 'source', wave: 'pulse', amp: 1, t0: 1, width: 1 } },
      { id: 'dist', label: 'Disturbance step', prefix: 'z', data: { kind: 'source', wave: 'step', amp: 0.5, t0: 10 } },
      { id: 'noise', label: 'Noise', prefix: 'n', data: { kind: 'source', wave: 'noise', amp: 0.05, t0: 0 } },
    ],
  },
  {
    title: 'Junctions & gain',
    items: [
      { id: 'sum', label: 'Summing point (+ −)', prefix: 'e', data: { kind: 'sum', signs: '+-' } },
      { id: 'sumpp', label: 'Summing point (+ +)', prefix: 'S', data: { kind: 'sum', signs: '++' } },
      { id: 'gain', label: 'Gain K', prefix: 'K', data: { kind: 'gain', K: 2 } },
    ],
  },
  {
    title: 'Controllers',
    items: [
      { id: 'P', label: 'P controller', prefix: 'R', data: spec({ kind: 'P', K: 2 }) },
      { id: 'PI', label: 'PI controller', prefix: 'R', data: spec({ kind: 'PI', K: 2, Ti: 2 }) },
      { id: 'PD', label: 'PD controller', prefix: 'R', data: spec({ kind: 'PD', K: 2, Td: 0.5 }) },
      { id: 'PID', label: 'PID controller', prefix: 'R', data: spec({ kind: 'PID', K: 2, Ti: 2, Td: 0.5 }) },
      { id: 'lead', label: 'Lead / lag compensator', prefix: 'R', data: spec({ kind: 'lead', K: 1, T: 1, alpha: 0.1 }) },
    ],
  },
  {
    title: 'Plants & elements',
    items: [
      { id: 'PT1', label: 'PT1', prefix: 'G', data: spec({ kind: 'PT1', K: 1, T: 1 }) },
      { id: 'PT2', label: 'PT2', prefix: 'G', data: spec({ kind: 'PT2', K: 1, T: 1, zeta: 0.5 }) },
      { id: 'PTn', label: 'PTn', prefix: 'G', data: spec({ kind: 'PTn', K: 1, T: 1, n: 3 }) },
      { id: 'I', label: 'Integrator', prefix: 'G', data: spec({ kind: 'I', K: 1 }) },
      { id: 'IT1', label: 'IT1', prefix: 'G', data: spec({ kind: 'IT1', K: 1, T: 1 }) },
      { id: 'PTt', label: 'Dead time + PT1', prefix: 'G', data: spec({ kind: 'PTt', K: 1, T: 1, Tt: 1 }) },
      { id: 'D', label: 'Differentiator', prefix: 'G', data: spec({ kind: 'D', K: 1, T: 0.1 }) },
      { id: 'custom', label: 'Transfer function b(s)/a(s)', prefix: 'G', data: spec({ kind: 'custom', num: [1], den: [1, 2, 1] }) },
      { id: 'sensor', label: 'Sensor (PT1, feedback)', prefix: 'H', data: { ...spec({ kind: 'PT1', K: 1, T: 0.2 }), flip: true } },
    ],
  },
  {
    title: 'Filters',
    items: [
      { id: 'lp', label: 'Low-pass filter', prefix: 'F', data: { kind: 'filter', approx: 'butterworth', ftype: 'lowpass', order: 2, fc: 1, bw: 0.5, ripple: 1 } },
      { id: 'hp', label: 'High-pass filter', prefix: 'F', data: { kind: 'filter', approx: 'butterworth', ftype: 'highpass', order: 2, fc: 1, bw: 0.5, ripple: 1 } },
      { id: 'bp', label: 'Band-pass filter', prefix: 'F', data: { kind: 'filter', approx: 'butterworth', ftype: 'bandpass', order: 2, fc: 1, bw: 0.5, ripple: 1 } },
      { id: 'bs', label: 'Band-stop filter (notch)', prefix: 'F', data: { kind: 'filter', approx: 'butterworth', ftype: 'bandstop', order: 2, fc: 1, bw: 0.5, ripple: 1 } },
    ],
  },
  {
    title: 'Nonlinear & display',
    items: [
      { id: 'sat', label: 'Saturation (actuator limit)', prefix: 'Sat', data: { kind: 'sat', lo: -1, hi: 1 } },
      { id: 'scope', label: 'Scope', prefix: 'Scope', data: { kind: 'scope', inputs: 2 } },
    ],
  },
];
export const PRESET_BY_ID = new Map(PRESETS.flatMap((g) => g.items).map((p) => [p.id, p]));
export const SIM_DND = 'application/x-control-block';

export interface SimSettings {
  tEnd: number;
  steps: number;
  /** analysed transfer function: from this source … */
  src?: string;
  /** … to the output of this block */
  out?: string;
}

const ARROW = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'rgb(148,163,184)' };
const wire = (source: string, target: string, k = 0): SEdge => ({ id: `${source}-${target}-${k}`, source, target, sourceHandle: 'out', targetHandle: `in${k}`, type: 'sig', markerEnd: ARROW });
const node = (id: string, name: string, x: number, y: number, data: Omit<SimBlockData, 'name'>): SNode => ({ id, type: 'cblock', position: { x, y }, data: { ...data, name } as SNodeData });

type Ex = { label: string; nodes: SNode[]; edges: SEdge[]; settings: SimSettings };
export const SIM_EXAMPLES: Record<string, Ex> = {
  pid: {
    label: 'PID control of a PT2 plant',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 1 }),
      node('e', 'e', 140, 108, { kind: 'sum', signs: '+-' }),
      node('R', 'R', 240, 92, spec({ kind: 'PID', K: 2, Ti: 2, Td: 0.5 })),
      node('G', 'G', 440, 92, spec({ kind: 'PT2', K: 1, T: 1, zeta: 0.6 })),
      node('sc', 'Scope', 660, 90, { kind: 'scope', inputs: 2 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R'), wire('R', 'G'), wire('G', 'sc', 0), wire('w', 'sc', 1), wire('G', 'e', 1)],
    settings: { tEnd: 20, steps: 2000, src: 'w', out: 'G' },
  },
  disturbance: {
    label: 'Disturbance rejection (load step at t = 15 s)',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 1 }),
      node('e', 'e', 130, 108, { kind: 'sum', signs: '+-' }),
      node('R', 'R', 220, 92, spec({ kind: 'PI', K: 1.5, Ti: 3 })),
      node('z', 'z', 300, 0, { kind: 'source', wave: 'step', amp: 0.5, t0: 15 }),
      node('u', 'u', 430, 108, { kind: 'sum', signs: '++' }),
      node('G', 'G', 520, 92, spec({ kind: 'PTn', K: 1, T: 1, n: 2 })),
      node('sc', 'Scope', 740, 90, { kind: 'scope', inputs: 3 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R'), wire('R', 'u', 0), wire('z', 'u', 1), wire('u', 'G'), wire('G', 'e', 1), wire('G', 'sc', 0), wire('w', 'sc', 1), wire('z', 'sc', 2)],
    settings: { tEnd: 40, steps: 2000, src: 'z', out: 'G' },
  },
  windup: {
    label: 'Actuator saturation and integrator windup',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 1 }),
      node('e', 'e', 130, 108, { kind: 'sum', signs: '+-' }),
      node('R', 'R', 220, 92, spec({ kind: 'PI', K: 4, Ti: 1 })),
      node('Sat', 'Sat', 420, 98, { kind: 'sat', lo: -1.5, hi: 1.5 }),
      node('G', 'G', 540, 92, spec({ kind: 'PT1', K: 1, T: 2 })),
      node('sc', 'Scope', 760, 90, { kind: 'scope', inputs: 3 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R'), wire('R', 'Sat'), wire('Sat', 'G'), wire('G', 'e', 1), wire('G', 'sc', 0), wire('w', 'sc', 1), wire('Sat', 'sc', 2)],
    settings: { tEnd: 15, steps: 2000, src: 'w', out: 'G' },
  },
  sensor: {
    label: 'Loop with a sensor in the feedback path',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 0.5 }),
      node('e', 'e', 130, 108, { kind: 'sum', signs: '+-' }),
      node('R', 'R', 220, 92, spec({ kind: 'PI', K: 1.2, Ti: 1.5 })),
      node('G', 'G', 420, 92, spec({ kind: 'PT2', K: 1, T: 1, zeta: 0.7 })),
      node('H', 'H', 310, 230, { ...spec({ kind: 'PT1', K: 1, T: 0.5 }), flip: true }),
      node('sc', 'Scope', 650, 90, { kind: 'scope', inputs: 3 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R'), wire('R', 'G'), wire('G', 'H'), wire('H', 'e', 1), wire('G', 'sc', 0), wire('w', 'sc', 1), wire('H', 'sc', 2)],
    settings: { tEnd: 20, steps: 2000, src: 'w', out: 'G' },
  },
  deadtime: {
    label: 'PI control of a dead-time plant',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 1 }),
      node('e', 'e', 130, 108, { kind: 'sum', signs: '+-' }),
      node('R', 'R', 220, 92, spec({ kind: 'PI', K: 0.8, Ti: 3 })),
      node('G', 'G', 420, 92, spec({ kind: 'PTt', K: 1, T: 3, Tt: 1.5 })),
      node('sc', 'Scope', 650, 90, { kind: 'scope', inputs: 2 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R'), wire('R', 'G'), wire('G', 'e', 1), wire('G', 'sc', 0), wire('w', 'sc', 1)],
    settings: { tEnd: 40, steps: 2000, src: 'w', out: 'G' },
  },
  noisefilter: {
    label: 'Noisy measurement with a low-pass filter in the feedback',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 1 }),
      node('e', 'e', 130, 108, { kind: 'sum', signs: '+-' }),
      node('R', 'R', 220, 92, spec({ kind: 'PID', K: 2, Ti: 2, Td: 0.4 })),
      node('G', 'G', 420, 92, spec({ kind: 'PT2', K: 1, T: 1, zeta: 0.7 })),
      node('m', 'm', 620, 108, { kind: 'sum', signs: '++' }),
      node('n', 'n', 520, 190, { kind: 'source', wave: 'noise', amp: 0.05, t0: 0 }),
      node('F', 'F', 330, 250, { kind: 'filter', approx: 'butterworth', ftype: 'lowpass', order: 2, fc: 1, bw: 0.5, ripple: 1, flip: true }),
      node('sc', 'Scope', 760, 80, { kind: 'scope', inputs: 3 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R'), wire('R', 'G'), wire('G', 'm', 0), wire('n', 'm', 1), wire('m', 'F'), wire('F', 'e', 1), wire('G', 'sc', 0), wire('w', 'sc', 1), wire('m', 'sc', 2)],
    settings: { tEnd: 20, steps: 2000, src: 'w', out: 'G' },
  },
  cascade: {
    label: 'Cascade control (inner and outer loop)',
    nodes: [
      node('w', 'w', 0, 100, { kind: 'source', wave: 'step', amp: 1, t0: 1 }),
      node('e', 'e', 120, 108, { kind: 'sum', signs: '+-' }),
      node('R1', 'R1', 200, 92, spec({ kind: 'PI', K: 1, Ti: 4 })),
      node('e2', 'e2', 380, 108, { kind: 'sum', signs: '+-' }),
      node('R2', 'R2', 460, 92, spec({ kind: 'P', K: 5 })),
      node('G1', 'G1', 640, 92, spec({ kind: 'PT1', K: 1, T: 0.5 })),
      node('G2', 'G2', 840, 92, spec({ kind: 'PT1', K: 1, T: 4 })),
      node('sc', 'Scope', 1050, 90, { kind: 'scope', inputs: 3 }),
    ],
    edges: [wire('w', 'e', 0), wire('e', 'R1'), wire('R1', 'e2', 0), wire('e2', 'R2'), wire('R2', 'G1'), wire('G1', 'G2'), wire('G1', 'e2', 1), wire('G2', 'e', 1), wire('G2', 'sc', 0), wire('w', 'sc', 1), wire('G1', 'sc', 2)],
    settings: { tEnd: 30, steps: 2000, src: 'w', out: 'G2' },
  },
};

interface State {
  nodes: SNode[];
  edges: SEdge[];
  settings: SimSettings;
  loadSeq: number;
  onNodesChange: (c: NodeChange<SNode>[]) => void;
  onEdgesChange: (c: EdgeChange<SEdge>[]) => void;
  onConnect: (c: Connection) => void;
  addBlock: (preset: string, position: { x: number; y: number }) => void;
  update: (id: string, patch: Partial<SimBlockData>) => void;
  remove: (id: string) => void;
  setSettings: (p: Partial<SimSettings>) => void;
  load: (id: string) => void;
  clear: () => void;
  /** current sheet for saving, and loading a saved one */
  snapshot: () => SimSheet;
  /** false when the sheet is invalid (nothing is changed then) */
  loadSheet: (p: unknown) => boolean;
}
export interface SimSheet {
  nodes: SNode[];
  edges: SEdge[];
  settings: SimSettings;
}

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
const nextName = (nodes: SNode[], prefix: string) => {
  for (let i = 1; ; i++) if (!nodes.some((n) => n.data.name === `${prefix}${i}`)) return `${prefix}${i}`;
};

export const useControlSim = create<State>()(
  persist(
    (set, get) => ({
      nodes: SIM_EXAMPLES.pid!.nodes,
      edges: SIM_EXAMPLES.pid!.edges,
      settings: SIM_EXAMPLES.pid!.settings,
      loadSeq: 0,
      onNodesChange: (c) => set({ nodes: applyNodeChanges(c, get().nodes) }),
      onEdgesChange: (c) => set({ edges: applyEdgeChanges(c, get().edges) }),
      onConnect: (c) => {
        if (!c.source || !c.target || c.source === c.target) return;
        // normalise the direction: output → input
        let { source, target, sourceHandle, targetHandle } = c;
        if (sourceHandle?.startsWith('in') && targetHandle === 'out') [source, target, sourceHandle, targetHandle] = [target, source, targetHandle, sourceHandle];
        if (sourceHandle !== 'out' || !targetHandle?.startsWith('in')) return;
        // an input takes one signal: a new wire replaces the old one
        const edges = get().edges.filter((e) => !(e.target === target && e.targetHandle === targetHandle));
        set({ edges: addEdge({ id: uid('s'), source, target, sourceHandle, targetHandle, type: 'sig', markerEnd: ARROW }, edges) });
      },
      addBlock: (preset, position) => {
        const p = PRESET_BY_ID.get(preset);
        if (!p) return;
        const n: SNode = { id: uid('b'), type: 'cblock', position, data: { ...structuredClone(p.data), name: nextName(get().nodes, p.prefix) } as SNodeData, selected: true };
        set({ nodes: [...get().nodes.map((x) => ({ ...x, selected: false })), n] });
      },
      update: (id, patch) =>
        set({
          nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
          // fewer inputs: drop wires to inputs that no longer exist
          edges:
            patch.signs !== undefined || patch.inputs !== undefined
              ? get().edges.filter((e) => {
                  if (e.target !== id) return true;
                  const k = Number(e.targetHandle?.slice(2));
                  const cnt = patch.signs !== undefined ? patch.signs.length : Math.min(4, Math.max(1, patch.inputs ?? 1));
                  return k < cnt;
                })
              : get().edges,
        }),
      remove: (id) => set({ nodes: get().nodes.filter((n) => n.id !== id), edges: get().edges.filter((e) => e.source !== id && e.target !== id) }),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      load: (id) => {
        const ex = SIM_EXAMPLES[id];
        if (ex) set({ nodes: structuredClone(ex.nodes), edges: structuredClone(ex.edges), settings: { ...ex.settings }, loadSeq: get().loadSeq + 1 });
      },
      clear: () => set({ nodes: [], edges: [], settings: { tEnd: 20, steps: 2000 }, loadSeq: get().loadSeq + 1 }),
      snapshot: () => ({ nodes: get().nodes.map(({ id, type, position, data }) => ({ id, type, position, data })) as SNode[], edges: get().edges, settings: get().settings }),
      loadSheet: (p) => {
        const s = checkSheet(simSheet, p);
        if (!s) return false;
        set({ nodes: (s.nodes as SNode[]).map((n) => ({ ...n, selected: false })), edges: s.edges as SEdge[], settings: { tEnd: 20, steps: 2000, ...s.settings }, loadSeq: get().loadSeq + 1 });
        return true;
      },
    }),
    {
      name: 'ts-control-sim',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })), edges: s.edges, settings: s.settings }),
    },
  ),
);
