import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, newId, nf, Num, safeStorage } from '@/components/mechanics/common';
import { Kpi } from '@/components/workbench/controls';
import { bode, freq, margins, mul, tf, tfTex, type Poly, type TF } from '@/engine/control/poly';
import { t } from '@/i18n';
import { Segmented } from '@/components/ui/segmented';
import { ParamSlider } from '@/components/ParamSlider';
import { PhasorPlot } from '@/components/ee/common';

type FKind = 'gain' | 'int' | 'diff' | 'pole' | 'zero' | 'zeroR' | 'poleR' | 'pole2' | 'zero2' | 'delay';
interface Factor {
  id: string;
  kind: FKind;
  /** gain K, corner frequency ω [1/s], damping ζ, order n, dead time Tt */
  v: number;
  zeta?: number;
  n?: number;
}

const KIND_INFO: Record<FKind, { label: string; tex: (f: Factor) => string; vLabel: string }> = {
  gain: { label: 'Gain K', vLabel: 'K', tex: (f) => `${nf(f.v, 4)}` },
  int: { label: 'Integrator 1/sⁿ', vLabel: '', tex: (f) => `\\frac{1}{s${(f.n ?? 1) > 1 ? `^{${f.n}}` : ''}}` },
  diff: { label: 'Differentiator sⁿ', vLabel: '', tex: (f) => `s${(f.n ?? 1) > 1 ? `^{${f.n}}` : ''}` },
  pole: { label: 'First-order lag (pole)', vLabel: 'ω_E [1/s]', tex: (f) => `\\frac{1}{1 + s/${nf(f.v, 4)}}` },
  zero: { label: 'First-order lead (zero)', vLabel: 'ω_E [1/s]', tex: (f) => `\\left(1 + s/${nf(f.v, 4)}\\right)` },
  zeroR: { label: 'Right-half-plane zero (1 − s/ω), all-pass part', vLabel: 'ω_E [1/s]', tex: (f) => `\\left(1 - s/${nf(f.v, 4)}\\right)` },
  poleR: { label: 'Unstable pole 1/(1 − s/ω)', vLabel: 'ω_E [1/s]', tex: (f) => `\\frac{1}{1 - s/${nf(f.v, 4)}}` },
  pole2: { label: 'Second-order lag (PT2)', vLabel: 'ω₀ [1/s]', tex: (f) => `\\frac{1}{1 + 2\\cdot${nf(f.zeta ?? 0.5, 3)}\\,s/${nf(f.v, 4)} + (s/${nf(f.v, 4)})^2}` },
  zero2: { label: 'Second-order zero', vLabel: 'ω₀ [1/s]', tex: (f) => `\\left(1 + 2\\cdot${nf(f.zeta ?? 0.5, 3)}\\,s/${nf(f.v, 4)} + (s/${nf(f.v, 4)})^2\\right)` },
  delay: { label: 'Dead time e^(−sT_t)', vLabel: 'T_t [s]', tex: (f) => `e^{-${nf(f.v, 4)}\\,s}` },
};

function factorTF(f: Factor): TF {
  const n = Math.max(1, Math.round(f.n ?? 1));
  const z = f.zeta ?? 0.5;
  const w = Math.max(f.v, 1e-12);
  switch (f.kind) {
    case 'gain':
      return tf([f.v], [1]);
    case 'int':
      return tf([1], [...new Array(n).fill(0), 1]);
    case 'diff':
      return tf([...new Array(n).fill(0), 1], [1]);
    case 'pole':
      return tf([1], [1, 1 / w]);
    case 'zero':
      return tf([1, 1 / w], [1]);
    case 'zeroR':
      return tf([1, -1 / w], [1]);
    case 'poleR':
      return tf([1], [1, -1 / w]);
    case 'pole2':
      return tf([1], [1, (2 * z) / w, 1 / (w * w)]);
    case 'zero2':
      return tf([1, (2 * z) / w, 1 / (w * w)], [1]);
    case 'delay':
      return tf([1], [1], Math.max(0, f.v));
  }
}

