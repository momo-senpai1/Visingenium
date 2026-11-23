/** TM 2: plane stress — rotating the element, Mohr's circle, principal stresses, equivalent stress. */

import { Tex } from '@/components/balance/Tex';
import { EeLayout, Idea } from '@/components/ee/common';
import { LineChartBox } from '@/components/heat/charts';
import { Card, nf } from '@/components/mechanics/common';
import { Arrow, Caption, Label, paramStore, TM } from '@/components/mechanics/tm';
import { ParamSlider } from '@/components/ParamSlider';
import { Kpi } from '@/components/workbench/controls';
import { t } from '@/i18n';
import { mohr, rotateStress } from '@/engine/mechanics/elasto';

const useStress = paramStore('tm-stress', { sx: 80, sz: -20, txz: 40, phi: 20 });

type P = [number, number];

/** square element rotated by φ (counter-clockwise on screen) with its stress arrows */
function Element({ sx, sz, txz, phi, cx, cy, scale }: { sx: number; sz: number; txz: number; phi: number; cx: number; cy: number; scale: number }) {
  const a = (-phi * Math.PI) / 180;
  const R = (p: P): P => [cx + p[0] * Math.cos(a) - p[1] * Math.sin(a), cy + p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const h = 42;
  const sq = [R([-h, -h]), R([h, -h]), R([h, h]), R([-h, h])];
  const L = (v: number) => Math.sign(v) * (10 + Math.abs(v) * scale);
  const arrows: { a: P; b: P; c: string }[] = [];
  // normal stresses on the ±x faces (local) and ±z faces; z drawn downward
  for (const sgn of [1, -1]) {
    const nx = R([sgn * (h + 18), 0]);
    const tx = R([sgn * (h + 18 + L(sx)), 0]);
    if (Math.abs(sx) > 0.5) arrows.push(sx > 0 ? { a: nx, b: tx, c: TM.load } : { a: R([sgn * (h + 18 - L(sx)), 0]), b: nx, c: TM.v });
    const nz = R([0, sgn * (h + 18)]);
    if (Math.abs(sz) > 0.5) arrows.push(sz > 0 ? { a: nz, b: R([0, sgn * (h + 18 + L(sz))]), c: TM.load } : { a: R([0, sgn * (h + 18 - L(sz))]), b: nz, c: TM.v });
    // shear: on +x face along +z, on +z face along +x (and opposite on the negative faces)
    if (Math.abs(txz) > 0.5) {
      const ts = L(txz) * 0.8;
      arrows.push({ a: R([sgn * (h + 8), -sgn * ts / 2]), b: R([sgn * (h + 8), sgn * ts / 2]), c: TM.aux });
      arrows.push({ a: R([-sgn * ts / 2, sgn * (h + 8)]), b: R([sgn * ts / 2, sgn * (h + 8)]), c: TM.aux });
    }
  }
  return (
    <g>
      <polygon points={sq.map((p) => p.join(',')).join(' ')} fill={TM.fill} fillOpacity={0.6} stroke={TM.body} strokeWidth={1.4} />
      {arrows.map((ar, i) => (
        <Arrow key={i} a={ar.a} b={ar.b} color={ar.c} width={2} />
      ))}
    </g>
  );
}

export default function StressPage() {
  const s = useStress();
  const m = mohr(s);
  const rs = rotateStress(s, s.phi);
  const smax = Math.max(1, Math.abs(m.s1), Math.abs(m.s2), m.r);
  const scale = 34 / smax;

  // Mohr circle: σ to the right, τ positive downward (so the point turns in the same sense as the element)
  const span = Math.max(Math.abs(m.m) + m.r, 1);
  const k = 150 / span;
  const X = (sg: number) => 190 + sg * k;
  const Y = (tau: number) => 175 + tau * k;
  const pX: P = [X(s.sx), Y(s.txz)];
  const pZ: P = [X(s.sz), Y(-s.txz)];
  const pXi: P = [X(rs.s1), Y(rs.t)];
  const pZe: P = [X(rs.s2), Y(-rs.t)];

  const curve = Array.from({ length: 181 }, (_, i) => {
    const r = rotateStress(s, i);
    return { phi: i, s: r.s1, t: r.t };
  });

  return (
    <EeLayout
      aside={
        <>
          <Card title="Stress state and Mohr's circle">
            <Idea>
              {t(
                'The stresses at a point depend on how you cut: turning the little element changes normal stress σ and shear stress τ on its faces. All these pairs (σ, τ) lie on one circle — Mohr\'s circle. Its centre is the mean stress, its radius the largest shear stress. Where the circle crosses the σ-axis, τ = 0: these are the principal stresses σ₁ and σ₂. Turning the element by φ moves the point by 2φ on the circle.',
              )}
            </Idea>
          </Card>
          <Card title="Stresses">
            <div className="space-y-3">
              <ParamSlider label="Normal stress" symbol="σ_x" unit="MPa" value={s.sx} min={-200} max={200} step={1} digits={0} onChange={(sx) => s.set({ sx })} />
              <ParamSlider label="Normal stress" symbol="σ_z" unit="MPa" value={s.sz} min={-200} max={200} step={1} digits={0} onChange={(sz) => s.set({ sz })} />
              <ParamSlider label="Shear stress" symbol="τ_xz" unit="MPa" value={s.txz} min={-150} max={150} step={1} digits={0} onChange={(txz) => s.set({ txz })} />
              <ParamSlider label="Rotation of the element" symbol="φ" unit="°" value={s.phi} min={0} max={180} step={0.5} onChange={(phi) => s.set({ phi })} />
              <button type="button" className="text-[11px] text-signal-liquid hover:underline" onClick={() => s.set({ phi: Math.round((((m.phi % 180) + 180) % 180) * 10) / 10 })}>
                {t('Turn to the principal directions')} (φ* = {nf(m.phi, 1)}°)
              </button>
            </div>
          </Card>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="σ₁ / σ₂" value={`${nf(m.s1, 1)} / ${nf(m.s2, 1)}`} unit="MPa" />
        <Kpi label="Principal direction φ*" value={nf(m.phi, 1)} unit="°" />
        <Kpi label="τ_max" value={nf(m.tmax, 1)} unit="MPa" sub={t('at φ* ± 45°')} />
        <Kpi label="von Mises σ_v" value={nf(m.vonMises, 1)} unit="MPa" />
        <Kpi label="Rotated element" value={`${nf(rs.s1, 1)} / ${nf(rs.s2, 1)} / ${nf(rs.t, 1)}`} unit="MPa" sub="σ_ξ / σ_ζ / τ_ξζ" />
      </div>
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <Card title="Element: original and rotated">
          <svg viewBox="0 0 420 290" className="mx-auto h-auto w-full max-w-[820px]" role="img" aria-label={t('Stress element')}>
            <Element sx={s.sx} sz={s.sz} txz={s.txz} phi={0} cx={105} cy={140} scale={scale} />
            <Element sx={rs.s1} sz={rs.s2} txz={rs.t} phi={s.phi} cx={315} cy={140} scale={scale} />
            <Label x={105} y={284} color={TM.muted}>
              x, z
            </Label>
            <Label x={315} y={284} color={TM.muted}>
              {`ξ, ζ (φ = ${nf(s.phi, 1)}°)`}
            </Label>
          </svg>
          <Caption>{t('Red: tension, blue: compression, yellow: shear. On every face pair the shear stresses are equal (pairing of shear stresses).')}</Caption>
        </Card>
        <Card title="Mohr's circle">
          <svg viewBox="0 0 380 350" className="mx-auto h-auto w-full max-w-[480px]" role="img" aria-label={t("Mohr's circle")}>
            <line x1={10} y1={Y(0)} x2={370} y2={Y(0)} stroke={TM.muted} />
            <line x1={X(0)} y1={10} x2={X(0)} y2={340} stroke={TM.muted} />
            <Label x={366} y={Y(0) - 6} anchor="end" color={TM.muted}>
              σ
            </Label>
            <Label x={X(0) + 6} y={336} anchor="start" color={TM.muted}>
              τ
            </Label>
            <circle cx={X(m.m)} cy={Y(0)} r={m.r * k} fill="none" stroke={TM.body} strokeWidth={1.6} />
            <line x1={pX[0]} y1={pX[1]} x2={pZ[0]} y2={pZ[1]} stroke={TM.muted} strokeDasharray="4 3" />
            <line x1={pXi[0]} y1={pXi[1]} x2={pZe[0]} y2={pZe[1]} stroke={TM.aux} strokeWidth={1.8} />
            <circle cx={pX[0]} cy={pX[1]} r={4} fill={TM.muted} />
            <circle cx={pZ[0]} cy={pZ[1]} r={4} fill={TM.muted} />
            <Label x={pX[0] + 8} y={pX[1] + 4} anchor="start" color={TM.muted}>
              X
            </Label>
            <Label x={pZ[0] - 8} y={pZ[1] + 4} anchor="end" color={TM.muted}>
              Z
            </Label>
            <circle cx={pXi[0]} cy={pXi[1]} r={5} fill={TM.aux} />
            <Label x={pXi[0] + 8} y={pXi[1] - 6} anchor="start" color={TM.aux}>
              ξ
            </Label>
            <circle cx={X(m.s1)} cy={Y(0)} r={4} fill={TM.load} />
            <circle cx={X(m.s2)} cy={Y(0)} r={4} fill={TM.v} />
            <Label x={X(m.s1)} y={Y(0) + 18} color={TM.load}>
              σ₁
            </Label>
            <Label x={X(m.s2)} y={Y(0) + 18} color={TM.v}>
              σ₂
            </Label>
            <Label x={X(m.m)} y={Y(-m.r) - 6} color={TM.muted}>
              τ_max
            </Label>
          </svg>
          <Caption>{t('X = (σ_x, τ_xz) and Z = (σ_z, −τ_xz) define the diameter. The yellow diameter belongs to the rotated element; it turns by 2φ. τ is plotted positive downward.')}</Caption>
        </Card>
      </div>
      <Card title="Stresses over the cutting angle">
        <LineChartBox
          height={230}
          series={[
            { name: 'σ_ξ(φ)', data: curve.map((c) => ({ x: c.phi, y: c.s })), color: TM.load },
            { name: 'τ_ξζ(φ)', data: curve.map((c) => ({ x: c.phi, y: c.t })), color: TM.aux },
          ]}
          xLabel="φ [°]"
          yLabel="MPa"
          refX={[
            { x: s.phi, label: 'φ' },
            { x: ((m.phi % 180) + 180) % 180, label: 'φ*' },
          ]}
          digits={0}
        />
      </Card>
      <Card title="Solution path">
        <div className="grid gap-x-6 text-[13px] text-plant-100 md:grid-cols-2">
          <Tex block math={`\\sigma_{1,2} = \\frac{\\sigma_x + \\sigma_z}{2} \\pm \\sqrt{\\left(\\frac{\\sigma_x - \\sigma_z}{2}\\right)^2 + \\tau_{xz}^2} = ${nf(m.m, 1)} \\pm ${nf(m.r, 1)}\\,\\mathrm{MPa}`} />
          <Tex block math={`\\tan 2\\varphi^* = \\frac{2\\tau_{xz}}{\\sigma_x - \\sigma_z} \\Rightarrow \\varphi^* = ${nf(m.phi, 2)}^\\circ`} />
          <Tex block math={`\\sigma_\\xi = \\frac{\\sigma_x + \\sigma_z}{2} + \\frac{\\sigma_x - \\sigma_z}{2}\\cos 2\\varphi + \\tau_{xz}\\sin 2\\varphi = ${nf(rs.s1, 2)}\\,\\mathrm{MPa}`} />
          <Tex block math={`\\tau_{\\xi\\zeta} = -\\frac{\\sigma_x - \\sigma_z}{2}\\sin 2\\varphi + \\tau_{xz}\\cos 2\\varphi = ${nf(rs.t, 2)}\\,\\mathrm{MPa}`} />
          <Tex block math={`\\sigma_v = \\sqrt{\\sigma_x^2 + \\sigma_z^2 - \\sigma_x\\sigma_z + 3\\tau_{xz}^2} = ${nf(m.vonMises, 1)}\\,\\mathrm{MPa}\\ \\ (\\text{von Mises})`} />
          <Tex block math={`\\sigma_x + \\sigma_z = \\sigma_\\xi + \\sigma_\\zeta = \\sigma_1 + \\sigma_2 = ${nf(s.sx + s.sz, 1)}\\,\\mathrm{MPa}\\ \\ (\\text{${t('invariant')}})`} />
        </div>
      </Card>
    </EeLayout>
  );
}
