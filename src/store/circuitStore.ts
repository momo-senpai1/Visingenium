/** Circuit editor state (React Flow nodes = components, edges = wires), persisted. */

import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react';
import { useMemo } from 'react';
import { create } from 'zustand';
import { checkSheet, circuitSheet } from './sheetSchemas';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEVICES, simulateTransient, solveCircuit, type CCircuit, type CircuitResult, type CKind, type CParams, type DeviceStates, type TransientResult } from '@/engine/circuits/solver';

export type Rot = 0 | 90 | 180 | 270;
export type CNodeData = { kind: CKind; name: string; params: CParams; rot: Rot };
export type CNode = Node<CNodeData, 'ccomp'>;
export type CEdge = Edge<Record<string, never>, 'wire'>;

export const DEFAULTS = Object.fromEntries(Object.entries(DEVICES).map(([k, d]) => [k, d.defaults])) as Record<CKind, CParams>;
const PREFIX: Record<CKind, string> = {
  resistor: 'R', vsource: 'U', battery: 'G', acsource: 'U~', isource: 'I', ground: 'GND', pot: 'RP', lamp: 'H', capacitor: 'C', inductor: 'L',
  transformer: 'T', fuse: 'F', ldr: 'LDR', thermistor: 'RT', speaker: 'LS', switch: 'S', spdt: 'S', dpdt: 'S', pushNO: 'SB', pushNC: 'SB', relay: 'K',
  diode: 'D', zener: 'Z', led: 'LED', photodiode: 'PD', bridge: 'B', npn: 'Q', pnp: 'Q', nmos: 'M', pmos: 'M', njfet: 'J', pjfet: 'J',
  vcvs: 'E', vccs: 'G', ccvs: 'H', cccs: 'F', opamp: 'OP', regulator: 'U', timer555: 'IC', logicIn: 'IN', clock: 'CLK', logicOut: 'OUT',
  buffer: 'G', not: 'G', and: 'G', nand: 'G', or: 'G', nor: 'G', xor: 'G', xnor: 'G', dff: 'FF', jkff: 'FF', tff: 'FF', srff: 'FF',
  ammeter: 'A', voltmeter: 'V', probe: 'P',
};

export type Analysis = { mode: 'dc' | 'tran' | 'ac'; tEnd: number; steps: number; fromDC: boolean; acInput?: string; fMin?: number; fMax?: number };

interface CircuitState {
  nodes: CNode[];
  edges: CEdge[];
  analysis: Analysis;
  /** bumped when a whole sheet is loaded, so the canvas re-fits its view */
  loadSeq: number;
  setAnalysis: (p: Partial<Analysis>) => void;
  resetStates: () => void;
  onNodesChange: (c: NodeChange<CNode>[]) => void;
  onEdgesChange: (c: EdgeChange<CEdge>[]) => void;
  onConnect: (c: Connection) => void;
  addComponent: (kind: CKind, position: { x: number; y: number }) => void;
  update: (id: string, patch: Partial<CNodeData>) => void;
  setParam: (id: string, key: keyof CParams, value: CParams[keyof CParams]) => void;
  rotate: (id: string) => void;
  /** the last rotation: its wires were detached, so it can be undone */
  lastRotate: { id: string; rot: Rot; position: { x: number; y: number }; edges: CEdge[] } | null;
  undoRotate: () => void;
  remove: (id: string) => void;
  load: (name: ExampleId) => void;
  clear: () => void;
  snapshot: () => unknown;
  /** false when the sheet is invalid (nothing is changed then) */
  loadSheet: (p: unknown) => boolean;
}

const safe: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
const nextName = (nodes: CNode[], kind: CKind) => {
  const taken = new Set(nodes.map((n) => n.data.name));
  for (let i = 1; ; i++) if (!taken.has(`${PREFIX[kind]}${i}`)) return `${PREFIX[kind]}${i}`;
};

