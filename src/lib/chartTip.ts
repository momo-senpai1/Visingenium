/** Props Recharts passes to a custom tooltip (only the fields our tooltips read). */
export interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown; value?: unknown; name?: unknown; dataKey?: unknown }>;
  label?: unknown;
}
