import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Tex } from '@/components/balance/Tex';
import { VIZ } from '@/components/analysis/vizTokens';
import { Card, Diagram, ListEditor, MECH, newId, nf, Num, NumRow, safeStorage } from '@/components/mechanics/common';
import { Kpi, Notice } from '@/components/workbench/controls';
import { solveShaft, torqueFromPower, type ShaftSegment } from '@/engine/mechanics/torsion';
import { t } from '@/i18n';

interface ShaftState {
  segments: ShaftSegment[];
  torques: number[];
  rightFixed: boolean;
  tauAllow: number;
  set: (p: Partial<Pick<ShaftState, 'segments' | 'torques' | 'rightFixed' | 'tauAllow'>>) => void;
}

const useShaft = create<ShaftState>()(
  persist(
    (set) => ({
      segments: [
        { id: 's1', L: 0.6, D: 50, d: 0, G: 80 },
        { id: 's2', L: 0.8, D: 45, d: 0, G: 80 },
        { id: 's3', L: 0.5, D: 45, d: 25, G: 80 },
      ],
      torques: [0, 1500, -600, -400],
      rightFixed: false,
      tauAllow: 60,
      set: (p) => set(p),
    }),
    { name: 'ts-shaft', version: 1, storage: createJSONStorage(() => safeStorage), partialize: ({ set: _s, ...rest }) => rest },
  ),
);