type Ex = { comps: [string, CKind, CParams, number, number, Rot?][]; wires: [string, string][] };
export type ExampleId = 'divider' | 'led' | 'bridge' | 'lamps' | 'diodes' | 'transistor' | 'opamp' | 'rc' | 'rectifier' | 'blinker' | 'adder' | 'counter' | 'resnet' | 'rcfilter' | 'sallenkey';
export const EXAMPLES: Record<ExampleId, { label: string; ex: Ex; analysis?: Partial<Analysis> }> = {
  divider: {
    label: 'Voltage divider',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 12 }, 0, 120, 90],
        ['R1', 'resistor', { R: 1000 }, 160, 20],
        ['R2', 'resistor', { R: 2000 }, 330, 120, 90],
        ['V1', 'voltmeter', {}, 470, 120, 90],
        ['GND', 'ground', {}, 30, 280],
      ],
      wires: [['U1:a', 'R1:a'], ['R1:b', 'R2:a'], ['R2:a', 'V1:a'], ['R2:b', 'U1:b'], ['V1:b', 'R2:b'], ['U1:b', 'GND:a']],
    },
  },
  led: {
    label: 'LED with series resistor',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 9 }, 0, 120, 90],
        ['S1', 'switch', { closed: true }, 140, 20],
        ['R1', 'resistor', { R: 330 }, 300, 20],
        ['LED1', 'led', { Vf: 2, Inom: 0.02, color: 'red' }, 460, 120, 90],
        ['A1', 'ammeter', {}, 300, 220, 180],
        ['GND', 'ground', {}, 30, 300],
      ],
      wires: [['U1:a', 'S1:a'], ['S1:b', 'R1:a'], ['R1:b', 'LED1:a'], ['LED1:b', 'A1:a'], ['A1:b', 'U1:b'], ['U1:b', 'GND:a']],
    },
  },
  bridge: {
    label: 'Wheatstone bridge',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 10 }, 0, 160, 90],
        ['R1', 'resistor', { R: 100 }, 170, 60],
        ['R2', 'resistor', { R: 200 }, 380, 60],
        ['R3', 'resistor', { R: 150 }, 170, 260],
        ['R4', 'resistor', { R: 330 }, 380, 260],
        ['A1', 'ammeter', {}, 290, 160, 90],
        ['GND', 'ground', {}, 30, 360],
      ],
      wires: [['U1:a', 'R1:a'], ['U1:a', 'R3:a'], ['R1:b', 'R2:a'], ['R3:b', 'R4:a'], ['R2:b', 'R4:b'], ['R4:b', 'U1:b'], ['R1:b', 'A1:a'], ['A1:b', 'R3:b'], ['U1:b', 'GND:a']],
    },
  },
  lamps: {
    label: 'Lamps in parallel with switches',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 12 }, 0, 150, 90],
        ['S1', 'switch', { closed: true }, 160, 40],
        ['S2', 'switch', { closed: false }, 160, 200],
        ['H1', 'lamp', { Vnom: 12, Pnom: 5 }, 340, 40],
        ['H2', 'lamp', { Vnom: 12, Pnom: 10 }, 340, 200],
        ['GND', 'ground', {}, 30, 320],
      ],
      wires: [['U1:a', 'S1:a'], ['U1:a', 'S2:a'], ['S1:b', 'H1:a'], ['S2:b', 'H2:a'], ['H1:b', 'H2:b'], ['H2:b', 'U1:b'], ['U1:b', 'GND:a']],
    },
  },
  diodes: {
    label: 'Diode logic (OR gate)',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 5 }, 0, 40, 90],
        ['U2', 'vsource', { V: 0 }, 0, 230, 90],
        ['D1', 'diode', { Is: 2.52e-9, n: 1.752 }, 160, 20],
        ['D2', 'diode', { Is: 2.52e-9, n: 1.752 }, 160, 210],
        ['R1', 'resistor', { R: 10000 }, 360, 120, 90],
        ['GND', 'ground', {}, 200, 360],
      ],
      wires: [['U1:a', 'D1:a'], ['U2:a', 'D2:a'], ['D1:b', 'R1:a'], ['D2:b', 'R1:a'], ['R1:b', 'GND:a'], ['U1:b', 'GND:a'], ['U2:b', 'GND:a']],
    },
  },

  transistor: {
    label: 'Transistor switch drives an LED',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 9 }, 0, 140, 90],
        ['S1', 'switch', { closed: true }, 120, 260],
        ['RB', 'resistor', { R: 10000 }, 260, 260],
        ['RC', 'resistor', { R: 330 }, 420, 20, 90],
        ['LED1', 'led', { Vf: 2, Inom: 0.02, color: 'green' }, 420, 140, 90],
        ['Q1', 'npn', { beta: 100 }, 400, 240],
        ['GND', 'ground', {}, 430, 380],
      ],
      wires: [['U1:a', 'RC:a'], ['RC:b', 'LED1:a'], ['LED1:b', 'Q1:c'], ['U1:a', 'S1:a'], ['S1:b', 'RB:a'], ['RB:b', 'Q1:b'], ['Q1:e', 'GND:a'], ['U1:b', 'GND:a']],
    },
  },
  opamp: {
    label: 'Inverting op-amp amplifier (sine input)',
    analysis: { mode: 'tran', tEnd: 0.04, steps: 2000 },
    ex: {
      comps: [
        ['U1', 'acsource', { amp: 0.5, freq: 100, wave: 'sine' }, 0, 160, 90],
        ['R1', 'resistor', { R: 1000 }, 130, 80],
        ['R2', 'resistor', { R: 10000 }, 330, 0],
        ['OP1', 'opamp', { A: 1e5, Vsat: 13.5 }, 300, 80],
        ['P1', 'probe', {}, 460, 140],
        ['P2', 'probe', {}, 130, 180],
        ['GND', 'ground', {}, 230, 280],
      ],
      wires: [['U1:a', 'R1:a'], ['R1:b', 'OP1:inn'], ['R2:a', 'OP1:inn'], ['R2:b', 'OP1:out'], ['OP1:out', 'P1:a'], ['OP1:inp', 'GND:a'], ['U1:b', 'GND:a'], ['U1:a', 'P2:a']],
    },
  },
  rc: {
    label: 'RC charging curve (transient)',
    analysis: { mode: 'tran', tEnd: 0.005, steps: 1000 },
    ex: {
      comps: [
        ['U1', 'vsource', { V: 10 }, 0, 120, 90],
        ['R1', 'resistor', { R: 1000 }, 140, 20],
        ['C1', 'capacitor', { C: 1e-6 }, 320, 120, 90],
        ['P1', 'probe', {}, 420, 110],
        ['GND', 'ground', {}, 30, 280],
      ],
      wires: [['U1:a', 'R1:a'], ['R1:b', 'C1:a'], ['C1:a', 'P1:a'], ['C1:b', 'U1:b'], ['U1:b', 'GND:a']],
    },
  },
  rectifier: {
    label: 'Mains adapter: transformer, bridge, smoothing capacitor',
    analysis: { mode: 'tran', tEnd: 0.1, steps: 4000 },
    ex: {
      comps: [
        ['U1', 'acsource', { amp: 325, freq: 50, wave: 'sine' }, 0, 120, 90],
        ['T1', 'transformer', { L: 20, ratio: 0.05, k: 0.999 }, 120, 100],
        ['B1', 'bridge', {}, 290, 100],
        ['C1', 'capacitor', { C: 0.00047 }, 430, 120, 90],
        ['RL', 'resistor', { R: 220 }, 540, 120, 90],
        ['P1', 'probe', {}, 640, 80],
        ['GND', 'ground', {}, 30, 280],
        ['GND2', 'ground', {}, 440, 280],
      ],
      wires: [['U1:a', 'T1:p1'], ['U1:b', 'T1:p2'], ['U1:b', 'GND:a'], ['T1:s1', 'B1:ac1'], ['T1:s2', 'B1:ac2'], ['B1:p', 'C1:a'], ['B1:m', 'C1:b'], ['C1:a', 'RL:a'], ['C1:b', 'RL:b'], ['C1:b', 'GND2:a'], ['C1:a', 'P1:a']],
    },
  },
  blinker: {
    label: '555 blinker (astable, transient)',
    analysis: { mode: 'tran', tEnd: 2, steps: 4000 },
    ex: {
      comps: [
        ['U1', 'vsource', { V: 9 }, 0, 160, 90],
        ['IC1', 'timer555', {}, 260, 120],
        ['R1', 'resistor', { R: 10000 }, 100, 40],
        ['R2', 'resistor', { R: 47000 }, 100, 140, 90],
        ['C1', 'capacitor', { C: 1e-5 }, 100, 280, 90],
        ['RV', 'resistor', { R: 470 }, 440, 160],
        ['LED1', 'led', { Vf: 2, Inom: 0.02, color: 'red' }, 580, 200, 90],
        ['P1', 'probe', {}, 200, 340],
        ['GND', 'ground', {}, 300, 400],
      ],
      wires: [
        ['U1:a', 'IC1:vcc'], ['U1:a', 'IC1:reset'], ['U1:a', 'R1:a'], ['R1:b', 'IC1:dis'], ['R1:b', 'R2:a'], ['R2:b', 'IC1:thres'], ['R2:b', 'IC1:trig'], ['R2:b', 'C1:a'],
        ['C1:b', 'GND:a'], ['IC1:gnd', 'GND:a'], ['U1:b', 'GND:a'], ['IC1:out', 'RV:a'], ['RV:b', 'LED1:a'], ['LED1:b', 'GND:a'], ['C1:a', 'P1:a'],
      ],
    },
  },
  adder: {
    label: 'Half adder (XOR + AND), click the inputs',
    ex: {
      comps: [
        ['A', 'logicIn', { on: true }, 0, 40],
        ['B', 'logicIn', { on: false }, 0, 160],
        ['X1', 'xor', {}, 180, 30],
        ['A1', 'and', {}, 180, 150],
        ['SUM', 'logicOut', {}, 360, 40],
        ['CARRY', 'logicOut', {}, 360, 160],
      ],
      wires: [['A:out', 'X1:in1'], ['B:out', 'X1:in2'], ['A:out', 'A1:in1'], ['B:out', 'A1:in2'], ['X1:out', 'SUM:in'], ['A1:out', 'CARRY:in']],
    },
  },
  counter: {
    label: '2-bit counter from T flip-flops (transient)',
    analysis: { mode: 'tran', tEnd: 0.08, steps: 4000 },
    ex: {
      comps: [
        ['CLK', 'clock', { freq: 100 }, 0, 120],
        ['H', 'logicIn', { on: true }, 0, 20],
        ['FF1', 'tff', {}, 160, 60],
        ['FF2', 'tff', {}, 360, 60],
        ['Q0', 'logicOut', {}, 300, 200],
        ['Q1', 'logicOut', {}, 500, 200],
      ],
      wires: [['H:out', 'FF1:t'], ['H:out', 'FF2:t'], ['CLK:out', 'FF1:clk'], ['FF1:qn', 'FF2:clk'], ['FF1:q', 'Q0:in'], ['FF2:q', 'Q1:in']],
    },
  },

  resnet: {
    label: 'Resistor network to simplify (R1 ∥ R2) + R3',
    ex: {
      comps: [
        ['U1', 'vsource', { V: 12 }, 0, 120, 90],
        ['R1', 'resistor', { R: 1000 }, 160, 0],
        ['R2', 'resistor', { R: 1000 }, 160, 100],
        ['R3', 'resistor', { R: 1000 }, 380, 50],
        ['GND', 'ground', {}, 30, 300],
      ],
      wires: [['U1:a', 'R1:a'], ['U1:a', 'R2:a'], ['R1:b', 'R3:a'], ['R2:b', 'R3:a'], ['R3:b', 'U1:b'], ['U1:b', 'GND:a']],
    },
  },
  rcfilter: {
    label: 'RC low-pass filter (AC / Bode)',
    analysis: { mode: 'ac', fMin: 1, fMax: 100000 },
    ex: {
      comps: [
        ['U1', 'acsource', { amp: 1, freq: 1000 }, 0, 120, 90],
        ['R1', 'resistor', { R: 1000 }, 140, 20],
        ['C1', 'capacitor', { C: 1e-7 }, 320, 120, 90],
        ['P1', 'probe', {}, 420, 110],
        ['GND', 'ground', {}, 30, 280],
      ],
      wires: [['U1:a', 'R1:a'], ['R1:b', 'C1:a'], ['C1:a', 'P1:a'], ['C1:b', 'U1:b'], ['U1:b', 'GND:a']],
    },
  },
  sallenkey: {
    label: 'Sallen–Key low-pass, 1 kHz Butterworth (AC / Bode)',
    analysis: { mode: 'ac', fMin: 10, fMax: 100000 },
    ex: {
      comps: [
        ['U1', 'acsource', { amp: 1, freq: 1000 }, 0, 160, 90],
        ['R1', 'resistor', { R: 10000 }, 120, 60],
        ['R2', 'resistor', { R: 10000 }, 270, 60],
        ['C1', 'capacitor', { C: 2.25e-8 }, 270, -60],
        ['C2', 'capacitor', { C: 1.125e-8 }, 400, 160, 90],
        ['OP1', 'opamp', { A: 1e5, Vsat: 13.5 }, 470, 40],
        ['P1', 'probe', {}, 640, 60],
        ['GND', 'ground', {}, 200, 320],
      ],
      wires: [
        ['U1:a', 'R1:a'], ['R1:b', 'R2:a'], ['R1:b', 'C1:a'], ['R2:b', 'C2:a'], ['R2:b', 'OP1:inp'], ['C2:b', 'GND:a'],
        ['OP1:out', 'OP1:inn'], ['OP1:out', 'C1:b'], ['OP1:out', 'P1:a'], ['U1:b', 'GND:a'],
      ],
    },
  },
};

