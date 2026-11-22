/** Block-diagram simulator: canvas, block nodes and the shared simulation hook. */

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  SmoothStepEdge,
  useNodesInitialized,
  useReactFlow,
  useUpdateNodeInternals,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, type DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Tex } from '@/components/balance/Tex';
import { ExportMenu } from '@/components/ExportMenu';
import { nf } from '@/components/mechanics/common';
import { nInputs, type SimBlock, type SimBlockData, type SimResult, type SimWire } from '@/engine/control/blocksim';
import { BLOCK_INFO } from '@/engine/control/loop';
import { t } from '@/i18n';
import { runSimulation } from '@/lib/guard';
import { cn } from '@/lib/utils';
import { SIM_DND, useControlSim, type SNode } from '@/store/controlSimStore';

// ---------------------------------------------------------------------------
// simulation shared by the canvas (scope thumbnails) and the result panel

let cache: { key: string; r: SimResult; blocks: SimBlock[]; wires: SimWire[] } | null = null;
export function useSimulation() {
  const { nodes, edges, settings } = useControlSim(useShallow((s) => ({ nodes: s.nodes, edges: s.edges, settings: s.settings })));
  const blocks: SimBlock[] = nodes.map((n) => ({ id: n.id, data: n.data }));
  const wires: SimWire[] = edges.filter((e) => e.targetHandle).map((e) => ({ source: e.source, target: e.target, targetHandle: e.targetHandle! }));
  const key = JSON.stringify([blocks, wires, settings.tEnd, settings.steps]);
  if (cache?.key !== key) {
    cache = { key, r: runSimulation(blocks, wires, settings.tEnd, settings.steps), blocks, wires };
  }
  return cache;
}

// ---------------------------------------------------------------------------
// block shapes

const SIZE: Record<SimBlockData['kind'], [number, number]> = { source: [64, 44], sum: [36, 36], gain: [60, 44], tf: [132, 60], filter: [120, 56], sat: [60, 44], scope: [84, 64] };
export const blockSize = (d: SimBlockData) => SIZE[d.kind];

function WaveIcon({ wave }: { wave: SimBlockData['wave'] }) {
  const p: Record<string, string> = {
    step: 'M4 22H14V8H36',
    ramp: 'M4 22H12L36 6',
    sine: 'M4 15C9 3 13 3 16 15S24 27 28 15S34 5 36 9',
    square: 'M4 22H10V8H18V22H26V8H34V22',
    pulse: 'M4 22H12V8H22V22H36',
    const: 'M4 12H36',
    noise: 'M4 15L7 10L9 18L12 8L15 20L18 11L21 17L24 9L27 19L30 12L33 16L36 13',
  };
  return (
    <svg viewBox="0 0 40 28" className="h-6 w-10 fill-none stroke-current stroke-[1.6]">
      <path d={p[wave ?? 'step']} />
    </svg>
  );
}

const PARAM_SHORT: Record<string, string> = { K: 'K', T: 'T', Ti: 'Tᵢ', Td: 'T_d', zeta: 'D', n: 'n', alpha: 'α', Tt: 'Tₜ' };

/** Handle positions (fractions of width/height) of a block's inputs. */
function inputSpots(d: SimBlockData): { pos: Position; x: number; y: number }[] {
  const n = nInputs(d);
  const L = d.flip ? Position.Right : Position.Left;
  const lx = d.flip ? 1 : 0;
  if (d.kind === 'sum') {
    const spots = [
      { pos: L, x: lx, y: 0.5 },
      { pos: Position.Bottom, x: 0.5, y: 1 },
      { pos: Position.Top, x: 0.5, y: 0 },
      { pos: L, x: lx, y: 0.85 },
    ];
    return spots.slice(0, n);
  }
  return Array.from({ length: n }, (_, k) => ({ pos: L, x: lx, y: (k + 1) / (n + 1) }));
}

