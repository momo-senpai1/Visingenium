import { useEffect, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { fieldCls, Num } from '@/components/mechanics/common';
import { BLOCK_INFO, type BlockKind, type BlockSpec } from '@/engine/control/loop';
import { t } from '@/i18n';
import { ControllerHelp } from './ControllerHelp';
import { sanitizeSpec } from '@/lib/guard';

const PARAM_LABEL: Record<string, string> = { K: 'K', T: 'T [s]', Ti: 'T_i [s]', Td: 'T_d [s]', zeta: 'D (ζ)', n: 'n', alpha: 'α', Tt: 'T_t [s]' };

/**
 * `extras` (control-loop page only): 'ideal' offers the ideal PD/PID without derivative filter,
 * 'all' additionally a dead time on a custom block (b(s)/a(s)·e^{−sT_t}, a pure dead time with b = a = 1).
 */
export function SpecEditor({ spec, onChange: rawChange, kinds, extras }: { spec: BlockSpec; onChange: (s: BlockSpec) => void; kinds: BlockKind[]; extras?: 'ideal' | 'all' }) {
  // keep parameters in the range the solvers handle (e.g. integer order n ≤ 20)
  const onChange = (s: BlockSpec) => rawChange(sanitizeSpec(s));
  const info = BLOCK_INFO[spec.kind];
  const [numText, setNumText] = useState((spec.num ?? [1]).slice().reverse().join(' '));
  const [denText, setDenText] = useState((spec.den ?? [1, 1]).slice().reverse().join(' '));
  const parse = (s: string) =>
    s
      .trim()
      .split(/[\s;]+/)
      .map((x) => Number(x.replace(',', '.')))
      .filter((x) => Number.isFinite(x))
      .reverse();
  // a loaded example replaces num/den from outside: show it (but leave text the user is typing alone)
  const numKey = JSON.stringify(spec.num ?? [1]);
  const denKey = JSON.stringify(spec.den ?? [1, 1]);
  useEffect(() => {
    if (JSON.stringify(parse(numText)) !== numKey) setNumText((spec.num ?? [1]).slice().reverse().join(' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numKey]);
  useEffect(() => {
    if (JSON.stringify(parse(denText)) !== denKey) setDenText((spec.den ?? [1, 1]).slice().reverse().join(' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denKey]);
  return (
    <div className="space-y-1.5">
      <select aria-label={t('Block type')} className={fieldCls} value={spec.kind} onChange={(e) => onChange({ ...defaultsFor(e.target.value as BlockKind) })}>
        {kinds.map((k) => (
          <option key={k} value={k}>
            {t(BLOCK_INFO[k].label)}
          </option>
        ))}
      </select>
      <div className="text-[12px] text-plant-200">
        <Tex math={info.tex} />
      </div>
      {spec.kind === 'custom' ? (
        <div className="space-y-1 text-[10px] text-plant-400">
          <label className="block">
            {t('Numerator (highest power first)')}
            <input className={fieldCls} value={numText} onChange={(e) => (setNumText(e.target.value), onChange({ ...spec, num: parse(e.target.value) }))} />
          </label>
          <label className="block">
            {t('Denominator (highest power first)')}
            <input className={fieldCls} value={denText} onChange={(e) => (setDenText(e.target.value), onChange({ ...spec, den: parse(e.target.value) }))} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {info.params.map((p) => (
            <label key={p} className="text-[9px] uppercase tracking-wider text-plant-500">
              {PARAM_LABEL[p] ?? p}
              <Num ariaLabel={p} value={(spec[p] as number) ?? 0} onChange={(v) => onChange({ ...spec, [p]: v })} />
            </label>
          ))}
        </div>
      )}
      {extras && (spec.kind === 'PD' || spec.kind === 'PID') && (
        <label className="flex items-center gap-1.5 text-[10px] text-plant-400">
          <input type="checkbox" checked={!!(spec as BlockSpec & { ideal?: boolean }).ideal} onChange={(e) => onChange({ ...spec, ideal: e.target.checked } as BlockSpec)} />
          {t('ideal (no derivative filter), as in the exams')}
        </label>
      )}
      {extras === 'all' && spec.kind === 'custom' && (
        <label className="block text-[9px] uppercase tracking-wider text-plant-500">
          {t('Dead time T_t [s] (e^(−sT_t); numerator = denominator = 1 gives a pure dead time)')}
          <Num ariaLabel="Tt" value={spec.Tt ?? 0} onChange={(v) => onChange({ ...spec, Tt: Math.max(0, v) })} />
        </label>
      )}
      <ControllerHelp kind={spec.kind} />
    </div>
  );
}

export const ALL: BlockKind[] = ['P', 'I', 'PI', 'PD', 'PID', 'lead', 'PT1', 'PT2', 'PTn', 'IT1', 'PTt', 'D', 'custom'];
export function defaultsFor(kind: BlockKind): BlockSpec {
  const d: Record<BlockKind, BlockSpec> = {
    P: { kind, K: 1 },
    I: { kind, K: 1 },
    PI: { kind, K: 1, Ti: 1 },
    PD: { kind, K: 1, Td: 0.2 },
    PID: { kind, K: 1, Ti: 1, Td: 0.2 },
    lead: { kind, K: 1, T: 1, alpha: 0.1 },
    PT1: { kind, K: 1, T: 1 },
    PT2: { kind, K: 1, T: 1, zeta: 0.5 },
    PTn: { kind, K: 1, T: 1, n: 3 },
    IT1: { kind, K: 1, T: 1 },
    PTt: { kind, K: 1, T: 1, Tt: 0.5 },
    D: { kind, K: 1, T: 0.1 },
    custom: { kind, num: [1], den: [1, 1] },
  };
  return d[kind];
}