function build(id: ExampleId): Pick<CircuitState, 'nodes' | 'edges'> {
  const { ex } = EXAMPLES[id];
  const ids = new Map(ex.comps.map(([name]) => [name, uid('c')]));
  return {
    nodes: ex.comps.map(([name, kind, params, x, y, rot]) => ({
      id: ids.get(name)!,
      type: 'ccomp',
      position: { x, y },
      data: { kind, name, params: { ...DEFAULTS[kind], ...params }, rot: rot ?? 0 },
    })),
    edges: ex.wires.map(([a, b], i) => {
      const [na, pa] = a.split(':') as [string, string];
      const [nb, pb] = b.split(':') as [string, string];
      return { id: `w${i}${uid('')}`, type: 'wire', source: ids.get(na)!, sourceHandle: pa, target: ids.get(nb)!, targetHandle: pb };
    }),
  };
}

export const useCircuit = create<CircuitState>()(
  persist(
    (set, get) => ({
      ...build('led'),
      analysis: { mode: 'dc', tEnd: 0.05, steps: 2000, fromDC: false },
      loadSeq: 0,
      setAnalysis: (p) => set({ analysis: { ...get().analysis, ...p } }),
      resetStates: () => {
        dcStates = {};
        set({ nodes: [...get().nodes] });
      },
      onNodesChange: (c) => set({ nodes: applyNodeChanges(c, get().nodes) }),
      onEdgesChange: (c) => set({ edges: applyEdgeChanges(c, get().edges) }),
      onConnect: (c) => {
        if (!c.source || !c.target || (c.source === c.target && c.sourceHandle === c.targetHandle)) return;
        set({ edges: addEdge({ ...c, id: uid('w'), type: 'wire' }, get().edges) as CEdge[] });
      },
      addComponent: (kind, position) => {
        const node: CNode = {
          id: uid('c'),
          type: 'ccomp',
          position,
          data: { kind, name: nextName(get().nodes, kind), params: { ...DEFAULTS[kind] }, rot: 0 },
          selected: true,
        };
        set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), node] });
      },
      update: (id, patch) => set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) }),
      setParam: (id, key, value) => set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n)) }),
      // Rotating a connected part would leave its wires on the old terminal sides and route them in loops:
      // rotate about the centre and detach the wires instead, so the user reconnects them (undo restores them).
      lastRotate: null,
      rotate: (id) => {
        const n0 = get().nodes.find((n) => n.id === id);
        if (!n0) return;
        const w = n0.measured?.width ?? 0;
        const h = n0.measured?.height ?? 0;
        const position = { x: n0.position.x + (w - h) / 2, y: n0.position.y + (h - w) / 2 };
        const attached = get().edges.filter((e) => e.source === id || e.target === id);
        set({
          nodes: get().nodes.map((n) => (n.id === id ? { ...n, position, data: { ...n.data, rot: (((n.data.rot + 90) % 360) as Rot) } } : n)),
          edges: get().edges.filter((e) => !attached.includes(e)),
          lastRotate: { id, rot: n0.data.rot, position: n0.position, edges: attached },
        });
      },
      undoRotate: () => {
        const lr = get().lastRotate;
        if (!lr) return;
        set({
          nodes: get().nodes.map((n) => (n.id === lr.id ? { ...n, position: lr.position, data: { ...n.data, rot: lr.rot } } : n)),
          edges: [...get().edges, ...lr.edges.filter((e) => !get().edges.some((x) => x.id === e.id))],
          lastRotate: null,
        });
      },
      remove: (id) => set({ nodes: get().nodes.filter((n) => n.id !== id), edges: get().edges.filter((e) => e.source !== id && e.target !== id) }),
      load: (id) => {
        dcStates = {};
        const b = build(id);
        set({ ...b, analysis: { ...get().analysis, mode: 'dc', ...EXAMPLES[id].analysis }, loadSeq: get().loadSeq + 1 });
      },
      clear: () => set({ nodes: [], edges: [] }),
      snapshot: () => ({
        analysis: get().analysis,
        nodes: get().nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: get().edges.map(({ id, type, source, sourceHandle, target, targetHandle }) => ({ id, type, source, sourceHandle, target, targetHandle })),
      }),
      loadSheet: (p) => {
        const s = checkSheet(circuitSheet, p);
        if (!s) return false;
        dcStates = {};
        set({ nodes: (s.nodes as CNode[]).map((n) => ({ ...n, selected: false })), edges: s.edges as CEdge[], analysis: { ...get().analysis, ...s.analysis }, loadSeq: get().loadSeq + 1, lastRotate: null });
        return true;
      },
    }),
    {
      name: 'ts-circuit',
      version: 1,
      storage: createJSONStorage(() => safe),
      partialize: (s) => ({
        analysis: s.analysis,
        nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: s.edges.map(({ id, type, source, sourceHandle, target, targetHandle }) => ({ id, type, source, sourceHandle, target, targetHandle })),
      }),
    },
  ),
);

