/** TM 2: stability — Euler buckling, the four Euler cases, slenderness and the Euler hyperbola. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea, useAnimTime } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { BETA, bucklingMode, euler, type EulerCase } from '@/engine/mechanics/elasto';

const useBuck = paramStore('tm-buckling', { c: '2' as '1' | '2' | '3' | '4', l: 2, shape: 'circle' as 'circle' | 'rect', d: 40, bw: 30, bh: 50, E: 210, sp: 200, load: 80 });

const CASE_TEXT: Record<EulerCase, string> = {
  1: 'clamped – free',
  2: 'pinned – pinned',
  3: 'clamped – pinned',
  4: 'clamped – clamped',
};

export default function BucklingPage() {
  const s = useBuck();
  const c = Number(s.c) as EulerCase;
  const A = s.shape === 'circle' ? (Math.PI * s.d ** 2) / 4 : s.bw * s.bh;
  const I = s.shape === 'circle' ? (Math.PI * s.d ** 4) / 64 : (Math.max(s.bw, s.bh) * Math.min(s.bw, s.bh) ** 3) / 12;
  const r = euler(c, s.l * 1000, s.E * 1e3, I, A, s.sp);
  const F = (s.load / 100) * r.Fk;
  const ta = useAnimTime();
  // above the buckling load the column bows out (animated growth, saturating)
  const amp = s.load >= 100 ? Math.min(1, 0.25 + 0.75 * Math.abs(Math.sin(ta * 1.2))) * Math.min(1, (s.load - 99) / 20 + 0.4) : 0;
  const hyper = Array.from({ length: 120 }, (_, i) => {
    const lam = 10 + i * 2;
    return { x: lam, y: Math.min(600, (Math.PI ** 2 * s.E * 1e3) / lam ** 2) };
  });

  const Column = ({ cs, x, active }: { cs: EulerCase; x: number; active: boolean }) => {
    const H = 220;
    const top = 40;
    const bot = top + H;
    const a = active ? amp * 26 : 0;
    // ξ from the lower (clamped / pinned) end
    const pts = Array.from({ length: 41 }, (_, i) => {
      const xi = i / 40;
      return [x + a * bucklingMode(cs, xi), bot - xi * H];
    });
    const op = active ? 1 : 0.45;
    const pin = (y: number, up: boolean) => <path d={up ? `M${x},${y} l-10,-16 h20 z` : `M${x},${y} l-10,16 h20 z`} fill="none" stroke={TM.body} strokeWidth={1.4} />;
    const clamp = (y: number) => <rect x={x - 18} y={y} width={36} height={8} fill="url(#hatchB)" stroke={TM.ground} />;
    return (
      <g opacity={op}>
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={active ? TM.load : TM.body} strokeWidth={4} strokeLinecap="round" />
        {cs === 2 ? pin(bot, false) : clamp(bot)}
        {cs === 2 || cs === 3 ? (
          <>
            {pin(top, true)}
            <line x1={x - 14} y1={top - 18} x2={x + 14} y2={top - 18} stroke={TM.body} />
          </>
        ) : cs === 4 ? (
          <rect x={x - 18} y={top - 8} width={36} height={8} fill="url(#hatchB)" stroke={TM.ground} />
        ) : null}
        <Arrow a={[x + a * bucklingMode(cs, 1), top - 50]} b={[x + a * bucklingMode(cs, 1), top - (cs === 1 ? 4 : 22)]} color={TM.load} />
        <Label x={x} y={bot + 30} color={active ? TM.text : TM.muted}>{`${t('Case')} ${cs}`}</Label>
        <Label x={x} y={bot + 44} color={TM.muted} size={10}>{`l_K = ${nf(BETA[cs], 2)} l`}</Label>
      </g>
    );
  };

  return (
    <EeLayout
      aside={
        <>
          <Card title="Buckling of slender columns">
            <Idea>
              {t(
                'A slender column under compression stays straight only up to a critical load. At F_K = π²EI/l_K² a bent shape becomes an equilibrium too: the column snaps sideways although the material is far from failing. The buckling length l_K depends on the supports (four Euler cases). Euler only holds for slender columns: when the slenderness λ = l_K/i is above λ_P, the column buckles elastically before the stress reaches the proportional limit.',
              )}
            </Idea>
            <Segmented
              value={s.c}
              onChange={(cc) => s.set({ c: cc })}
              options={(['1', '2', '3', '4'] as const).map((k) => ({ value: k, label: k, hint: t(CASE_TEXT[Number(k) as EulerCase]) }))}
            />
            <p className="mt-1 text-[10px] text-plant-500">{t(CASE_TEXT[c])}</p>
          </Card>
          <Card title="Column">
            <div className="space-y-3">
              <ParamSlider label="Length" symbol="l" unit="m" value={s.l} min={0.3} max={6} step={0.1} onChange={(l) => s.set({ l })} />
              <Segmented
                value={s.shape}
                onChange={(shape) => s.set({ shape })}
                options={[
                  { value: 'circle', label: t('Round bar') },
                  { value: 'rect', label: t('Rectangle') },
                ]}
              />
              {s.shape === 'circle' ? (
                <ParamSlider label="Diameter" symbol="d" unit="mm" value={s.d} min={5} max={150} step={1} digits={0} onChange={(d) => s.set({ d })} />
              ) : (
                <>
                  <ParamSlider label="Width" symbol="b" unit="mm" value={s.bw} min={5} max={150} step={1} digits={0} onChange={(bw) => s.set({ bw })} />
                  <ParamSlider label="Height" symbol="h" unit="mm" value={s.bh} min={5} max={150} step={1} digits={0} onChange={(bh) => s.set({ bh })} />
                </>
              )}
              <ParamSlider label="Young's modulus" symbol="E" unit="GPa" value={s.E} min={10} max={250} step={5} digits={0} onChange={(E) => s.set({ E })} />
              <ParamSlider label="Proportional limit" symbol="σ_P" unit="MPa" value={s.sp} min={50} max={500} step={10} digits={0} onChange={(sp) => s.set({ sp })} />
              <ParamSlider label="Load in % of F_K" symbol="F/F_K" unit="%" value={s.load} min={0} max={130} step={1} digits={0} onChange={(load) => s.set({ load })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Buckling load F_K" value={nf(r.Fk / 1000, 2)} unit="kN" />
        <Kpi label="Buckling length l_K" value={nf(r.lk / 1000, 2)} unit="m" />
        <Kpi label="Slenderness λ" value={nf(r.lambda, 0)} sub={`λ_P = ${nf(r.lambdaP, 0)}`} />
        <Kpi label="Buckling stress σ_K" value={nf(r.sigmaK, 1)} unit="MPa" />
        <Kpi label="Applied load" value={nf(F / 1000, 2)} unit="kN" sub={s.load >= 100 ? t('buckled') : `${t('safety')} ${nf(100 / Math.max(s.load, 1e-9), 2)}`} />
      </div>
      {!r.valid && <Notice tone="warning">{t('λ < λ_P: the column is too stocky for Euler. The real buckling load is lower (inelastic buckling, e.g. Tetmajer); the Euler value is not safe here.')}</Notice>}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="The four Euler cases">
          <svg viewBox="0 0 560 320" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('The four Euler cases')}>
            <defs>
              <pattern id="hatchB" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--plant-500))" strokeWidth="1.5" />
              </pattern>
            </defs>
            {([1, 2, 3, 4] as EulerCase[]).map((cs, i) => (
              <Column key={cs} cs={cs} x={80 + i * 135} active={cs === c} />
            ))}
          </svg>
          <Caption>{t('First buckling mode of each case. Raise the load above 100 % to see the selected column buckle. Stiffer supports shorten the buckling length — case 4 carries 16 times the load of case 1.')}</Caption>
        </Card>
        <Card title="Euler hyperbola σ_K(λ)">
          <LineChartBox
            height={290}
            series={[
              { name: 'σ_K = π²E/λ²', data: hyper.filter((p) => p.x >= r.lambdaP), color: TM.v },
              { name: t('not valid (λ < λ_P)'), data: hyper.filter((p) => p.x <= r.lambdaP + 2), color: TM.v, dashed: true },
            ]}
            xLabel="λ"
            yLabel="σ_K [MPa]"
            yDomain={[0, 600]}
            refX={[
              { x: r.lambdaP, label: 'λ_P' },
              { x: r.lambda, label: 'λ' },
            ]}
            digits={0}
          />
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`I_{min} = ${nf(I / 1e4, 2)}\\,\\mathrm{cm^4},\\quad A = ${nf(A, 0)}\\,\\mathrm{mm^2},\\quad i = \\sqrt{I/A} = ${nf(r.i, 2)}\\,\\mathrm{mm}`} />
          <Tex block math={`l_K = \\beta\\,l = ${nf(BETA[c], 3)} \\cdot ${nf(s.l * 1000, 0)} = ${nf(r.lk, 0)}\\,\\mathrm{mm}`} />
          <Tex block math={`F_K = \\frac{\\pi^2 E I}{l_K^2} = \\frac{\\pi^2 \\cdot ${nf(s.E * 1e3, 0)} \\cdot ${nf(I, 0)}}{${nf(r.lk, 0)}^2} = ${nf(r.Fk / 1000, 3)}\\,\\mathrm{kN}`} />
          <Tex block math={`\\lambda = \\frac{l_K}{i} = ${nf(r.lambda, 1)},\\quad \\lambda_P = \\pi\\sqrt{\\frac{E}{\\sigma_P}} = ${nf(r.lambdaP, 1)}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
