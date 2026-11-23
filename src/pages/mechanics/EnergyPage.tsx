/** TM 2: energy methods — strain energy, Castigliano's theorem and Maxwell–Betti reciprocity on a cantilever. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { cantileverEnergy, cantileverInfluence } from '@/engine/mechanics/elasto';

const useEnergy = paramStore('tm-energy', { l: 2, E: 210, I: 800, F: 5, a: 1.6, b: 0.9 });

export default function EnergyPage() {
  const s = useEnergy();
  const EI = s.E * 1e3 * s.I * 1e4; // N/mm² · mm⁴
  const l = s.l * 1000;
  const a = Math.min(s.a, s.l) * 1000;
  const b = Math.min(s.b, s.l) * 1000;
  const F = s.F * 1000;
  const en = cantileverEnergy(F, a, EI);
  const wab = F * cantileverInfluence(b, a, EI); // deflection at b due to F at a
  const wba = F * cantileverInfluence(a, b, EI); // deflection at a due to F at b
  const w = (x: number, at: number) => F * cantileverInfluence(x, at, EI);
  const line = (at: number) => Array.from({ length: 81 }, (_, i) => ({ x: (s.l * i) / 80, y: w((l * i) / 80, at) }));
  const Ucurve = Array.from({ length: 61 }, (_, i) => {
    const Fi = (2 * F * i) / 60;
    return { x: Fi / 1000, y: cantileverEnergy(Fi, a, EI).U / 1000 };
  });
  // tangent at F: slope dU/dF = f
  const tangent = [
    { x: (F * 0.4) / 1000, y: (en.U - en.f * F * 0.6) / 1000 },
    { x: (F * 1.6) / 1000, y: (en.U + en.f * F * 0.6) / 1000 },
  ];

  const wmax = Math.max(w(l, a), w(l, b), 1e-9);
  const Beam = ({ at, mark, y0 }: { at: number; mark: number; y0: number }) => {
    const X = (x: number) => 60 + (x / l) * 460;
    const pts = Array.from({ length: 61 }, (_, i) => [X((l * i) / 60), y0 + (60 * w((l * i) / 60, at)) / wmax]);
    return (
      <g>
        <rect x={40} y={y0 - 40} width={20} height={80} fill="url(#hatchE)" stroke={TM.ground} />
        <line x1={X(0)} y1={y0} x2={X(l)} y2={y0} stroke={TM.muted} strokeDasharray="4 3" />
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={TM.body} strokeWidth={5} strokeLinecap="round" />
        <Arrow a={[X(at), y0 - 50 + (60 * w(at, at)) / wmax]} b={[X(at), y0 - 6 + (60 * w(at, at)) / wmax]} color={TM.load} label="F" labelOffset={[6, -28]} />
        <circle cx={X(mark)} cy={y0 + (60 * w(mark, at)) / wmax} r={5} fill={TM.aux} />
        <line x1={X(mark)} y1={y0} x2={X(mark)} y2={y0 + (60 * w(mark, at)) / wmax} stroke={TM.aux} strokeWidth={1.5} />
        <Label x={X(mark) + 8} y={y0 + (60 * w(mark, at)) / wmax + 18} anchor="start" color={TM.aux}>{`${nf(w(mark, at), 3)} mm`}</Label>
      </g>
    );
  };

  return (
    <EeLayout
      aside={
        <>
          <Card title="Energy methods">
            <Idea>
              {t(
                'A loaded elastic body stores strain energy U, for a beam in bending U = ∫ M²/(2EI) dx. Castigliano: the displacement at a load in its direction is the derivative of U with respect to that load, f = ∂U/∂F — the slope of the U(F) parabola. Maxwell–Betti: a force at point a causes the same deflection at b as the same force at b causes at a. Both save you from solving the differential equation of the deflection curve.',
              )}
            </Idea>
          </Card>
          <Card title="Cantilever">
            <div className="space-y-3">
              <ParamSlider label="Length" symbol="l" unit="m" value={s.l} min={0.5} max={5} step={0.1} onChange={(v) => s.set({ l: v })} />
              <ParamSlider label="Young's modulus" symbol="E" unit="GPa" value={s.E} min={10} max={250} step={5} digits={0} onChange={(E) => s.set({ E })} />
              <ParamSlider label="Second moment of area" symbol="I" unit="cm⁴" value={s.I} min={50} max={5000} step={50} digits={0} onChange={(I) => s.set({ I })} />
              <ParamSlider label="Force" symbol="F" unit="kN" value={s.F} min={0.5} max={30} step={0.5} onChange={(F2) => s.set({ F: F2 })} />
              <ParamSlider label="Load position" symbol="a" unit="m" value={Math.min(s.a, s.l)} min={0.1} max={s.l} step={0.05} digits={2} onChange={(v) => s.set({ a: v })} />
              <ParamSlider label="Observed point" symbol="b" unit="m" value={Math.min(s.b, s.l)} min={0.1} max={s.l} step={0.05} digits={2} onChange={(v) => s.set({ b: v })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Strain energy U" value={nf(en.U / 1000, 3)} unit="J" />
        <Kpi label="Deflection under F" value={nf(en.f, 3)} unit="mm" sub="f = ∂U/∂F" />
        <Kpi label="w_b (F at a)" value={nf(wab, 4)} unit="mm" />
        <Kpi label="w_a (F at b)" value={nf(wba, 4)} unit="mm" sub={t('equal: Maxwell–Betti')} />
      </div>
      <Card title="Maxwell–Betti: swap load and measuring point">
        <svg viewBox="0 0 580 300" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Cantilever with swapped load and measuring point')}>
          <defs>
            <pattern id="hatchE" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--plant-500))" strokeWidth="1.5" />
            </pattern>
          </defs>
          <Beam at={a} mark={b} y0={70} />
          <Beam at={b} mark={a} y0={210} />
        </svg>
        <Caption>{t('Top: F at a, deflection measured at b (yellow). Bottom: F at b, measured at a. The yellow values are identical for any a and b.')}</Caption>
      </Card>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card title="Castigliano: U(F) and its slope">
          <LineChartBox
            height={260}
            series={[
              { name: 'U(F) [J]', data: Ucurve, color: TM.v },
              { name: t('tangent, slope = f'), data: tangent, color: TM.aux, dashed: true },
            ]}
            xLabel="F [kN]"
            yLabel="U [J]"
            refX={[{ x: s.F, label: 'F' }]}
            digits={2}
          />
          <Caption>{t('U grows with F² — doubling the force stores four times the energy. The slope of the tangent at the current force is the deflection under the load.')}</Caption>
        </Card>
        <Card title="Deflection curves">
          <LineChartBox
            height={260}
            series={[
              { name: t('F at a'), data: line(a), color: TM.load },
              { name: t('F at b'), data: line(b), color: TM.v, dashed: true },
            ]}
            xLabel="x [m]"
            yLabel="w [mm]"
            refX={[
              { x: a / 1000, label: 'a' },
              { x: b / 1000, label: 'b' },
            ]}
            digits={2}
          />
        </Card>
      </div>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`M(x) = -F\\,(a - x)\\ \\ (0 \\le x \\le a),\\qquad U = \\int_0^a \\frac{M^2}{2EI}\\,\\mathrm dx = \\frac{F^2 a^3}{6EI}`} />
          <Tex block math={`U = \\frac{${nf(F, 0)}^2 \\cdot ${nf(a, 0)}^3}{6 \\cdot ${nf(EI / 1e9, 1)}\\cdot 10^9} = ${nf(en.U / 1000, 4)}\\,\\mathrm J`} />
          <Tex block math={`f = \\frac{\\partial U}{\\partial F} = \\frac{F a^3}{3EI} = ${nf(en.f, 4)}\\,\\mathrm{mm}`} />
          <Tex block math={`w_b = \\frac{F\\,${b <= a ? 'b^2(3a - b)' : 'a^2(3b - a)'}}{6EI} = ${nf(wab, 4)}\\,\\mathrm{mm} = w_a`} />
          <Tex block math={`\\text{${t('Work of the load')}}:\\ W = \\tfrac12 F f = ${nf((0.5 * F * en.f) / 1000, 4)}\\,\\mathrm J = U\\ \\ (\\text{Clapeyron})`} />
        </div>
      </Card>
    </EeLayout>
  );
}
