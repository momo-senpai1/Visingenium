import { ArrowRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { FORMULAS, type Formula } from '@/lib/formulas';
import { t } from '@/i18n';
import { navigate, type Route } from '@/lib/route';
import { cn } from '@/lib/utils';

const SUBJECTS: Formula['subject'][] = ['Thermal separation', 'Heat & mass transfer', 'Thermodynamics', 'Fluid mechanics', 'Electrical circuits', 'Control engineering', 'Mechanics'];

export default function FormulasPage() {
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState<Formula['subject'] | 'all'>('all');
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return FORMULAS.filter((f) => (subject === 'all' || f.subject === subject) && words.every((w) => `${t(f.name)} ${f.name} ${t(f.topic)} ${f.topic} ${f.vars} ${t(f.vars)} ${f.tex}`.toLowerCase().includes(w)));
  }, [q, subject]);
  const groups = SUBJECTS.map((s) => ({ s, items: list.filter((f) => f.subject === s) })).filter((g) => g.items.length);
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-2 py-4">
      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded border border-white/[0.08] bg-plant-950/70 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-plant-500" />
          <input aria-label={t('Search formulas')} placeholder={t('Search: e.g. Nusselt, reflux, parallel, overshoot …')} value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-[12px] text-plant-100 outline-none" />
        </label>
        <div className="flex flex-wrap gap-1 text-[11px]">
          {(['all', ...SUBJECTS] as const).map((s) => (
            <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={cn('rounded px-2 py-1', subject === s ? 'bg-signal-liquid/15 text-signal-liquid' : 'text-plant-300 hover:bg-white/[0.04]')}>
              {t(s === 'all' ? 'All' : s)}
            </button>
          ))}
        </div>
      </div>
      {!groups.length && <p className="text-center text-[12px] text-plant-500">{t('No formula found.')}</p>}
      {groups.map((g) => (
        <section key={g.s} className="space-y-2">
          <h2 className="tag text-plant-400">{t(g.s)}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {g.items.map((f) => (
              <article key={f.name} className="glass space-y-1.5 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-plant-500">{t(f.topic)}</p>
                    <p className="text-[12px] font-medium text-plant-100">{t(f.name)}</p>
                  </div>
                  {f.route && (
                    <button type="button" onClick={() => navigate(f.route as Route)} title={t('Open the simulator')} className="flex shrink-0 items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-plant-400 hover:text-signal-liquid">
                      {t('Try it')} <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto text-[13px] text-plant-100">
                  <Tex block math={f.tex} />
                </div>
                {f.vars && <p className="text-[10px] leading-relaxed text-plant-400">{t(f.vars)}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
