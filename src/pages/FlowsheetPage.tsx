/** Flowsheet: process simulation or balance task (loaded on demand). */

import { ReactFlowProvider } from '@xyflow/react';
import { AnalysisDock } from '@/components/analysis/AnalysisDock';
import { BalanceCanvas } from '@/components/balance/BalanceGraph';
import { BalanceInspector } from '@/components/balance/BalanceInspector';
import { BalancePalette } from '@/components/balance/BalancePalette';
import { BalanceResults } from '@/components/balance/BalanceResults';
import { FlowCanvas } from '@/components/FlowCanvas';
import { Inspector } from '@/components/Inspector';
import { Palette } from '@/components/Palette';
import { useBalance } from '@/store/balanceStore';

export default function FlowsheetPage() {
  return (
    <ReactFlowProvider>
      <Flowsheet />
    </ReactFlowProvider>
  );
}

function Flowsheet() {
  const mode = useBalance((s) => s.mode);
  return mode === 'task' ? (
    <main className="relative flex min-h-0 flex-1 gap-2">
      <BalancePalette />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <BalanceCanvas />
        <BalanceResults />
      </div>
      <BalanceInspector />
    </main>
  ) : (
    <main className="relative flex min-h-0 flex-1 gap-2">
      <Palette />
      {/* canvas on top, the column analysis docks underneath when a column is selected */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <FlowCanvas />
        <AnalysisDock />
      </div>
      <Inspector />
    </main>
  );
}
