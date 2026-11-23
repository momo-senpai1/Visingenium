/** TM 3: kinetics of rigid bodies — bodies rolling down an incline: centre-of-mass theorem, angular momentum, moments of inertia, energy. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Ground, MomentArrow, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { K_BODY, rolling, type BodyKind } from '@/engine/mechanics/dynamics';

const BODIES: { value: BodyKind; label: string; J: string }[] = [
  { value: 'sphere', label: 'Solid sphere', J: '\\tfrac25 m r^2' },
  { value: 'cylinder', label: 'Solid cylinder', J: '\\tfrac12 m r^2' },
  { value: 'shell', label: 'Hollow sphere', J: '\\tfrac23 m r^2' },
  { value: 'ring', label: 'Thin ring', J: 'm r^2' },
];
const COLORS: Record<BodyKind, string> = { sphere: 'rgb(var(--sig-alarm))', cylinder: 'rgb(var(--sig-liquid))', shell: 'rgb(var(--sig-vapor))', ring: 'rgb(var(--sig-ok))' };

const useKinetics = paramStore('tm-kinetics', { body: 'cylinder' as BodyKind, alpha: 20, mu0: 0.3, mu: 0.25, m: 2, r: 0.1 });

export default function KineticsPage() {
  const s = useKinetics();
  const ta = useAnimTime();
  const L = 2; // slope length [m]
  const res = BODIES.map((b) => ({ ...b, r: rolling(b.value, s.alpha, s.mu0, s.mu) }));
  const sel = res.find((b) => b.value === s.body)!;
  const fastest = Math.max(...res.map((b) => b.r.a));
  const tEnd = Math.sqrt((2 * L) / Math.max(1e-6, Math.min(...res.map((b) => b.r.a))));
  const tc = (ta * 0.7) % (tEnd + 0.8);

  const al = (s.alpha * Math.PI) / 180;
  const O: [number, number] = [520, 290];
  const len = 440;
  const top: [number, number] = [O[0] - len * Math.cos(al), O[1] - len * Math.sin(al)];
  const u: [number, number] = [Math.cos(al), Math.sin(al)]; // down the slope on screen
  const nrm: [number, number] = [Math.sin(al), -Math.cos(al)];
  const R = 15;

  const G = s.m * 9.81;
  const aS = sel.r.a;
  const Rf = s.m * sel.r.R;
  const vT = (b: (typeof res)[number], tt: number) => b.r.a * tt;
  const series = res.map((b) => ({ name: t(b.label), data: Array.from({ length: 41 }, (_, i) => ({ x: (tEnd * i) / 40, y: vT(b, (tEnd * i) / 40) })), color: COLORS[b.value], dashed: b.value !== s.body }));
  const k = K_BODY[s.body];
  const Jp = (k + 1) * s.m * s.r * s.r;

  return (
    <EeLayout
      aside={
        <>
          <Card title="Kinetics of rigid bodies">
            <Idea>
              {t(
                'For a rigid body two laws hold: the centre-of-mass theorem m·a_S = ΣF (like a particle) and the angular-momentum theorem J_S·ω̇ = ΣM_S. Rolling links both: a_S = r·ω̇. Gravity pulls all bodies equally, but part of the energy must go into rotation. The larger the moment of inertia J_S compared with m r², the more energy rotation takes — so the ring is always last, independent of mass and radius.',
              )}
            </Idea>
            <Segmented value={s.body} onChange={(body) => s.set({ body })} options={BODIES.map((b) => ({ value: b.value, label: t(b.label) }))} />
          </Card>
          <Card title="Incline">
            <div className="space-y-3">
              <ParamSlider label="Incline angle" symbol="α" unit="°" value={s.alpha} min={2} max={70} step={1} digits={0} onChange={(alpha) => s.set({ alpha })} />
              <ParamSlider label="Static friction coefficient" symbol="μ₀" value={s.mu0} min={0} max={1} step={0.01} digits={2} onChange={(mu0) => s.set({ mu0, mu: Math.min(s.mu, mu0) })} />
              <ParamSlider label="Sliding friction coefficient" symbol="μ" value={s.mu} min={0} max={s.mu0} step={0.01} digits={2} onChange={(mu) => s.set({ mu })} />
              <ParamSlider label="Mass" symbol="m" unit="kg" value={s.m} min={0.1} max={20} step={0.1} onChange={(m) => s.set({ m })} />
              <ParamSlider label="Radius" symbol="r" unit="m" value={s.r} min={0.02} max={0.5} step={0.01} digits={2} onChange={(r) => s.set({ r })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="a_S" value={nf(aS, 3)} unit="m/s²" sub={`${nf((aS / (9.81 * Math.sin(al))) * 100, 0)} % ${t('of free sliding')}`} />
        <Kpi label="Friction force R" value={nf(Rf, 2)} unit="N" sub={sel.r.rolls ? t('static friction') : t('sliding friction')} />
        <Kpi label="J_S" value={nf(k * s.m * s.r ** 2, 4)} unit="kg·m²" />
        <Kpi label="Rotational share of E_kin" value={nf(sel.r.rolls ? (k / (1 + k)) * 100 : 0, 0)} unit="%" sub={sel.r.rolls ? 'k/(1+k)' : t('changes while slipping')} />
        <Kpi label="Rolls without slipping" value={sel.r.rolls ? t('yes') : t('no')} sub={`${t('up to')} tan α = ${nf(sel.r.tanLimit, 2)}`} />
      </div>
      {!sel.r.rolls && <Notice tone="warning">{t('The needed static friction exceeds μ₀·N: the body slides and spins at the same time. Translation and rotation are then no longer coupled by a_S = r·ω̇.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card title="Race down the incline">
          <svg viewBox="0 0 580 320" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Bodies rolling down an incline')}>
            <Ground a={top} b={O} side={1} />
            {res.map((b) => {
              const sPos = Math.min(L, 0.5 * b.r.a * tc * tc);
              const d = (sPos / L) * (len - 40) + 20;
              const c: [number, number] = [top[0] + u[0] * d + nrm[0] * R, top[1] + u[1] * d + nrm[1] * R];
              // drawn rotation: arc length r·φ over a visual radius of 0.1 m
              const rot = (b.r.rolls ? sPos : Math.min(0.5 * b.r.alphaR * tc * tc, 50)) / 0.1;
              return (
                <g key={b.value} opacity={b.value === s.body ? 1 : 0.55}>
                  <circle cx={c[0]} cy={c[1]} r={R} fill={b.value === 'ring' || b.value === 'shell' ? 'rgb(var(--plant-950))' : COLORS[b.value]} fillOpacity={0.5} stroke={COLORS[b.value]} strokeWidth={b.value === 'ring' ? 4 : 2} />
                  <line x1={c[0]} y1={c[1]} x2={c[0] + R * Math.cos(rot)} y2={c[1] + R * Math.sin(rot)} stroke={TM.body} strokeWidth={1.5} />
                </g>
              );
            })}
            {/* free-body diagram of the selected body (with d'Alembert inertia force) */}
            {(() => {
              const c: [number, number] = [150, 70];
              const f = 55 / G;
              return (
                <g>
                  <circle cx={c[0]} cy={c[1]} r={24} fill="none" stroke={COLORS[s.body]} strokeWidth={2} />
                  <Arrow a={c} b={[c[0], c[1] + G * f]} color={TM.load} label="mg" />
                  <Arrow a={[c[0] - nrm[0] * 24, c[1] - nrm[1] * 24]} b={[c[0] - nrm[0] * 24 + nrm[0] * G * Math.cos(al) * f, c[1] - nrm[1] * 24 + nrm[1] * G * Math.cos(al) * f]} color={TM.reaction} label="N" labelOffset={[-18, 0]} />
                  <Arrow a={[c[0] - nrm[0] * 24, c[1] - nrm[1] * 24]} b={[c[0] - nrm[0] * 24 - u[0] * Rf * f * 3, c[1] - nrm[1] * 24 - u[1] * Rf * f * 3]} color={TM.aux} label="R" labelOffset={[-18, 14]} />
                  <Arrow a={c} b={[c[0] - u[0] * s.m * aS * f, c[1] - u[1] * s.m * aS * f]} color={TM.muted} dashed label="−m a_S" labelOffset={[-60, -6]} />
                  <MomentArrow c={c} r={34} M={1} color={TM.muted} label="−J_S ω̇" />
                </g>
              );
            })()}
          </svg>
          <Caption>{t('All four bodies start together. The ring arrives last, the solid sphere first — whatever their mass. Top left: free-body diagram of the selected body with the d\'Alembert inertia force and inertia moment (grey, dashed).')}</Caption>
        </Card>
        <Card title="Speed over time">
          <LineChartBox height={260} series={series} xLabel="t [s]" yLabel="v_S [m/s]" digits={2} />
          <Caption>
            {t('Fastest acceleration')}: {nf(fastest, 2)} m/s². {t('Sliding without friction would give')} g·sin α = {nf(9.81 * Math.sin(al), 2)} m/s².
          </Caption>
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`\\searrow:\\ m\\,a_S = m g\\sin\\alpha - R\\qquad (\\text{${t('centre-of-mass theorem')}})`} />
          <Tex block math={`\\circlearrowright S:\\ J_S\\,\\dot\\omega = R\\,r\\qquad (\\text{${t('angular-momentum theorem')}}),\\quad J_S = ${BODIES.find((b) => b.value === s.body)!.J}`} />
          <Tex block math={`\\text{${t('rolling')}}:\\ a_S = r\\dot\\omega \\Rightarrow a_S = \\frac{g\\sin\\alpha}{1 + J_S/(m r^2)} = \\frac{9{,}81 \\cdot \\sin ${nf(s.alpha, 0)}^\\circ}{1 + ${nf(k, 3)}} = ${nf(rolling(s.body, s.alpha, 10, 10).a, 3)}\\,\\mathrm{\\tfrac m{s^2}}`} />
          <Tex block math={`R = \\frac{J_S}{r^2}\\,a_S = ${nf(s.m * rolling(s.body, s.alpha, 10, 10).R, 3)}\\,\\mathrm N \\le \\mu_0 N = ${nf(s.mu0 * G * Math.cos(al), 3)}\\,\\mathrm N\\ ${sel.r.rolls ? '\\checkmark' : '\\times'}`} />
          <Tex block math={`\\text{${t('Steiner about the contact point')}}:\\ J_P = J_S + m r^2 = ${nf(Jp, 4)}\\,\\mathrm{kg\\,m^2},\\ \\ J_P\\dot\\omega = m g r\\sin\\alpha`} />
          <Tex block math={`\\text{${t('Energy')}}:\\ m g h = \\tfrac12 m v_S^2 + \\tfrac12 J_S\\omega^2 \\Rightarrow v_S = \\sqrt{\\frac{2 g h}{1 + J_S/(m r^2)}}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
