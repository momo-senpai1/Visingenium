/** TM 1/2: centroid of composite areas, second moments with the parallel-axis theorem, principal axes and unsymmetric bending. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea } from '@/components/ee/common';
import { Card, nf } from '@/components/mechanics/common';
import { Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Segmented } from '@/components/ui/segmented';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { profile, section, type ProfileKind } from '@/engine/mechanics/statics';

const useSection = paramStore('tm-section', { kind: 'L' as ProfileKind, b: 80, h: 120, t: 12, My: 2 });

const KINDS: { value: ProfileKind; label: string }[] = [
  { value: 'rect', label: '▭' },
  { value: 'T', label: 'T' },
  { value: 'I', label: 'I' },
  { value: 'L', label: 'L' },
  { value: 'U', label: 'U' },
  { value: 'box', label: '□' },
];

/** stress colour: compression blue, tension red */
const stressColor = (v: number, vmax: number) => {
  const x = Math.max(-1, Math.min(1, vmax > 0 ? v / vmax : 0));
  return x >= 0 ? `rgba(239,90,80,${0.15 + 0.7 * x})` : `rgba(80,150,239,${0.15 + 0.7 * -x})`;
};

export default function CentroidPage() {
  const s = useSection();
  const rects = profile(s.kind, s.b, s.h, s.t);
  const r = section(rects);
  if (!r) return null;
  const Delta = r.Iy * r.Iz - r.Iyz * r.Iyz;
  // σ(y, z) = M_y (I_z z + I_yz y) / Δ, coordinates from the centroid (z downward), M_y in kNm → Nmm
  const My = s.My * 1e6;
  const sigma = (y: number, z: number) => (My * (r.Iz * (z - r.zS) + r.Iyz * (y - r.yS))) / Delta;
  const corners = rects.filter((q) => (q.sign ?? 1) > 0).flatMap((q) => [-1, 1].flatMap((a) => [-1, 1].map((b) => [q.y + (a * q.b) / 2, q.z + (b * q.h) / 2] as const)));
  const smax = Math.max(...corners.map(([y, z]) => Math.abs(sigma(y, z))), 1e-9);
  const extreme = corners.reduce((best, p) => (Math.abs(sigma(p[0], p[1])) > Math.abs(sigma(best[0], best[1])) ? p : best), corners[0]!);

  // drawing scale
  const ys = rects.flatMap((q) => [q.y - q.b / 2, q.y + q.b / 2]);
  const zs = rects.flatMap((q) => [q.z - q.h / 2, q.z + q.h / 2]);
  const y0 = Math.min(...ys);
  const z0 = Math.min(...zs);
  const span = Math.max(Math.max(...ys) - y0, Math.max(...zs) - z0, 1);
  const k = 240 / span;
  const X = (y: number) => 170 + (y - (y0 + Math.max(...ys)) / 2) * k;
  const Y = (z: number) => 170 + (z - (z0 + Math.max(...zs)) / 2) * k;
  const phi = (r.phi * Math.PI) / 180;
  const naAngle = Math.atan2(-r.Iyz, r.Iz); // neutral axis: z = −(I_yz/I_z) y
  const axis = (ang: number, len: number) => ({ x1: X(r.yS) - len * Math.cos(ang), y1: Y(r.zS) - len * Math.sin(ang), x2: X(r.yS) + len * Math.cos(ang), y2: Y(r.zS) + len * Math.sin(ang) });
  const cm4 = (v: number) => nf(v / 1e4, 1);
  const gridN = 18;

  return (
    <EeLayout
      aside={
        <>
          <Card title="Centroid and second moments of area">
            <Idea>
              {t(
                'The centroid S is the area-weighted mean position: y_S = Σ A_i y_i / Σ A_i. Holes count as negative areas. Second moments measure how far the area lies from an axis — they decide the bending stiffness. For each part: own moment plus A·d² (parallel-axis theorem, Steiner). If the section has no symmetry axis (L-profile), the product moment I_yz ≠ 0: the principal axes are rotated and a moment about y also bends the beam sideways (unsymmetric bending).',
              )}
            </Idea>
            <Segmented value={s.kind} onChange={(kind) => s.set({ kind })} options={KINDS} />
          </Card>
          <Card title="Dimensions">
            <div className="space-y-3">
              <ParamSlider label="Width" symbol="b" unit="mm" value={s.b} min={20} max={200} step={2} digits={0} onChange={(b) => s.set({ b })} />
              <ParamSlider label="Height" symbol="h" unit="mm" value={s.h} min={20} max={200} step={2} digits={0} onChange={(h) => s.set({ h })} />
              <ParamSlider label="Wall thickness" symbol="t" unit="mm" value={s.t} min={2} max={40} step={1} digits={0} disabled={s.kind === 'rect'} onChange={(tt) => s.set({ t: tt })} />
              <ParamSlider label="Bending moment" symbol="M_y" unit="kNm" value={s.My} min={-10} max={10} step={0.1} onChange={(My) => s.set({ My })} />
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Area A" value={nf(r.A / 100, 2)} unit="cm²" />
        <Kpi label="Centroid y_S / z_S" value={`${nf(r.yS - y0, 1)} / ${nf(r.zS - z0, 1)}`} unit="mm" sub={t('from the top left corner')} />
        <Kpi label="I_y / I_z" value={`${cm4(r.Iy)} / ${cm4(r.Iz)}`} unit="cm⁴" />
        <Kpi label="I_yz" value={cm4(r.Iyz)} unit="cm⁴" sub={Math.abs(r.Iyz) < 1e-6 ? t('symmetric: principal axes = y, z') : t('principal axes rotated')} />
        <Kpi label="I₁ / I₂" value={`${cm4(r.I1)} / ${cm4(r.I2)}`} unit="cm⁴" sub={`φ* = ${nf(r.phi, 1)}°`} />
      </div>
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Cross-section with centroid and principal axes">
          <svg viewBox="0 0 340 340" className="mx-auto h-auto w-full max-w-[460px]" role="img" aria-label={t('Cross-section')}>
            {rects.map((q, i) => (
              <rect key={i} x={X(q.y - q.b / 2)} y={Y(q.z - q.h / 2)} width={q.b * k} height={q.h * k} fill={(q.sign ?? 1) > 0 ? TM.fill : 'rgb(var(--plant-950))'} stroke={TM.body} strokeWidth={1} strokeDasharray={(q.sign ?? 1) > 0 ? undefined : '4 3'} />
            ))}
            {rects.map((q, i) => (
              <circle key={`c${i}`} cx={X(q.y)} cy={Y(q.z)} r={2.5} fill={TM.muted} />
            ))}
            <line {...axis(0, 160)} stroke={TM.muted} strokeDasharray="6 4" />
            <line {...axis(Math.PI / 2, 160)} stroke={TM.muted} strokeDasharray="6 4" />
            <Label x={X(r.yS) + 158} y={Y(r.zS) - 6} color={TM.muted}>
              y
            </Label>
            <Label x={X(r.yS) + 8} y={Y(r.zS) + 160} color={TM.muted} anchor="start">
              z
            </Label>
            <line {...axis(phi, 150)} stroke={TM.v} strokeWidth={1.6} />
            <line {...axis(phi + Math.PI / 2, 150)} stroke={TM.a} strokeWidth={1.6} />
            <Label x={X(r.yS) + 150 * Math.cos(phi) + 8} y={Y(r.zS) + 150 * Math.sin(phi)} color={TM.v} anchor="start">
              1
            </Label>
            <Label x={X(r.yS) + 150 * Math.cos(phi + Math.PI / 2) + 8} y={Y(r.zS) + 150 * Math.sin(phi + Math.PI / 2)} color={TM.a} anchor="start">
              2
            </Label>
            <circle cx={X(r.yS)} cy={Y(r.zS)} r={5} fill={TM.load} />
            <Label x={X(r.yS) - 9} y={Y(r.zS) - 8} color={TM.load} anchor="end">
              S
            </Label>
          </svg>
          <Caption>{t('Small dots: centroids of the parts. Dashed: centroidal y- and z-axes. Coloured: principal axes 1 (largest I) and 2.')}</Caption>
        </Card>
        <Card title="Bending stress σ(y, z) under M_y">
          <svg viewBox="0 0 340 340" className="mx-auto h-auto w-full max-w-[460px]" role="img" aria-label={t('Bending stress over the section')}>
            {rects
              .filter((q) => (q.sign ?? 1) > 0)
              .flatMap((q, i) =>
                Array.from({ length: gridN * gridN }, (_, j) => {
                  const a = j % gridN;
                  const b = Math.floor(j / gridN);
                  const y = q.y - q.b / 2 + ((a + 0.5) * q.b) / gridN;
                  const z = q.z - q.h / 2 + ((b + 0.5) * q.h) / gridN;
                  const hole = rects.some((h) => (h.sign ?? 1) < 0 && Math.abs(y - h.y) < h.b / 2 && Math.abs(z - h.z) < h.h / 2);
                  if (hole) return null;
                  return <rect key={`${i}-${j}`} x={X(y - q.b / gridN / 2)} y={Y(z - q.h / gridN / 2)} width={(q.b / gridN) * k + 0.4} height={(q.h / gridN) * k + 0.4} fill={stressColor(sigma(y, z), smax)} />;
                }),
              )}
            {rects.map((q, i) => (
              <rect key={`o${i}`} x={X(q.y - q.b / 2)} y={Y(q.z - q.h / 2)} width={q.b * k} height={q.h * k} fill="none" stroke={TM.body} strokeWidth={0.8} strokeDasharray={(q.sign ?? 1) > 0 ? undefined : '4 3'} />
            ))}
            {Math.abs(s.My) > 1e-9 && <line {...axis(naAngle, 170)} stroke={TM.text} strokeWidth={2} strokeDasharray="10 4" />}
            <circle cx={X(extreme[0])} cy={Y(extreme[1])} r={5} fill="none" stroke={TM.text} strokeWidth={1.5} />
            <Label x={X(extreme[0])} y={Y(extreme[1]) - 9}>{`σ_max = ${nf(sigma(extreme[0], extreme[1]), 1)} MPa`}</Label>
          </svg>
          <Caption>
            {t('Red: tension, blue: compression. Dashed line: neutral axis (σ = 0). With I_yz ≠ 0 it is tilted against the y-axis although the moment acts about y.')} {t('Inclination')}: {nf((naAngle * 180) / Math.PI, 1)}°
          </Caption>
        </Card>
      </div>
      <Card title="Steiner table">
        <div className="overflow-x-auto">
          <table className="w-full text-right font-mono text-[11px] text-plant-200">
            <thead className="text-[10px] text-plant-500">
              <tr>
                <th className="text-left">{t('Part')}</th>
                <th>A_i [mm²]</th>
                <th>y_i − y_S</th>
                <th>z_i − z_S</th>
                <th>I_y,i own</th>
                <th>A_i·Δz²</th>
                <th>I_z,i own</th>
                <th>A_i·Δy²</th>
                <th>−A_i·Δy·Δz</th>
              </tr>
            </thead>
            <tbody>
              {r.parts.map((p, i) => (
                <tr key={i} className="border-t border-white/[0.05]">
                  <td className="text-left">
                    {i + 1}
                    {p.A < 0 ? ` (${t('hole')})` : ''}
                  </td>
                  <td>{nf(p.A, 0)}</td>
                  <td>{nf(p.dy, 2)}</td>
                  <td>{nf(p.dz, 2)}</td>
                  <td>{nf(p.Iy0, 0)}</td>
                  <td>{nf(p.A * p.dz * p.dz, 0)}</td>
                  <td>{nf(p.Iz0, 0)}</td>
                  <td>{nf(p.A * p.dy * p.dy, 0)}</td>
                  <td>{nf(p.Iyz, 0)}</td>
                </tr>
              ))}
              <tr className="border-t border-white/[0.15] font-semibold text-plant-100">
                <td className="text-left">Σ</td>
                <td>{nf(r.A, 0)}</td>
                <td />
                <td />
                <td colSpan={2}>I_y = {nf(r.Iy, 0)}</td>
                <td colSpan={2}>I_z = {nf(r.Iz, 0)}</td>
                <td>I_yz = {nf(r.Iyz, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`y_S = \\frac{\\sum A_i y_i}{\\sum A_i} = ${nf(r.yS - y0, 2)}\\,\\mathrm{mm},\\quad z_S = \\frac{\\sum A_i z_i}{\\sum A_i} = ${nf(r.zS - z0, 2)}\\,\\mathrm{mm}`} />
          <Tex block math={`I_y = \\sum\\left(I_{y,i} + A_i\\,\\Delta z_i^2\\right) = ${cm4(r.Iy)}\\,\\mathrm{cm^4}`} />
          <Tex block math={`I_{yz} = -\\sum A_i\\,\\Delta y_i\\,\\Delta z_i = ${cm4(r.Iyz)}\\,\\mathrm{cm^4}`} />
          <Tex block math={`I_{1,2} = \\frac{I_y + I_z}{2} \\pm \\sqrt{\\left(\\frac{I_y - I_z}{2}\\right)^2 + I_{yz}^2} = ${cm4(r.I1)}\\ /\\ ${cm4(r.I2)}\\,\\mathrm{cm^4}`} />
          <Tex block math={`\\tan 2\\varphi^* = \\frac{2 I_{yz}}{I_y - I_z} \\Rightarrow \\varphi^* = ${nf(r.phi, 2)}^\\circ`} />
          <Tex block math={`\\sigma(y,z) = \\frac{M_y\\,(I_z\\,z + I_{yz}\\,y)}{I_y I_z - I_{yz}^2},\\quad \\sigma_{max} = ${nf(sigma(extreme[0], extreme[1]), 2)}\\,\\mathrm{MPa}`} />
        </div>
      </Card>
    </EeLayout>
  );
}
