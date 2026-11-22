import { ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import { fieldCls, nf } from '@/components/mechanics/common';
import { t } from '@/i18n';
import { convert, QUANTITIES } from '@/lib/units';
import { cn } from '@/lib/utils';

const parse = (s: string) => {
  const v = Number(s.trim().replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(v) ? v : null;
};
/** Readable number: plain for moderate values, otherwise scientific notation. */
const show = (v: number) => (!Number.isFinite(v) ? '—' : v !== 0 && (Math.abs(v) >= 1e7 || Math.abs(v) < 1e-4) ? v.toExponential(5).replace('e', ' · 10^').replace('+', '') : nf(v, 6));

export default function UnitsPage() {
  const [qid, setQid] = useState('pressure');
  const q = QUANTITIES.find((x) => x.id === qid)!;
  const [from, setFrom] = useState(q.units[1]!.id);
  const [text, setText] = useState('1');
  const fromU = q.units.find((u) => u.id === from) ?? q.units[0]!;
  const v = parse(text);
  return (
    <div className="mx-auto grid max-w-5xl gap-3 px-2 py-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label={t('Quantity')} className="glass h-fit p-2">
        <p className="tag px-2 pb-1 text-plant-500">{t('Quantity')}</p>
        {QUANTITIES.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === qid}
            onClick={() => (setQid(x.id), setFrom(x.units[1]?.id ?? x.units[0]!.id))}
            className={cn('block w-full rounded px-2 py-1 text-left text-[12px]', x.id === qid ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-200 hover:bg-white/[0.04]')}
          >
            {t(x.label)}
          </button>
        ))}
      </nav>
      <section className="glass space-y-3 p-4">
        <h1 className="text-sm font-semibold text-plant-100">{t(q.label)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label={t('Value')} className={cn(fieldCls, 'w-40 text-[13px]')} value={text} onChange={(e) => setText(e.target.value)} />
          <select aria-label={t('From unit')} className={cn(fieldCls, 'w-48 text-[13px]')} value={fromU.id} onChange={(e) => setFrom(e.target.value)}>
            {q.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <ArrowLeftRight className="h-4 w-4 text-plant-500" />
          <span className="text-[11px] text-plant-400">{t('all units below')}</span>
        </div>
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-white/[0.04]">
            {q.units.map((u) => (
              <tr
                key={u.id}
                onClick={() => {
                  if (v !== null) setText(String(Number(convert(v, fromU, u).toPrecision(8))));
                  setFrom(u.id);
                }}
                className={cn('cursor-pointer hover:bg-white/[0.03]', u.id === fromU.id && 'text-signal-liquid')}
              >
                <td className="w-48 py-1.5 pr-3 text-plant-400">{u.label}</td>
                <td className="py-1.5 text-right font-mono text-plant-100">{v === null ? '—' : show(convert(v, fromU, u))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.id === 'temperature' && <p className="text-[10px] text-plant-500">{t('Temperatures have an offset (0 °C = 273.15 K). For temperature differences use "Temperature difference": 1 K = 1 °C.')}</p>}
        <p className="text-[10px] text-plant-500">{t('Click a unit in the list to convert from it. Decimal comma or point both work.')}</p>
      </section>
    </div>
  );
}