function BlockNode({ id, data: d, selected }: NodeProps<SNode>) {
  const sim = useSimulation();
  const update = useUpdateNodeInternals();
  const [w, h] = SIZE[d.kind];
  const n = nInputs(d);
  useEffect(() => {
    const r = requestAnimationFrame(() => update(id));
    return () => cancelAnimationFrame(r);
  }, [id, d.flip, n, update]);
  const spots = inputSpots(d);
  const outPos = d.flip ? Position.Left : Position.Right;
  const box = cn('absolute inset-0 border bg-plant-900', selected ? 'border-signal-liquid' : 'border-plant-300/70');
  let body: JSX.Element;
  if (d.kind === 'source') {
    body = (
      <div className={cn(box, 'grid place-items-center rounded-md text-signal-vapor')}>
        <WaveIcon wave={d.wave} />
      </div>
    );
  } else if (d.kind === 'sum') {
    const signs = d.signs ?? '+-';
    body = (
      <>
        <div className={cn(box, 'grid place-items-center rounded-full text-[15px] text-plant-100')}>Σ</div>
        {spots.map((s, k) => (
          <span
            key={k}
            className="pointer-events-none absolute font-mono text-[11px] font-bold text-signal-heat"
            style={{ left: s.x * w + (s.pos === Position.Left ? -12 : s.pos === Position.Right ? 4 : 5), top: s.y * h + (s.pos === Position.Bottom ? 0 : s.pos === Position.Top ? -14 : -15) }}
          >
            {signs[k] === '-' ? '−' : '+'}
          </span>
        ))}
      </>
    );
  } else if (d.kind === 'gain') {
    body = (
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible" style={{ transform: d.flip ? 'scaleX(-1)' : undefined }}>
        <path d={`M1 1L${w - 1} ${h / 2}L1 ${h - 1}Z`} className={cn('fill-plant-900', selected ? 'stroke-signal-liquid' : 'stroke-plant-300/70')} strokeWidth={1.2} />
        <text x={w * 0.33} y={h / 2 + 4} textAnchor="middle" className="fill-plant-100 font-mono text-[11px]" style={{ transform: d.flip ? 'scaleX(-1)' : undefined, transformBox: 'fill-box', transformOrigin: 'center' }}>
          {nf(d.K ?? 1, 3)}
        </text>
      </svg>
    );
  } else if (d.kind === 'tf') {
    const s = d.spec ?? { kind: 'PT1' };
    const info = BLOCK_INFO[s.kind];
    body = (
      <div className={cn(box, 'flex flex-col items-center justify-center rounded px-1 text-plant-100')}>
        <div className="text-[11px] leading-none">
          <Tex math={info.tex} />
        </div>
        <div className="mt-1 truncate font-mono text-[8px] text-plant-400">
          {s.kind === 'custom' ? t('custom') : info.params.map((p) => `${PARAM_SHORT[p] ?? p}=${nf((s[p] as number) ?? 0, 3)}`).join(' ')}
        </div>
      </div>
    );
  } else if (d.kind === 'filter') {
    const ft = d.ftype ?? 'lowpass';
    const curve: Record<string, string> = { lowpass: 'M3 8H18Q24 8 30 22H37', highpass: 'M3 22H10Q16 8 22 8H37', bandpass: 'M3 22Q12 22 16 8H24Q28 22 37 22', bandstop: 'M3 8H14Q18 8 20 22Q22 8 26 8H37' };
    const AP: Record<string, string> = { butterworth: 'Butterworth', chebyshev: 'Chebyshev', bessel: 'Bessel' };
    body = (
      <div className={cn(box, 'flex flex-col items-center justify-center rounded px-1')}>
        <svg viewBox="0 0 40 28" className="h-6 w-10 fill-none stroke-[1.6]">
          <path d="M3 25H37" className="stroke-plant-500" strokeWidth={0.8} />
          <path d={curve[ft]} className="stroke-signal-liquid" />
        </svg>
        <div className="mt-0.5 truncate font-mono text-[8px] text-plant-400">
          {AP[d.approx ?? 'butterworth']} n={d.order ?? 2} · {nf(d.fc ?? 1, 3)} Hz
        </div>
      </div>
    );
  } else if (d.kind === 'sat') {
    body = (
      <div className={cn(box, 'grid place-items-center rounded')}>
        <svg viewBox="0 0 40 28" className="h-7 w-10 fill-none stroke-[1.6]">
          <path d="M2 14H38M20 2V26" className="stroke-plant-500" strokeWidth={0.8} />
          <path d="M4 22H13L27 6H36" className="stroke-signal-vapor" />
        </svg>
      </div>
    );
  } else {
    const sc = sim.r.scopes.find((x) => x.id === id);
    const all = sc?.traces.flatMap((tr) => tr.data) ?? [];
    const lo = Math.min(0, ...all);
    const hi = Math.max(1e-9, ...all);
    const COLORS = ['rgb(var(--sig-liquid))', 'rgb(var(--plant-400))', 'rgb(var(--sig-vapor))', 'rgb(var(--sig-heat))'];
    body = (
      <div className={cn(box, 'rounded p-1')}>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-full w-full rounded-sm bg-plant-950">
          {sc?.traces.map((tr, k) => {
            const step = Math.max(1, Math.floor(tr.data.length / 120));
            const pts = tr.data.filter((_, i) => i % step === 0).map((v, i, a) => `${(i / Math.max(1, a.length - 1)) * 100},${58 - ((v - lo) / (hi - lo)) * 56}`);
            return <polyline key={k} points={pts.join(' ')} fill="none" stroke={COLORS[k % 4]} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
      </div>
    );
  }
  return (
    <div className="relative" style={{ width: w, height: h }}>
      {body}
      {spots.map((s, k) => (
        <Handle key={k} type="target" id={`in${k}`} position={s.pos} className="!h-2 !w-2 !border-plant-300 !bg-plant-950" style={{ left: s.x * w, top: s.y * h, right: 'auto', bottom: 'auto', transform: 'translate(-50%,-50%)' }} />
      ))}
      {d.kind !== 'scope' && (
        <Handle type="source" id="out" position={outPos} className="!h-2 !w-2 !border-signal-vapor !bg-signal-vapor" style={{ left: d.flip ? 0 : w, top: h / 2, right: 'auto', bottom: 'auto', transform: 'translate(-50%,-50%)' }} />
      )}
      <div className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-plant-200', d.kind === 'sum' ? 'top-full mt-3' : 'top-full mt-0.5')}>{d.name}</div>
    </div>
  );
}

function SigEdge(props: EdgeProps) {
  return <SmoothStepEdge {...props} pathOptions={{ borderRadius: 4, offset: 18 }} style={{ stroke: props.selected ? 'rgb(var(--sig-liquid))' : 'rgb(var(--plant-300))', strokeWidth: 1.5 }} />;
}

const nodeTypes = { cblock: BlockNode };
const edgeTypes = { sig: SigEdge };

export function SimCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addBlock } = useControlSim(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges, onNodesChange: s.onNodesChange, onEdgesChange: s.onEdgesChange, onConnect: s.onConnect, addBlock: s.addBlock })),
  );
  const loadSeq = useControlSim((s) => s.loadSeq);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const r = requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 1.3 }));
    return () => cancelAnimationFrame(r);
  }, [initialized, loadSeq, fitView]);
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData(SIM_DND);
      if (id) addBlock(id, screenToFlowPosition({ x: e.clientX - 40, y: e.clientY - 25 }));
    },
    [addBlock, screenToFlowPosition],
  );
  const defaultEdgeOptions = useMemo(() => ({ type: 'sig' }), []);
  return (
    <div className="glass relative min-h-0 flex-1 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={{ stroke: 'rgb(var(--sig-vapor))', strokeWidth: 1.5 }}
        deleteKeyCode={['Backspace', 'Delete']}
        snapToGrid
        snapGrid={[10, 10]}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.3 }}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background id="cdots" variant={BackgroundVariant.Dots} gap={20} size={1.2} color="rgba(148,163,184,0.18)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[9px] tracking-[0.2em] text-plant-500">{t('BLOCK DIAGRAM')}</div>
      <ExportMenu title={t('Block diagram')} resultsSelector='[data-export="sim-results"]' />
    </div>
  );
}
