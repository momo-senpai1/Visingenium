import { useMemo, useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { LineChartBox } from '@/components/heat/charts';
import { Card, fieldCls, nf, NumRow } from '@/components/mechanics/common';
import { Segmented } from '@/components/ui/segmented';
import { Kpi, Notice } from '@/components/workbench/controls';
import { eigenvalues, semiInfinite, seriesTheta, type Body } from '@/engine/heat/transient';
import { t } from '@/i18n';

const SOLIDS: Record<string, { label: string; rho: number; c: number; lambda: number }> = {
  steel: { label: 'Steel', rho: 7850, c: 470, lambda: 50 },
  alu: { label: 'Aluminium', rho: 2700, c: 900, lambda: 220 },
  copper: { label: 'Copper', rho: 8930, c: 385, lambda: 380 },
  concrete: { label: 'Concrete', rho: 2300, c: 880, lambda: 1.4 },
  wood: { label: 'Wood', rho: 600, c: 2400, lambda: 0.13 },
  potato: { label: 'Potato (food)', rho: 1100, c: 3600, lambda: 0.55 },
  glass: { label: 'Glass', rho: 2500, c: 840, lambda: 1.0 },
};

type Mode = 'body' | 'semi';

export default function TransientPage() {
  const [mode, setMode] = useState<Mode>('body');
  const [mat, setMat] = useState('concrete');
  const [body, setBody] = useState<Body>('cylinder');
  const [R, setR] = useState(50); // mm half-thickness / radius
  const [T0, setT0] = useState(20);
  const [Tinf, setTinf] = useState(200);
  const [alpha, setAlpha] = useState(100);
  const [tEnd, setTEnd] = useState(3600);
  const [alphaInf, setAlphaInf] = useState(false);
  const m = SOLIDS[mat]!;
  const a = m.lambda / (m.rho * m.c);
  const Rm = R / 1000;
  const Bi = (alpha * Rm) / m.lambda;
  const Lc = body === 'plate' ? Rm : body === 'cylinder' ? Rm / 2 : Rm / 3; // V/A
  const BiLumped = (alpha * Lc) / m.lambda;
  const tau = (m.rho * m.c * Lc) / alpha;
  const zs = useMemo(() => eigenvalues(body, Bi), [body, Bi]);
  const times = [0.1, 0.25, 0.5, 0.75, 1].map((f) => f * tEnd);

  const profiles = useMemo(
    () =>
      mode === 'body'
        ? times.map((tt) => ({
            name: `t = ${nf(tt, 0)} s`,
            data: Array.from({ length: 41 }, (_, i) => {
              const xi = i / 40;
              return { x: xi * R, y: Tinf + (T0 - Tinf) * seriesTheta(body, Bi, (a * tt) / Rm ** 2, xi, zs) };
            }),
          }))
        : times.map((tt) => ({
            name: `t = ${nf(tt, 0)} s`,
            data: Array.from({ length: 61 }, (_, i) => {
              const x = (i / 60) * 4 * Math.sqrt(a * tEnd);
              return { x: x * 1000, y: semiInfinite(x, tt, a, T0, Tinf, alphaInf ? null : alpha, m.lambda) };
            }),
          })),
    [mode, body, Bi, a, Rm, R, T0, Tinf, tEnd, zs, alpha, alphaInf, m.lambda], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const history = useMemo(
    () =>
      mode === 'body'
        ? [
            { name: t('centre'), data: Array.from({ length: 81 }, (_, i) => ({ x: (i / 80) * tEnd, y: Tinf + (T0 - Tinf) * seriesTheta(body, Bi, (a * (i / 80) * tEnd) / Rm ** 2, 0, zs) })) },
            { name: t('surface'), data: Array.from({ length: 81 }, (_, i) => ({ x: (i / 80) * tEnd, y: Tinf + (T0 - Tinf) * seriesTheta(body, Bi, (a * (i / 80) * tEnd) / Rm ** 2, 1, zs) })) },
            { name: t('lumped model'), data: Array.from({ length: 81 }, (_, i) => ({ x: (i / 80) * tEnd, y: Tinf + (T0 - Tinf) * Math.exp(-((i / 80) * tEnd) / tau) })), dashed: true },
          ]
        : [
            { name: t('surface'), data: Array.from({ length: 81 }, (_, i) => ({ x: (i / 80) * tEnd, y: semiInfinite(0, (i / 80) * tEnd, a, T0, Tinf, alphaInf ? null : alpha, m.lambda) })) },
            { name: 'x = 10 mm', data: Array.from({ length: 81 }, (_, i) => ({ x: (i / 80) * tEnd, y: semiInfinite(0.01, (i / 80) * tEnd, a, T0, Tinf, alphaInf ? null : alpha, m.lambda) })) },
          ],
    [mode, body, Bi, a, Rm, T0, Tinf, tEnd, zs, tau, alpha, alphaInf, m.lambda],
  );
  const FoEnd = (a * tEnd) / Rm ** 2;
  const thetaC = seriesTheta(body, Bi, FoEnd, 0, zs);
  const n = (v: number, k = 4) => nf(v, k).replace(',', '{,}');

  return (
    <div className="grid gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-2 xl:sticky xl:top-0 xl:self-start">
        <Card title="Problem">
          <div className="space-y-2">
            <Segmented value={mode} onChange={setMode} options={[{ value: 'body', label: 'Finite body (Gröber)' }, { value: 'semi', label: 'Semi-infinite body' }]} />
            {mode === 'body' && (
              <>
                <Segmented value={body} onChange={setBody} options={[{ value: 'plate', label: 'Plate' }, { value: 'cylinder', label: 'Cylinder' }, { value: 'sphere', label: 'Sphere' }]} />
                <NumRow label={body === 'plate' ? t('Half thickness s') : t('Radius R')} unit="mm" value={R} onChange={(v) => v > 0 && setR(v)} />
              </>
            )}
            <label className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-2 text-[11px] text-plant-300">
              <span>{t('Material')}</span>
              <select className={fieldCls} value={mat} onChange={(e) => setMat(e.target.value)}>
                {Object.entries(SOLIDS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
            </label>
            <p className="font-mono text-[10px] text-plant-400">
              ρ = {m.rho} kg/m³ · c = {m.c} J/kgK · λ = {m.lambda} W/mK · a = {(a * 1e6).toFixed(2)}·10⁻⁶ m²/s
            </p>
          </div>
        </Card>
        <Card title="Boundary conditions">
          <div className="space-y-2">
            <NumRow label={t('Initial temperature T_0')} unit="°C" value={T0} onChange={setT0} />
            <NumRow label={t('Fluid temperature T_∞')} unit="°C" value={Tinf} onChange={setTinf} />
            <NumRow label={t('Heat transfer coefficient α')} unit="W/m²K" value={alpha} onChange={(v) => v > 0 && setAlpha(v)} />
            {mode === 'semi' && (
              <label className="flex items-center gap-2 text-[11px] text-plant-300">
                <input type="checkbox" checked={alphaInf} onChange={(e) => setAlphaInf(e.target.checked)} /> {t('Surface jumps to T_∞ (α → ∞)')}
              </label>
            )}
            <NumRow label={t('Time span')} unit="s" value={tEnd} onChange={(v) => v > 0 && setTEnd(v)} />
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {mode === 'body' ? (
            <>
              <Kpi label="Bi = αR/λ" value={nf(Bi, 3)} sub={Bi < 0.1 ? t('uniform temperature') : t('gradient inside')} />
              <Kpi label="Fo = at/R²" value={nf(FoEnd, 3)} sub={`t = ${nf(tEnd, 0)} s`} />
              <Kpi label={t('Centre after t')} value={nf(Tinf + (T0 - Tinf) * thetaC, 1)} unit="°C" sub={`θ = ${nf(thetaC, 3)}`} />
              <Kpi label={t('Time constant τ')} value={nf(tau, 0)} unit="s" sub={`Bi_V = ${nf(BiLumped, 3)}`} />
              <Kpi label="ζ₁" value={nf(zs[0] ?? 0, 4)} sub={t('first eigenvalue')} />
            </>
          ) : (
            <>
              <Kpi label={t('Penetration depth')} value={nf(4 * Math.sqrt(a * tEnd) * 1000, 1)} unit="mm" sub="≈ 4√(a·t)" />
              <Kpi label={t('Surface after t')} value={nf(semiInfinite(0, tEnd, a, T0, Tinf, alphaInf ? null : alpha, m.lambda), 1)} unit="°C" />
              <Kpi label="a" value={nf(a * 1e6, 3)} unit="mm²/s" />
            </>
          )}
        </div>
        {mode === 'body' && BiLumped < 0.1 && <Notice tone="info">{t('Bi_V < 0.1: the lumped-capacitance model (dashed) is accurate.')}</Notice>}
        <div className="grid gap-2 lg:grid-cols-2">
          <Card title="Temperature profiles T(x) at several times">
            <LineChartBox series={profiles} xLabel={mode === 'body' ? (body === 'plate' ? t('distance from the mid-plane [mm]') : t('radius r [mm]')) : 'x [mm]'} yLabel="T [°C]" digits={1} />
          </Card>
          <Card title="Temperature over time">
            <LineChartBox series={history} xLabel="t [s]" yLabel="T [°C]" digits={1} />
          </Card>
        </div>
        <Card title="Solution path">
          <div className="text-[13px] text-plant-100">
            {mode === 'body' ? (
              <>
                <Tex
                  block
                  math={`\\theta = \\frac{T - T_\\infty}{T_0 - T_\\infty} = \\sum_n C_n\\, e^{-\\zeta_n^2 Fo}\\, ${body === 'plate' ? '\\cos(\\zeta_n x/s)' : body === 'cylinder' ? 'J_0(\\zeta_n r/R)' : '\\frac{\\sin(\\zeta_n r/R)}{\\zeta_n r/R}'}`}
                />
                <Tex block math={`${body === 'plate' ? '\\zeta \\tan\\zeta = Bi' : body === 'cylinder' ? '\\zeta \\frac{J_1(\\zeta)}{J_0(\\zeta)} = Bi' : '1 - \\zeta\\cot\\zeta = Bi'},\\quad Bi = \\frac{\\alpha R}{\\lambda} = ${n(Bi)},\\quad \\zeta_1 = ${n(zs[0] ?? 0)}`} />
                <Tex block math={`\\text{${t('lumped')}}:\\ T(t) = T_\\infty + (T_0 - T_\\infty)\\,e^{-t/\\tau},\\quad \\tau = \\frac{\\rho c V}{\\alpha A} = ${n(tau, 1)}\\ \\mathrm{s}`} />
              </>
            ) : (
              <Tex
                block
                math={
                  alphaInf
                    ? '\\frac{T - T_\\infty}{T_0 - T_\\infty} = \\operatorname{erf}\\!\\left(\\frac{x}{2\\sqrt{a t}}\\right)'
                    : '\\frac{T - T_0}{T_\\infty - T_0} = \\operatorname{erfc}\\,\\eta - e^{\\frac{\\alpha x}{\\lambda} + \\frac{\\alpha^2 a t}{\\lambda^2}}\\operatorname{erfc}\\!\\left(\\eta + \\frac{\\alpha\\sqrt{a t}}{\\lambda}\\right),\\quad \\eta = \\frac{x}{2\\sqrt{at}}'
                }
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