/** Straight-line (asymptotic) magnitude [dB] and phase [°] of one factor. */
function asym(f: Factor, w: number): { db: number; deg: number } {
  const n = Math.max(1, Math.round(f.n ?? 1));
  const lw = Math.log10(w / Math.max(f.v, 1e-12));
  const ramp = (deg: number) => (lw <= -1 ? 0 : lw >= 1 ? deg : (deg * (lw + 1)) / 2);
  switch (f.kind) {
    case 'gain':
      return { db: 20 * Math.log10(Math.abs(f.v) || 1e-12), deg: f.v < 0 ? -180 : 0 };
    case 'int':
      return { db: -20 * n * Math.log10(w), deg: -90 * n };
    case 'diff':
      return { db: 20 * n * Math.log10(w), deg: 90 * n };
    case 'pole':
      return { db: lw > 0 ? -20 * lw : 0, deg: ramp(-90) };
    case 'zero':
      return { db: lw > 0 ? 20 * lw : 0, deg: ramp(90) };
    case 'zeroR':
      return { db: lw > 0 ? 20 * lw : 0, deg: ramp(-90) };
    case 'poleR':
      return { db: lw > 0 ? -20 * lw : 0, deg: ramp(90) };
    case 'pole2':
      return { db: lw > 0 ? -40 * lw : 0, deg: lw < 0 ? 0 : -180 };
    case 'zero2':
      return { db: lw > 0 ? 40 * lw : 0, deg: lw < 0 ? 0 : 180 };
    case 'delay':
      return { db: 0, deg: (-w * f.v * 180) / Math.PI };
  }
}

const PRESETS: Record<string, { label: string; factors: Omit<Factor, 'id'>[] }> = {
  it2: {
    label: '10 / (s (1 + s)(1 + s/10))',
    factors: [
      { kind: 'gain', v: 10 },
      { kind: 'int', v: 0, n: 1 },
      { kind: 'pole', v: 1 },
      { kind: 'pole', v: 10 },
    ],
  },
  lead: {
    label: 'Lead element (1 + s/1)/(1 + s/10)',
    factors: [
      { kind: 'zero', v: 1 },
      { kind: 'pole', v: 10 },
    ],
  },
  pt2: { label: 'PT2 with low damping ζ = 0.1', factors: [{ kind: 'pole2', v: 10, zeta: 0.1 }] },
  delay: {
    label: 'PT1 with dead time',
    factors: [
      { kind: 'gain', v: 2 },
      { kind: 'pole', v: 0.5 },
      { kind: 'delay', v: 1 },
    ],
  },
  examF23: {
    label: 'Exam example (like RT F23): PT2 with K = 2, D = 0.2, ω₀ = 1',
    factors: [
      { kind: 'gain', v: 2 },
      { kind: 'pole2', v: 1, zeta: 0.2 },
    ],
  },
  examF22: {
    label: 'Exam example (like RT F22): open loop 5(1 + s)/(s(1 + 5s))',
    factors: [
      { kind: 'gain', v: 5 },
      { kind: 'int', v: 0, n: 1 },
      { kind: 'zero', v: 1 },
      { kind: 'pole', v: 0.2 },
    ],
  },
  examH23: {
    label: 'Exam example (like RT H23): G₀′ = 0.2(1 + 1/(2s)) · 5·PT2(ω₀ = 2, D = 1)',
    factors: [
      { kind: 'gain', v: 0.5 },
      { kind: 'int', v: 0, n: 1 },
      { kind: 'zero', v: 0.5 },
      { kind: 'pole2', v: 2, zeta: 1 },
    ],
  },
  allpass: {
    label: 'Integrator with all-pass 2/s · (1 − 2s)/(1 + 2s)',
    factors: [
      { kind: 'gain', v: 2 },
      { kind: 'int', v: 0, n: 1 },
      { kind: 'zeroR', v: 0.5 },
      { kind: 'pole', v: 0.5 },
    ],
  },
  pid: {
    label: 'PID controller (ideal): K (1 + s/ω₁)(1 + s/ω₂)/s',
    factors: [
      { kind: 'gain', v: 2 },
      { kind: 'int', v: 0, n: 1 },
      { kind: 'zero', v: 0.5 },
      { kind: 'zero', v: 5 },
    ],
  },
};
const mk = (fs: Omit<Factor, 'id'>[]) => fs.map((f, i) => ({ ...f, id: `f${i}` }));