export function toCircuit(nodes: CNode[], edges: CEdge[]): CCircuit {
  return {
    components: nodes.map((n) => ({ id: n.id, kind: n.data.kind, name: n.data.name, params: n.data.params })),
    wires: edges.map((e) => ({ id: e.id, a: `${e.source}:${e.sourceHandle ?? 'a'}`, b: `${e.target}:${e.targetHandle ?? 'a'}` })),
  };
}

/** Device states (flip-flops, relays, fuses) carried from one DC solve to the next. */
let dcStates: DeviceStates = {};
let memo: { key: string; r: { circuit: CCircuit; result: CircuitResult } } | null = null;
function useDCSolution() {
  const nodes = useCircuit((s) => s.nodes);
  const edges = useCircuit((s) => s.edges);
  return useMemo(() => {
    const circuit = toCircuit(nodes, edges);
    const key = JSON.stringify(circuit);
    if (memo?.key === key) return memo.r;
    const result = solveCircuit(circuit, dcStates);
    dcStates = result.states;
    const r = { circuit, result };
    memo = { key, r };
    return r;
  }, [nodes, edges]);
}

/** The result shown on the sheet and in the tables: DC operating point, or the end of the transient run. */
export function useCircuitSolution() {
  const dc = useDCSolution();
  const tr = useTransient();
  return useMemo(() => (tr?.ok && tr.final ? { circuit: dc.circuit, result: tr.final } : dc), [dc, tr]);
}

let tmemo: { key: string; r: TransientResult } | null = null;
export function useTransient(): TransientResult | null {
  const nodes = useCircuit((s) => s.nodes);
  const edges = useCircuit((s) => s.edges);
  const a = useCircuit((s) => s.analysis);
  return useMemo(() => {
    if (a.mode !== 'tran') return null;
    const circuit = toCircuit(nodes, edges);
    const key = JSON.stringify([circuit, a]);
    if (tmemo?.key === key) return tmemo.r;
    const r = simulateTransient(circuit, a.tEnd, a.steps, a.fromDC);
    tmemo = { key, r };
    return r;
  }, [nodes, edges, a]);
}
