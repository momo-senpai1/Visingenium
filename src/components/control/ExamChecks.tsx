/**
 * The quantities old RWTH "Regelungstechnik" exams ask for (Aufgabe 2, frequency domain), read off
 * the open loop L(jω): applicability of the simplified Nyquist criterion, phase/gain margin with
 * the gain margin as a factor A_R, static control factor R, maximum dead time, gain for a target
 * phase margin, Ziegler–Nichols settings and the phase lost by a digital (sampled) controller.
 */

import { useState } from 'react';
import { Tex } from '@/components/balance/Tex';
import { Card, nf } from '@/components/mechanics/common';
import { ParamSlider } from '@/components/ParamSlider';
import { Notice } from '@/components/workbench/controls';
import { bode, freq, margins, roots, type TF } from '@/engine/control/poly';
import { t } from '@/i18n';

const r2d = (r: number) => (r * 180) / Math.PI;

export function ExamChecks({ L }: { L: TF }) {
  const [target, setTarget] = useState(45);
  const [Ts, setTs] = useState(0.1);
  const [arT, setArT] = useState(2);
  const mg = margins(L);
  const poles = roots(L.den);
  const atOrigin = poles.filter((p) => Math.hypot(p.re, p.im) < 1e-7).length;
  const rhp = poles.filter((p) => p.re > 1e-9).length;
  const onAxis = poles.filter((p) => Math.abs(p.re) <= 1e-9 && Math.abs(p.im) > 1e-7).length;
  const simple = rhp === 0 && onAxis === 0 && atOrigin <= 2;
  // static control factor R = 1/(1 + K0); with an integrator in L the error vanishes (R = 0)
  const K0 = atOrigin > 0 ? Infinity : freq(L, 1e-9).re;
  const R = Number.isFinite(K0) ? 1 / (1 + K0) : 0;
  const AR = mg.gm === null ? null : 10 ** (mg.gm / 20);
  const TtMax = mg.pm !== null && mg.wc ? (mg.pm * Math.PI) / 180 / mg.wc : null;
  // gain factor for a target phase margin: |L| must be 1 where φ = −180° + α
  const pts = bode(L, 1e-4, 1e5, 3000);
  const want = -180 + target;
  const hit = pts.find((p, i) => i > 0 && (pts[i - 1]!.deg - want) * (p.deg - want) <= 0);
  const kFor = hit ? 1 / 10 ** (hit.db / 20) : null;
  // Ziegler–Nichols (stability limit): K_krit = A_R (relative to the present gain), T_krit = 2π/ω₁₈₀
  const Tk = mg.w180 ? (2 * Math.PI) / mg.w180 : null;
  // sampled controller (quasi-continuous): zero-order hold ≈ dead time T/2 → phase loss ω_c·T/2
  const loss = mg.wc ? r2d((mg.wc * Ts) / 2) : null;
  // extra dead time for a wanted gain margin: at ω_A with |L| = 1/A_R the phase must reach −180°
  const lvl = -20 * Math.log10(arT);
  const iA = pts.findIndex((p, i) => i > 0 && pts[i - 1]!.db >= lvl && p.db < lvl);
  const pA = iA > 0 ? pts[iA]! : null;
  const TtForAR = pA && pA.deg > -180 ? ((pA.deg + 180) * Math.PI) / 180 / pA.w : null;
  const n = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : nf(v, d));
  return (
    <Card title="Exam values (frequency domain)">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-[11px] leading-relaxed text-plant-300">
          <p className="tag text-plant-500">{t('Simplified Nyquist criterion')}</p>
          <p>
            {t('Open-loop poles: {r} in the right half-plane, {o} at the origin, {a} on the imaginary axis.', { r: rhp, o: atOrigin, a: onAxis })}{' '}
            {simple ? (
              <span className="text-signal-ok">{t('Applicable: no unstable poles and at most a double pole at the origin.')}</span>
            ) : (
              <span className="text-signal-heat">{t('Not applicable — use the full Nyquist criterion (count the encirclements of −1).')}</span>
            )}
          </p>
          <div className="text-[13px] text-plant-100">
            <Tex block math={`\\alpha_R = 180^\\circ + \\varphi_0(\\omega_d) = ${n(mg.pm, 1)}^\\circ,\\quad \\omega_d = ${n(mg.wc)}\\,\\mathrm{s^{-1}}`} />
            <Tex block math={`A_R = \\frac{1}{|G_0(j\\omega_{180})|} = ${n(AR)}\\ (${n(mg.gm, 1)}\\,\\mathrm{dB}),\\quad \\omega_{180} = ${n(mg.w180)}\\,\\mathrm{s^{-1}}`} />
            <Tex block math={`R = \\frac{1}{1 + K_0} = ${Number.isFinite(K0) ? n(R, 4) : `0\\ (\\text{${t('integral action')}})`}`} />
            <Tex block math={`T_{t,\\max} = \\frac{\\alpha_R}{\\omega_d} = ${n(TtMax)}\\,\\mathrm s`} />
          </div>
          {AR !== null && AR < 2 && <Notice tone="warning">{t('Gain margin below 2: common design rules ask for A_R ≥ 2 (6 dB).')}</Notice>}
        </div>
        <div className="space-y-3">
          <ParamSlider label="Target phase margin" symbol="α_R" unit="°" value={target} min={20} max={90} step={1} digits={0} onChange={setTarget} />
          <div className="text-[13px] text-plant-100">
            <Tex block math={`\\varphi_0(\\omega) = -180^\\circ + ${target}^\\circ \\text{ at } \\omega = ${n(hit?.w ?? null)}\\,\\mathrm{s^{-1}} \\Rightarrow K_\\text{neu} = K\\cdot ${n(kFor)}`} />
          </div>
          <p className="tag text-plant-500">Ziegler–Nichols</p>
          <div className="text-[13px] text-plant-100">
            <Tex block math={`K_\\mathrm{krit} = K\\cdot ${n(AR)},\\quad T_\\mathrm{krit} = \\frac{2\\pi}{\\omega_{180}} = ${n(Tk)}\\,\\mathrm s`} />
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-plant-500">
                <th className="py-0.5 font-normal">{t('Controller')}</th>
                <th className="py-0.5 text-right font-normal">K_R / K</th>
                <th className="py-0.5 text-right font-normal">T_n [s]</th>
                <th className="py-0.5 text-right font-normal">T_v [s]</th>
              </tr>
            </thead>
            <tbody className="text-plant-100">
              {(
                [
                  ['P', 0.5, null, null],
                  ['PI', 0.45, 0.85, null],
                  ['PID', 0.6, 0.5, 0.125],
                ] as const
              ).map(([name, k, tn, tv]) => (
                <tr key={name} className="border-t border-white/[0.04]">
                  <td className="py-0.5">{name}</td>
                  <td className="py-0.5 text-right">{AR === null ? '–' : n(k * AR)}</td>
                  <td className="py-0.5 text-right">{tn === null || Tk === null ? '–' : n(tn * Tk, 2)}</td>
                  <td className="py-0.5 text-right">{tv === null || Tk === null ? '–' : n(tv * Tk, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ParamSlider label="Wanted gain margin" symbol="A_R" value={arT} min={1.1} max={10} step={0.1} onChange={setArT} />
          <div className="text-[13px] text-plant-100">
            <Tex
              block
              math={`|G_0(j\\omega_A)| = \\tfrac{1}{${n(arT, 2)}}\\text{ at }\\omega_A = ${n(pA?.w ?? null)}\\,\\mathrm{s^{-1}},\\quad \\varphi_0(\\omega_A) = ${n(pA?.deg ?? null, 1)}^\\circ`}
            />
            <Tex block math={`\\Delta T_t = \\frac{180^\\circ + \\varphi_0(\\omega_A)}{\\omega_A} = ${n(TtForAR)}\\,\\mathrm s`} />
          </div>
          {pA && TtForAR === null && <p className="text-[10px] text-signal-heat">{t('The phase is already below −180° there: no additional dead time is possible for this gain margin.')}</p>}
          <ParamSlider label="Sampling time of a digital controller" symbol="T" unit="s" value={Ts} min={0.001} max={2} step={0.001} digits={3} onChange={setTs} />
          <div className="text-[13px] text-plant-100">
            <Tex
              block
              math={`\\Delta\\varphi = -\\omega_d\\,\\frac{T}{2} = -${n(loss, 1)}^\\circ \\Rightarrow \\alpha_{R,\\mathrm{digital}} \\approx ${mg.pm !== null && loss !== null ? n(mg.pm - loss, 1) : '–'}^\\circ`}
            />
          </div>
          <p className="text-[10px] leading-relaxed text-plant-500">
            {t('Quasi-continuous view: the hold element acts like a dead time of half a sampling period. Rule of thumb: sample at least 5–10 times faster than the bandwidth.')}
          </p>
        </div>
      </div>
    </Card>
  );
}