type MagScale = 'abs' | 'db';
const useBode = create<{ factors: Factor[]; scale: MagScale; w: number; u: number; set: (f: Factor[]) => void; setOpt: (p: Partial<{ scale: MagScale; w: number; u: number }>) => void }>()(
  persist((set) => ({ factors: mk(PRESETS.it2!.factors), scale: 'abs', w: 2, u: 1, set: (factors) => set({ factors }), setOpt: (p) => set(p) }), {
    name: 'ts-control-bode',
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    partialize: (s) => ({ factors: s.factors, scale: s.scale, w: s.w, u: s.u }),
  }),
);

export default function BodePage() {
  const { factors, set, scale, w: wIn, u: uIn, setOpt } = useBode();
  const abs = scale === 'abs';
  const mag = (db: number) => (abs ? 10 ** (db / 20) : db);
  const G = useMemo(() => {
    let num: Poly = [1];
    let den: Poly = [1];
    let delay = 0;
    for (const f of factors) {
      const g = factorTF(f);
      num = mul(num, g.num);
      den = mul(den, g.den);
      delay += g.delay ?? 0;
    }
    return tf(num, den, delay);
  }, [factors]);
  const corners = factors.filter((f) => !['gain', 'int', 'diff', 'delay'].includes(f.kind)).map((f) => f.v);
  const wMin = Math.max(1e-4, Math.min(1, ...corners) / 100);
  const wMax = Math.min(1e6, Math.max(1, ...corners) * 100);
  const data = useMemo(() => bode(G, wMin, wMax, 400), [G, wMin, wMax]);
  // the exact phase may sit a multiple of 360° away from the straight-line sum: align them
  const asymData = data.map((p) => {
    let db = 0;
    let deg = 0;
    for (const f of factors) {
      const a = asym(f, p.w);
      db += a.db;
      deg += a.deg;
    }
    return { w: p.w, db, deg };
  });
  const off = 360 * Math.round(((asymData[0]?.deg ?? 0) - (data[0]?.deg ?? 0)) / 360);
  const mg = useMemo(() => margins(G), [G]);
  const upd = (i: number, f: Factor | null) => {
    const a = [...factors];
    if (f) a[i] = f;
    else a.splice(i, 1);
    set(a);
  };
  const n = (v: number | null) => (v === null || !Number.isFinite(v) ? '–' : nf(v, 3));

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Factors of G(s)">
          <select aria-label={t('Examples')} className={fieldCls} value="" onChange={(e) => e.target.value && set(mk(PRESETS[e.target.value]!.factors))}>
            <option value="">{t('Load an example…')}</option>
            {Object.entries(PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {t(p.label)}
              </option>
            ))}
          </select>
          <div className="mt-2 space-y-1.5">
            {factors.map((f, i) => (
              <div key={f.id} className="space-y-1 rounded-md border border-white/[0.06] p-2">
                <div className="flex items-center gap-1">
                  <select
                    aria-label={t('Factor type')}
                    className={fieldCls}
                    value={f.kind}
                    onChange={(e) => upd(i, { ...f, kind: e.target.value as FKind, v: e.target.value === 'gain' ? 1 : f.v || 1 })}
                  >
                    {(Object.keys(KIND_INFO) as FKind[]).map((k) => (
                      <option key={k} value={k}>
                        {t(KIND_INFO[k].label)}
                      </option>
                    ))}
                  </select>
                  <button type="button" aria-label={t('Delete')} onClick={() => upd(i, null)} className="grid h-6 w-6 shrink-0 place-items-center rounded text-plant-500 hover:text-signal-alarm">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[9px] uppercase tracking-wider text-plant-500">
                  {KIND_INFO[f.kind].vLabel && (
                    <label>
                      {KIND_INFO[f.kind].vLabel}
                      <Num ariaLabel="v" value={f.v} onChange={(v) => upd(i, { ...f, v })} />
                    </label>
                  )}
                  {(f.kind === 'int' || f.kind === 'diff') && (
                    <label>
                      n
                      <Num ariaLabel="n" value={f.n ?? 1} onChange={(v) => upd(i, { ...f, n: Math.max(1, Math.min(4, Math.round(v))) })} />
                    </label>
                  )}
                  {(f.kind === 'pole2' || f.kind === 'zero2') && (
                    <label>
                      ζ (D)
                      <Num ariaLabel="zeta" value={f.zeta ?? 0.5} onChange={(v) => upd(i, { ...f, zeta: v })} />
                    </label>
                  )}
                </div>
                <div className="text-[12px] text-plant-200">
                  <Tex math={KIND_INFO[f.kind].tex(f)} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => set([...factors, { id: newId('f'), kind: 'pole', v: 1 }])} className="flex items-center gap-1 text-[11px] text-signal-heat hover:underline">
              <Plus className="h-3 w-3" /> {t('Add factor')}
            </button>
          </div>
        </Card>
        <Card title="Rules for the straight-line approximation">
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-plant-300">
            <li>{t('Gain K: horizontal line at 20·log K dB, phase 0°.')}</li>
            <li>{t('Integrator 1/s: −20 dB/decade through 0 dB at ω = 1, phase −90°.')}</li>
            <li>{t('First-order lag: 0 dB up to ω_E, then −20 dB/decade; phase 0° → −90° from ω_E/10 to 10·ω_E (−45° at ω_E).')}</li>
            <li>{t('Second-order lag: −40 dB/decade above ω₀; resonance peak for ζ < 0.707; phase jumps by −180° at ω₀.')}</li>
            <li>{t('Dead time: |G| unchanged, phase −ω·T_t (falls without limit).')}</li>
            <li>{t('Product of factors = sum of their dB curves and phases.')}</li>
          </ul>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <Card title="Transfer function">
          <div className="space-y-1 text-[13px] text-plant-100">
            <Tex block math={`G(s) = ${factors.map((f) => KIND_INFO[f.kind].tex(f)).join('\\cdot ') || '1'}`} />
            <Tex block math={`G(s) = ${tfTex(G)}`} />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="|G(j·1)|" value={n(mag(20 * Math.log10(freq(G, 1).mag)))} unit={abs ? undefined : 'dB'} />
          <Kpi label={t('Gain crossover ω_c')} value={n(mg.wc)} unit="1/s" />
          <Kpi label={t('Phase margin (as open loop)')} value={n(mg.pm)} unit="°" />
          <Kpi label={t('Gain margin (as open loop)')} value={mg.gm === null ? '–' : `A_R = ${nf(10 ** (mg.gm / 20), 3)}`} sub={`${n(mg.gm)} dB`} />
        </div>
        <Card
          title="Magnitude response"
          aside={
            <div className="w-44">
              <Segmented<MagScale>
                value={scale}
                onChange={(v) => setOpt({ scale: v })}
                options={[
                  { value: 'abs', label: '|G| log', hint: 'Logarithmic |G| axis as in the RWTH exams: slope −1 per decade = −20 dB/decade' },
                  { value: 'db', label: 'dB' },
                ]}
              />
            </div>
          }
        >
          <LineChartBox
            series={[
              { name: t('exact'), data: data.map((p) => ({ x: p.w, y: mag(p.db) })) },
              { name: t('straight-line approximation'), data: asymData.map((p) => ({ x: p.w, y: mag(p.db) })), dashed: true, color: 'rgb(var(--plant-400))' },
            ]}
            xLabel="ω [1/s]"
            yLabel={abs ? '|G|' : '|G| [dB]'}
            logX
            logY={abs}
            refX={corners.map((c) => ({ x: c, label: nf(c, 3) }))}
            digits={0}
          />
        </Card>
        <Card title="Phase response">
          <LineChartBox
            series={[
              { name: t('exact'), data: data.map((p) => ({ x: p.w, y: p.deg })), color: 'rgb(var(--sig-vapor))' },
              { name: t('straight-line approximation'), data: asymData.map((p) => ({ x: p.w, y: p.deg - off })), dashed: true, color: 'rgb(var(--plant-400))' },
            ]}
            xLabel="ω [1/s]"
            yLabel="φ [°]"
            logX
            digits={0}
          />
        </Card>
        <SineResponse G={G} w={wIn} u={uIn} onChange={setOpt} />
      </div>
    </div>
  );
}

