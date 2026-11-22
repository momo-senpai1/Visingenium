/** Circuit component node, wire edge and canvas. */

import { ExportMenu } from '@/components/ExportMenu';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
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
import { useCallback, useEffect, type DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEVICES, type CKind, type CParams } from '@/engine/circuits/devices';
import { formatSI } from '@/engine/circuits/units';
import { t, useLang } from '@/i18n';
import { cn } from '@/lib/utils';
import { useCircuit, useCircuitSolution, type CNode, type Rot } from '@/store/circuitStore';
import { shapeOf } from './shapes';

export const CIRCUIT_DND = 'application/x-circuit-part';

/** Palette / inspector icon: the symbol scaled into a small box. */
export function SymbolIcon({ kind, params = {}, className }: { kind: CKind; params?: CParams; className?: string }) {
  const sh = shapeOf(kind, params);
  return (
    <svg viewBox={`-2 -2 ${sh.w + 4} ${sh.h + 4}`} className={cn('fill-none stroke-[2.2]', className)} aria-hidden>
      {sh.draw(params, {})}
    </svg>
  );
}

const comma = () => useLang.getState().lang !== 'en';

export function valueLabel(kind: CKind, p: CParams): string {
  const c = comma();
  const f = (v: number | undefined, u: string) => formatSI(v ?? 0, u, 3, c);
  switch (kind) {
    case 'resistor':
    case 'speaker':
      return f(p.R, 'Ω');
    case 'pot':
      return `${f(p.R, 'Ω')} · ${Math.round((p.pos ?? 0.5) * 100)} %`;
    case 'vsource':
      return f(p.V, 'V');
    case 'battery':
      return `${f(p.V, 'V')} · r ${f(p.r, 'Ω')}`;
    case 'acsource':
      return `${f(p.amp, 'V')} · ${f(p.freq, 'Hz')}`;
    case 'isource':
      return f(p.I, 'A');
    case 'led':
      return `${f(p.Vf, 'V')} · ${f(p.Inom, 'A')}`;
    case 'lamp':
      return `${f(p.Vnom, 'V')} / ${f(p.Pnom, 'W')}`;
    case 'capacitor':
      return f(p.C, 'F');
    case 'inductor':
      return f(p.L, 'H');
    case 'transformer':
      return `1 : ${p.ratio ?? 0.1}`;
    case 'fuse':
      return f(p.rating, 'A');
    case 'zener':
      return `U_Z ${f(p.Vz, 'V')}`;
    case 'ldr':
    case 'photodiode':
      return `${Math.round((p.light ?? 0.5) * 100)} % ${t('light')}`;
    case 'thermistor':
      return `${p.T ?? 25} °C`;
    case 'switch':
      return t(p.closed ? 'closed' : 'open');
    case 'npn':
    case 'pnp':
      return `β ${p.beta ?? 100}`;
    case 'vcvs':
    case 'cccs':
      return `× ${p.gain ?? 10}`;
    case 'vccs':
      return `${f(p.gain, 'S')}`;
    case 'ccvs':
      return `${f(p.gain, 'Ω')}`;
    case 'regulator':
      return `${p.Vreg ?? 5} V`;
    case 'clock':
      return f(p.freq, 'Hz');
    case 'relay':
      return `${f(p.Rcoil, 'Ω')}`;
    default:
      return '';
  }
}

const SIDE: Position[] = [Position.Left, Position.Top, Position.Right, Position.Bottom];

/** Rotate a pin position (x, y) in a w×h box clockwise by rot. */
function rotPin(x: number, y: number, w: number, h: number, rot: Rot): [number, number] {
  if (rot === 90) return [h - y, x];
  if (rot === 180) return [w - x, h - y];
  if (rot === 270) return [y, w - x];
  return [x, y];
}

const TOGGLE: readonly CKind[] = ['switch', 'spdt', 'dpdt', 'logicIn'];
const MOMENTARY: readonly CKind[] = ['pushNO', 'pushNC'];

