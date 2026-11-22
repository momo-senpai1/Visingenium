import { ReactFlowProvider } from '@xyflow/react';
import { CircuitCanvas } from '@/components/circuits/CircuitCanvas';
import { CircuitInspector, CircuitPalette, CircuitResults } from '@/components/circuits/CircuitPanels';

export default function CircuitsPage() {
  return (
    <ReactFlowProvider>
      <div className="flex h-full min-h-0 gap-2">
        <CircuitPalette />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <CircuitCanvas />
          <CircuitResults />
        </div>
        <CircuitInspector />
      </div>
    </ReactFlowProvider>
  );
}
