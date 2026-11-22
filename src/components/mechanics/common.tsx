/** Shared pieces for the mechanics pages: number fields, persistence, diagrams. */

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StateStorage } from 'zustand/middleware';
import { axisTick, VIZ } from '@/components/analysis/vizTokens';
import { t, useLang } from '@/i18n';
import { cn } from '@/lib/utils';

export const safeStorage: StateStorage = {
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

const commaLang = () => useLang.getState().lang !== 'en';
/** Display a number with up to `d` decimals (trailing zeros dropped), decimal comma in DE/KU. */
export function nf(v: number, d = 3): string {
  if (!Number.isFinite(v)) return '—';
  const s = String(Number(v.toFixed(d)) || 0);
  return commaLang() ? s.replace('.', ',') : s;
}
const parse = (s: string) => {
  const v = Number(s.trim().replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(v) ? null : v;
};

export const fieldCls = 'w-full min-w-0 rounded border border-white/[0.08] bg-plant-950/70 px-1.5 py-1 font-mono text-[11px] text-plant-100 outline-none focus:border-signal-heat/50';

/** Compact number input accepting comma or point decimals. */
export function Num({ value, onChange, ariaLabel, className }: { value: number; onChange: (v: number) => void; ariaLabel: string; className?: string }) {
  const [text, setText] = useState(nf(value, 6));
  useEffect(() => {
    setText((cur) => (parse(cur) === value ? cur : nf(value, 6)));
  }, [value]);
  return (
    <input
      aria-label={ariaLabel}
      inputMode="decimal"
      className={cn(fieldCls, className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parse(e.target.value);
        if (v !== null) onChange(v);
      }}
    />
  );
}

/** Labelled row: label · input · unit. */
export function NumRow({ label, unit, value, onChange }: { label: string; unit?: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_90px_40px] items-center gap-2 text-[11px] text-plant-300">
      <span className="truncate">{label}</span>
      <Num value={value} onChange={onChange} ariaLabel={label} />
      <span className="font-mono text-[10px] text-plant-500">{unit}</span>
    </label>
  );
}

/** Editable list: header row of column names, one row per item, add button. */
export function ListEditor<T extends { id: string }>({
  items,
  cols,
  render,
  onAdd,
  onRemove,
  addLabel,
}: {
  items: T[];
  cols: string[];
  render: (item: T) => ReactNode[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
}) {
  const grid = { gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr)) 22px` };
  return (
    <div className="space-y-1">
      {items.length > 0 && (
        <div className="grid gap-1 text-[9px] uppercase tracking-wider text-plant-500" style={grid}>
          {cols.map((c) => (
            <span key={c} className="truncate">
              {c}
            </span>
          ))}
          <span />
        </div>
      )}
      {items.map((it) => (
        <div key={it.id} className="grid items-center gap-1" style={grid}>
          {render(it)}
          <button type="button" aria-label={t('Delete')} onClick={() => onRemove(it.id)} className="grid h-6 w-6 place-items-center rounded text-plant-500 hover:text-signal-alarm">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="flex items-center gap-1 pt-0.5 text-[11px] text-signal-heat hover:underline">
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );
}

let idSeq = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(idSeq++).toString(36)}`;

/** Filled diagram of an internal-force curve. */
export function Diagram({
  data,
  dataKey,
  label,
  unit,
  color,
  reversed = false,
  height = 150,
  xMax,
  digits = 2,
}: {
  data: Record<string, number>[];
  dataKey: string;
  label: string;
  unit: string;
  color: string;
  reversed?: boolean;
  height?: number;
  xMax: number;
  digits?: number;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] text-plant-300">
        {label} <span className="text-plant-500">[{unit}]</span>
        {reversed && <span className="ml-2 text-plant-500">{t('(positive downward)')}</span>}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={VIZ.grid} />
          <XAxis type="number" dataKey="x" domain={[0, xMax]} tick={axisTick} stroke={VIZ.axis} tickLine={false} tickFormatter={(v: number) => nf(v, 2)} />
          <YAxis reversed={reversed} tick={axisTick} stroke={VIZ.axis} tickLine={false} width={48} tickFormatter={(v: number) => nf(v, digits)} />
          <ReferenceLine y={0} stroke={VIZ.axis} />
          <Area type="linear" dataKey={dataKey} stroke={color} strokeWidth={1.8} fill={color} fillOpacity={0.18} isAnimationActive={false} baseValue={0} />
          <Tooltip
            contentStyle={{ background: 'rgb(var(--plant-950))', border: '1px solid rgb(var(--white)/0.1)', fontSize: 10 }}
            formatter={(raw) => { const v = Number(raw); return [`${nf(v, digits + 1)} ${unit}`, label]; }}
            labelFormatter={(raw) => { const l = Number(raw); return `x = ${nf(l, 3)} m`; }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Card({ title, children, aside, className }: { title: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cn('glass p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.05] pb-1.5">
        <p className="tag text-plant-400">{t(title)}</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const MECH = {
  load: 'rgb(var(--sig-alarm))',
  reaction: 'rgb(var(--sig-ok))',
  beam: 'rgb(var(--plant-200))',
};