function CompNode({ id, data, selected }: NodeProps<CNode>) {
  const { result } = useCircuitSolution();
  const setParam = useCircuit((s) => s.setParam);
  const updateInternals = useUpdateNodeInternals();
  const r = result.comps.get(id);
  const c = comma();
  const sh = shapeOf(data.kind, data.params);
  const rot = data.kind === 'ground' ? 0 : data.rot;
  const vertical = rot === 90 || rot === 270;
  const W = vertical ? sh.h : sh.w;
  const Hh = vertical ? sh.w : sh.h;
  // re-measure the handles once the rotated layout is painted (measuring in the same tick picks up the old positions)
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => updateInternals(id));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [id, rot, sh.w, sh.h, updateInternals]);
  const pins = DEVICES[data.kind] ? Object.entries(sh.pins) : [];
  const toggle = () => {
    if (data.kind === 'switch') setParam(id, 'closed', !data.params.closed);
    else setParam(id, 'on', !data.params.on);
  };
  const k = data.kind;
  const reading =
    r && result.ok && k !== 'ground'
      ? k === 'voltmeter'
        ? formatSI(r.V, 'V', 4, c)
        : k === 'ammeter'
          ? formatSI(r.I, 'A', 4, c)
          : k === 'probe'
            ? formatSI(r.V, 'V', 4, c)
            : r.info && !['resistor', 'lamp', 'led', 'diode'].includes(k)
              ? r.info.split(' · ')[0]!
              : pins.length === 2
                ? `${formatSI(Math.abs(r.I), 'A', 3, c)} · ${formatSI(Math.abs(r.V), 'V', 3, c)}`
                : ''
      : '';
  return (
    <div className={cn('relative rounded-md', selected && 'ring-1 ring-signal-liquid/60')} style={{ width: W, height: Hh }}>
      <svg
        viewBox={`0 0 ${sh.w} ${sh.h}`}
        className={cn('absolute left-1/2 top-1/2 fill-none stroke-[1.6] text-plant-200', r?.warn ? 'stroke-signal-alarm text-signal-alarm' : 'stroke-plant-200')}
        style={{ width: sh.w, height: sh.h, transform: `translate(-50%,-50%) rotate(${rot}deg)`, overflow: 'visible' }}
        aria-hidden
      >
        {sh.draw(data.params, { level: r?.level, logic: k === 'relay' ? r?.info?.startsWith('energised') : r?.logic })}
      </svg>
      {(TOGGLE.includes(k) || MOMENTARY.includes(k)) && (
        <button
          type="button"
          aria-label={t('Toggle {name}', { name: data.name })}
          className="nodrag absolute inset-[18%] cursor-pointer rounded hover:bg-signal-vapor/10"
          onClick={TOGGLE.includes(k) ? toggle : undefined}
          onPointerDown={MOMENTARY.includes(k) ? () => setParam(id, 'on', true) : undefined}
          onPointerUp={MOMENTARY.includes(k) ? () => setParam(id, 'on', false) : undefined}
          onPointerLeave={MOMENTARY.includes(k) ? () => data.params.on && setParam(id, 'on', false) : undefined}
        />
      )}
      {pins.map(([pin, [x, y]]) => {
        const [px, py] = rotPin(x, y, sh.w, sh.h, rot);
        const side = px <= 0.5 ? 0 : py <= 0.5 ? 1 : px >= W - 0.5 ? 2 : 3;
        return (
          <Handle
            key={pin}
            type="source"
            id={pin}
            position={SIDE[side]!}
            title={pin}
            style={{ left: px, top: py, right: 'auto', bottom: 'auto', transform: 'translate(-50%,-50%)' }}
          />
        );
      })}
      {k !== 'ground' && (
        <div
          className={cn(
            'pointer-events-none absolute whitespace-nowrap font-mono text-[9px] leading-[12px]',
            vertical || pins.length > 2 ? 'left-full top-1/2 ml-2 -translate-y-1/2' : 'left-1/2 top-full -translate-x-1/2 text-center',
          )}
        >
          <div className="font-semibold text-plant-100">
            {data.name} <span className="font-normal text-plant-400">{valueLabel(k, data.params)}</span>
          </div>
          {reading && <div className={r?.warn ? 'text-signal-alarm' : 'text-signal-vapor'}>{reading}</div>}
        </div>
      )}
    </div>
  );
}

function WireEdge(props: EdgeProps) {
  return <SmoothStepEdge {...props} pathOptions={{ borderRadius: 2, offset: 12 }} style={{ stroke: props.selected ? 'rgb(var(--sig-liquid))' : 'rgb(var(--plant-300))', strokeWidth: 1.6 }} />;
}

const nodeTypes = { ccomp: CompNode };
const edgeTypes = { wire: WireEdge };

export function CircuitCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addComponent } = useCircuit(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges, onNodesChange: s.onNodesChange, onEdgesChange: s.onEdgesChange, onConnect: s.onConnect, addComponent: s.addComponent })),
  );
  const { screenToFlowPosition, fitView } = useReactFlow();
  const loadSeq = useCircuit((s) => s.loadSeq);
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const id = requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1.2 }));
    return () => cancelAnimationFrame(id);
  }, [initialized, loadSeq, fitView]);
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(CIRCUIT_DND);
      if (!(kind in DEVICES)) return;
      addComponent(kind as CKind, screenToFlowPosition({ x: e.clientX - 48, y: e.clientY - 20 }));
    },
    [addComponent, screenToFlowPosition],
  );
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
        connectionMode={ConnectionMode.Loose}
        onDrop={onDrop}
        onDragOver={onDragOver}
        defaultEdgeOptions={{ type: 'wire' }}
        connectionLineStyle={{ stroke: 'rgb(var(--sig-vapor))', strokeWidth: 1.5 }}
        deleteKeyCode={['Backspace', 'Delete']}
        snapToGrid
        snapGrid={[10, 10]}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background id="dots" variant={BackgroundVariant.Dots} gap={20} size={1.2} color="rgba(148,163,184,0.18)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[9px] tracking-[0.2em] text-plant-500">{t('CIRCUIT')}</div>
      <ExportMenu title={t('Circuit')} resultsSelector='[data-export="circuit-results"]' />
    </div>
  );
}