/** steady-state answer to u(t) = û·sin(ωt): y(t) = û·|G(jω)|·sin(ωt + φ(ω)), with input and output phasors */
function SineResponse({ G, w, u, onChange }: { G: TF; w: number; u: number; onChange: (p: { w?: number; u?: number }) => void }) {
  const r = freq(G, w);
  const phi = r.phase;
  const pts = Array.from({ length: 241 }, (_, k) => {
    const tt = (k / 240) * ((4 * Math.PI) / w);
    return { t: tt, u: u * Math.sin(w * tt), y: u * r.mag * Math.sin(w * tt + phi) };
  });
  return (
    <Card title="Sine input: output in the steady state">
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3">
          <ParamSlider label="Input frequency" symbol="ω" unit="1/s" value={w} min={0.01} max={100} step={0.01} digits={2} onChange={(v) => onChange({ w: v })} />
          <ParamSlider label="Input amplitude" symbol="û" value={u} min={0.1} max={10} step={0.1} onChange={(v) => onChange({ u: v })} />
          <PhasorPlot
            size={220}
            items={[
              { v: { re: u, im: 0 }, color: 'rgb(var(--plant-300))', label: 'u' },
              { v: { re: u * r.re, im: u * r.im }, color: 'rgb(var(--sig-liquid))', label: 'y' },
            ]}
          />
        </div>
        <div>
          <div className="text-[13px] text-plant-100">
            <Tex block math={`|G(j${nf(w, 3)})| = ${nf(r.mag, 4)},\\quad \\varphi = ${nf((phi * 180) / Math.PI, 2)}^\\circ`} />
            <Tex block math={`y(t) = ${nf(u, 3)}\\cdot ${nf(r.mag, 4)}\\,\\sin\\!\\left(${nf(w, 3)}\\,t ${phi >= 0 ? '+' : '-'} ${nf(Math.abs((phi * 180) / Math.PI), 2)}^\\circ\\right)`} />
          </div>
          <LineChartBox
            height={200}
            series={[
              { name: 'u(t)', data: pts.map((p) => ({ x: p.t, y: p.u })), color: 'rgb(var(--plant-400))', dashed: true },
              { name: 'y(t)', data: pts.map((p) => ({ x: p.t, y: p.y })), color: 'rgb(var(--sig-liquid))' },
            ]}
            xLabel="t [s]"
            yLabel=""
            digits={2}
          />
          <p className="mt-1 text-[10px] leading-relaxed text-plant-500">
            {t('The output phasor is the input phasor stretched by |G(jω)| and turned by φ(ω) — read both from the Bode diagram at the input frequency.')}
          </p>
        </div>
      </div>
    </Card>
  );
}
