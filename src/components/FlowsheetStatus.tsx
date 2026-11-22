/** Flowsheet status in the header (simulation mode only; loaded with the flowsheet). */

import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { COMPONENTS } from '@/engine/components';
import { useBalance } from '@/store/balanceStore';
import { useFlowsheet } from '@/store/flowsheetStore';

export default function FlowsheetStatusGate() {
  const mode = useBalance((s) => s.mode);
  return mode === 'sim' ? <FlowsheetStatus /> : null;
}

function FlowsheetStatus() {
  const nodes = useFlowsheet((s) => s.nodes.length);
  const streams = useFlowsheet((s) => s.edges.length);
  const resolved = useFlowsheet((s) => s.edges.filter((e) => e.data?.resolved).length);
  const resetDemo = useFlowsheet((s) => s.resetDemo);
  const system = useFlowsheet((s) => s.system);
  const ms = useFlowsheet((s) => s.lastSolveMs);
  const errors = useFlowsheet((s) => s.nodes.filter((n) => n.data.diag?.status === 'error').length);
  const warnings = useFlowsheet((s) => s.nodes.filter((n) => n.data.diag?.status === 'warning').length);
  return (
    <>
      <span className="hidden font-mono text-[10px] text-plant-400 2xl:inline">
        <Stat label="UNITS" value={nodes} /> · <Stat label="STREAMS" value={`${resolved}/${streams}`} /> ·{' '}
        <Stat label="SYSTEM" value={`${COMPONENTS[system.A].name} / ${COMPONENTS[system.B].name}`} />
      </span>
      {(errors > 0 || warnings > 0) && (
        <span className="font-mono text-[10px]">
          {errors > 0 && <span className="text-signal-alarm">{errors} ERR </span>}
          {warnings > 0 && <span className="text-signal-vapor">{warnings} WARN</span>}
        </span>
      )}
      <span className="flex items-center gap-1.5 font-mono text-[10px] text-signal-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-ok shadow-[0_0_6px] shadow-signal-ok" />
        ENGINE ONLINE
        <span className="text-plant-500">· {ms.toFixed(1)} ms</span>
      </span>
      <button
        type="button"
        onClick={resetDemo}
        className="flex items-center gap-1.5 rounded border border-white/[0.07] px-2 py-1 font-mono text-[10px] text-plant-300 transition-colors hover:border-signal-liquid/40 hover:text-signal-liquid"
      >
        <RotateCcw className="h-3 w-3" /> RESET
      </button>
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span>
      <span className="text-plant-500">{label} </span>
      <span className="text-plant-200">{value}</span>
    </span>
  );
}