export default function TorsionPage() {
  const st = useShaft();
  const r = useMemo(() => solveShaft({ segments: st.segments, torques: st.torques, rightFixed: st.rightFixed }), [st.segments, st.torques, st.rightFixed]);
  const L = st.segments.reduce((a, s) => a + s.L, 0);
  const steps: { x: number; T: number; tau: number }[] = [];
  const twist: { x: number; phi: number }[] = [];
  if (r.ok) {
    r.segs.forEach((sg, i) => {
      steps.push({ x: r.x[i]!, T: sg.T, tau: sg.tau }, { x: r.x[i + 1]!, T: sg.T, tau: sg.tau });
    });
    r.x.forEach((x, i) => twist.push({ x, phi: (r.rot[i]! * 180) / Math.PI }));
  }
  const tauMax = r.ok ? Math.max(...r.segs.map((s) => Math.abs(s.tau))) : 0;
  const setSeg = (id: string, patch: Partial<ShaftSegment>) => st.set({ segments: st.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Shaft segments">
          <ListEditor
            items={st.segments}
            cols={['L [m]', 'D [mm]', 'd_i [mm]', 'G [GPa]']}
            addLabel={t('Add segment')}
            onAdd={() => st.set({ segments: [...st.segments, { id: newId('s'), L: 0.5, D: 40, d: 0, G: 80 }], torques: [...st.torques, 0] })}
            onRemove={(id) => {
              const i = st.segments.findIndex((s) => s.id === id);
              if (st.segments.length <= 1) return;
              st.set({ segments: st.segments.filter((s) => s.id !== id), torques: st.torques.filter((_, k) => k !== i + 1) });
            }}
            render={(s) => [
              <Num key="L" ariaLabel="L" value={s.L} onChange={(L) => setSeg(s.id, { L })} />,
              <Num key="D" ariaLabel="D" value={s.D} onChange={(D) => setSeg(s.id, { D })} />,
              <Num key="d" ariaLabel="d" value={s.d} onChange={(d) => setSeg(s.id, { d })} />,
              <Num key="G" ariaLabel="G" value={s.G} onChange={(G) => setSeg(s.id, { G })} />,
            ]}
          />
          <p className="mt-1 text-[10px] text-plant-500">{t('d_i > 0 makes a hollow shaft. Steel G ≈ 80 GPa, aluminium ≈ 27 GPa.')}</p>
        </Card>
        <Card title="Torques at the stations">
          <div className="space-y-1.5">
            {st.torques.map((T, i) => (
              <label key={i} className="grid grid-cols-[minmax(0,1fr)_100px_30px] items-center gap-2 text-[11px] text-plant-300">
                <span>
                  {t('Station')} {i} {i === 0 ? `(${t('left end, clamped')})` : i === st.torques.length - 1 ? `(${t('right end')})` : ''}
                </span>
                <Num ariaLabel={`M${i}`} value={T} onChange={(v) => st.set({ torques: st.torques.map((o, k) => (k === i ? v : o)) })} />
                <span className="font-mono text-[10px] text-plant-500">Nm</span>
              </label>
            ))}
            <p className="text-[10px] text-plant-500">{t('Positive by the right-hand rule about the shaft axis (thumb to the right).')}</p>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-[11px] text-plant-300">
              <input type="checkbox" checked={st.rightFixed} onChange={(e) => st.set({ rightFixed: e.target.checked })} />
              {t('Right end clamped too (statically indeterminate)')}
            </label>
            <NumRow label={t('Allowable shear stress τ_zul')} unit="MPa" value={st.tauAllow} onChange={(tauAllow) => tauAllow > 0 && st.set({ tauAllow })} />
          </div>
        </Card>
        <PowerHelper />
      </aside>

      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi label={t('Reaction left')} value={nf(r.TA, 1)} unit="Nm" />
          <Kpi label={t('Reaction right')} value={st.rightFixed ? nf(r.TB, 1) : '–'} unit={st.rightFixed ? 'Nm' : undefined} />
          <Kpi label="τ_max" value={nf(tauMax, 1)} unit="MPa" sub={`${t('utilisation')} ${nf((tauMax / st.tauAllow) * 100, 0)} %`} />
          <Kpi label={t('Twist at the right end')} value={r.ok ? nf((r.rot.at(-1)! * 180) / Math.PI, 3) : '–'} unit="°" />
          <Kpi label={t('Length')} value={nf(L, 2)} unit="m" />
        </div>
        {r.error === 'geometry' && <Notice tone="error">{t('Check the segments: lengths and diameters must be positive and the bore smaller than the outer diameter.')}</Notice>}
        {r.ok && tauMax > st.tauAllow && <Notice tone="warning">{t('The shear stress exceeds the allowable value.')}</Notice>}
        <Card title="Shaft">
          <ShaftDrawing />
        </Card>
        {r.ok && (
          <div className="grid gap-2 lg:grid-cols-2">
            <Card title="Torque and stress">
              <Diagram data={steps} dataKey="T" label={t('Internal torque M_t(x)')} unit="Nm" color={VIZ.equilibrium} xMax={L} digits={0} />
              <Diagram data={steps} dataKey="tau" label={t('Max. shear stress τ(x)')} unit="MPa" color={VIZ.operating} xMax={L} digits={1} />
              <Diagram data={twist} dataKey="phi" label={t('Angle of twist φ(x)')} unit="°" color={VIZ.qLine} xMax={L} digits={2} />
            </Card>
            <Card title="Solution path">
              <SolutionPath r={r} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function PowerHelper() {
  const [P, setP] = useState(15);
  const [n, setN] = useState(1450);
  return (
    <Card title="Torque from power">
      <div className="space-y-1.5">
        <NumRow label={t('Power P')} unit="kW" value={P} onChange={setP} />
        <NumRow label={t('Speed n')} unit="1/min" value={n} onChange={setN} />
        <Tex block math={`M_t = \\frac{P}{2\\pi n} = ${nf(torqueFromPower(P, n), 2).replace(',', '{,}')}\\ \\mathrm{Nm}`} />
      </div>
    </Card>
  );
}

function ShaftDrawing() {
  const st = useShaft();
  const L = st.segments.reduce((a, s) => a + s.L, 0) || 1;
  const Dmax = Math.max(...st.segments.map((s) => s.D), 1);
  const W = 1000;
  const P = 60;
  const Y = 110;
  const sx = (x: number) => P + ((W - 2 * P) * x) / L;
  const h = (D: number) => (D / Dmax) * 70;
  let x0 = 0;
  const stations = [0];
  return (
    <svg viewBox={`0 0 ${W} 220`} className="h-auto w-full" role="img" aria-label={t('Shaft with torques')}>
      <defs>
        <marker id="sarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={MECH.load} />
        </marker>
      </defs>
      {st.segments.map((s) => {
        const a = sx(x0);
        x0 += s.L;
        stations.push(x0);
        const b = sx(x0);
        return (
          <g key={s.id}>
            <rect x={a} y={Y - h(s.D) / 2} width={b - a} height={h(s.D)} fill="rgb(var(--plant-700))" stroke={MECH.beam} strokeWidth={1.2} />
            {s.d > 0 && <rect x={a} y={Y - h(s.d) / 2} width={b - a} height={h(s.d)} fill="rgb(var(--plant-950))" stroke={MECH.beam} strokeWidth={0.8} strokeDasharray="4 3" />}
            <text x={(a + b) / 2} y={Y + h(s.D) / 2 + 16} textAnchor="middle" className="text-[11px]" style={{ fill: 'rgb(var(--plant-400))' }}>
              ⌀{nf(s.D, 0)}
              {s.d > 0 ? `/${nf(s.d, 0)}` : ''} · {nf(s.L, 2)} m
            </text>
          </g>
        );
      })}
      {/* clamps */}
      {[0, st.rightFixed ? L : null].map((x, k) =>
        x === null ? null : (
          <g key={k} stroke={MECH.beam} strokeWidth={1.4}>
            <line x1={sx(x)} y1={Y - 55} x2={sx(x)} y2={Y + 55} />
            {Array.from({ length: 7 }, (_, i) => (
              <line key={i} x1={sx(x)} y1={Y - 50 + i * 16} x2={sx(x) + (k === 0 ? -10 : 10)} y2={Y - 40 + i * 16} />
            ))}
          </g>
        ),
      )}
      {/* torques: curved arrow above the shaft at each station */}
      {st.torques.map((T, i) =>
        T === 0 ? null : (
          <g key={i}>
            <path
              d={T > 0 ? `M${sx(stations[i]!) - 16},${Y - 60} A18,10 0 1 1 ${sx(stations[i]!) + 16},${Y - 60}` : `M${sx(stations[i]!) + 16},${Y - 60} A18,10 0 1 0 ${sx(stations[i]!) - 16},${Y - 60}`}
              fill="none"
              stroke={MECH.load}
              strokeWidth={2}
              markerEnd="url(#sarr)"
            />
            <text x={sx(stations[i]!)} y={Y - 80} textAnchor="middle" className="text-[11px] font-semibold" style={{ fill: MECH.load }}>
              {nf(T, 0)} Nm
            </text>
          </g>
        ),
      )}
      <line x1={sx(0) - 20} y1={Y} x2={sx(L) + 30} y2={Y} stroke="rgb(var(--plant-500))" strokeDasharray="8 4 2 4" />
      <text x={sx(L) + 34} y={Y + 4} className="text-[11px]" style={{ fill: 'rgb(var(--plant-400))' }}>
        x
      </text>
    </svg>
  );
}

function SolutionPath({ r }: { r: ReturnType<typeof solveShaft> }) {
  const st = useShaft();
  const n = (v: number, d = 3) => (nf(v, d).startsWith('-') ? `(${nf(v, d)})` : nf(v, d)).replace(',', '{,}');
  return (
    <div className="space-y-2 text-[13px] text-plant-100">
      {st.rightFixed ? (
        <>
          <p className="text-[10px] text-plant-500">{t('Clamped at both ends: one equilibrium equation, two reactions → add the compatibility condition (total twist zero).')}</p>
          <Tex block math={`M_A + \\textstyle\\sum M_i + M_B = 0,\\qquad \\varphi_{ges} = \\sum \\frac{M_{t,i} L_i}{G_i I_{p,i}} = 0`} />
        </>
      ) : (
        <Tex block math={`M_A = -\\textstyle\\sum M_i = ${n(r.TA, 1)}\\ \\mathrm{Nm}`} />
      )}
      {r.segs.map((sg, i) => {
        const s = st.segments[i]!;
        return (
          <div key={s.id} className="rounded-md border border-white/[0.05] px-2 py-1.5">
            <p className="text-[11px] text-plant-400">
              {t('Segment')} {i + 1}
            </p>
            <Tex
              block
              math={`I_p = \\frac{\\pi (D^4 - d^4)}{32} = ${n(sg.Ip / 1e4, 2)}\\ \\mathrm{cm^4},\\quad M_t = ${n(sg.T, 1)}\\ \\mathrm{Nm}`}
            />
            <Tex block math={`\\tau_{max} = \\frac{M_t}{W_t} = \\frac{${n(sg.T * 1000, 0)}}{${n(sg.Wt, 0)}} = ${n(sg.tau, 2)}\\ \\mathrm{MPa}`} />
            <Tex
              block
              math={`\\varphi = \\frac{M_t L}{G I_p} = \\frac{${n(sg.T * 1000, 0)} \\cdot ${n(s.L * 1000, 0)}}{${n(s.G * 1000, 0)} \\cdot ${n(sg.Ip, 0)}} = ${n((sg.phi * 180) / Math.PI, 4)}^\\circ`}
            />
          </div>
        );
      })}
      <p className="text-[10px] text-plant-500">{t('Units: M_t in Nmm, lengths in mm, G in N/mm² → τ in MPa, φ in rad (shown in degrees).')}</p>
    </div>
  );
}

