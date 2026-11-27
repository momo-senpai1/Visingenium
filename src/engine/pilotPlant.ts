/**
 * Pilot plant: one benzene/toluene rectification column that links the four subjects.
 *
 *   process        McCabe–Thiele (constant molar overflow) → x_D, x_B, V, L, V′, L′
 *   thermodynamics V·ΔH_v → condenser and reboiler duty, steam / cooling water, minimum work, exergy
 *   electrics      pumps + (optional) electric reboiler → P, Q, S, cos φ, line current, compensation
 *   control        tray temperature loop: first-order-plus-dead-time plant from the steady-state
 *                  gain dT/dQ and the hold-up, PI tuned by SIMC, closed-loop step response
 *
 * Everything is a steady-state model; the dynamics of the control loop are an estimate
 * (FOPDT) from the process gain and the liquid hold-up, not a rigorous dynamic simulation.
 */

import { COMPONENTS, getComponents } from './components';
import { blockTF } from './control/loop';
import { feedback, margins, series, stepInfo, stepResponse, tf, type TF } from './control/poly';
import { rateColumn, type McCabeThieleResult } from './mccabeThiele';
import { averageRelativeVolatility, bubbleTemperature } from './thermodynamics';
import { satP } from './thermo/steam';

const BEN = COMPONENTS.benzene;
const TOL = COMPONENTS.toluene;
const G = 9.80665;
const R_GAS = 8.314462618;
const T0 = 298.15;
const CP_WATER = 4.18; // kJ/(kg K)

export interface PlantSpec {
  /** feed, kmol/h */
  F: number;
  /** feed benzene fraction */
  zF: number;
  q: number;
  /** equilibrium stages incl. reboiler (1 = top) */
  N: number;
  R: number;
  DF: number;
  /** column pressure, kPa */
  P: number;
  /** stage whose temperature is controlled (1 … N) */
  sensor: number;
  heating: 'electric' | 'steam';
  /** saturated steam pressure, bar abs */
  steamBar: number;
  etaHeater: number;
  /** cooling-water temperature rise, K */
  dTcw: number;
  /** supply voltage (line-to-line), V */
  U: number;
  /** power factor of the pump motors */
  cosPhiMotor: number;
  etaMotor: number;
  etaPump: number;
  /** pump head, m */
  head: number;
  /** electricity €/kWh and steam €/t */
  priceEl: number;
  priceSteam: number;
  /** liquid hold-up per stage, kmol */
  holdup: number;
  /** other motor loads (cooling-water pump, vacuum, instruments), kW electric */
  aux: number;
}

export const DEFAULT_PLANT: PlantSpec = {
  F: 5,
  zF: 0.5,
  q: 1,
  N: 14,
  R: 2.2,
  DF: 0.5,
  P: 101.325,
  sensor: 10,
  heating: 'electric',
  steamBar: 4,
  etaHeater: 0.97,
  dTcw: 10,
  U: 400,
  cosPhiMotor: 0.82,
  etaMotor: 0.88,
  etaPump: 0.55,
  head: 30,
  priceEl: 0.25,
  priceSteam: 40,
  holdup: 0.15,
  aux: 1.5,
};

const mix = (x: number, a: number, b: number) => x * a + (1 - x) * b;
/** mean molar mass [kg/kmol] and liquid density [kg/m³] of a benzene/toluene mixture (ideal volumes) */
function liquid(x: number) {
  const M = mix(x, BEN.mw, TOL.mw);
  const w = (x * BEN.mw) / M; // mass fraction benzene
  return { M, rho: 1 / (w / BEN.rhoL + (1 - w) / TOL.rhoL) };
}
const xlnx = (x: number) => (x > 0 ? x * Math.log(x) : 0);

export interface PlantResult {
  col: McCabeThieleResult;
  alpha: number;
  /** liquid temperature [°C] on every stage (index 0 = stage 1) and at the reflux drum / reboiler */
  tray: number[];
  Ttop: number;
  Tbot: number;
  thermo: {
    dHtop: number;
    dHbot: number;
    Qcond: number;
    Qreb: number;
    steamT: number;
    hfg: number;
    steamKgH: number;
    steamOk: boolean;
    cwM3h: number;
    Wmin: number;
    exergyIn: number;
    etaII: number;
    kWhPerKg: number;
  };
  elec: {
    feedPump: { Pel: number; Phyd: number; Vdot: number; rho: number };
    refluxPump: { Pel: number; Phyd: number; Vdot: number; rho: number };
    Pheat: number;
    /** all motor loads: both pumps plus the other consumers */
    Ppumps: number;
    Paux: number;
    P: number;
    Q: number;
    S: number;
    cosPhi: number;
    I: number;
    /** reactive power and capacitance per phase (delta) to reach cos φ = 0.95 */
    Qc: number;
    Cdelta: number;
    costPerH: number;
  };
  control: {
    /** process gain [K/kW] (sign kept) */
    K: number;
    /** time constant and dead time [min] */
    tau: number;
    theta: number;
  };
}

export function ratePlant(s: PlantSpec): PlantResult {
  const P = s.P;
  const alpha = averageRelativeVolatility(BEN, TOL, P);
  const col = rateColumn({ alpha, F: s.F, zF: s.zF, q: s.q, N: s.N, R: s.R, DF: s.DF, condenser: 'total' });
  const comps = getComponents(['benzene', 'toluene']);
  const Tk = (x: number) => bubbleTemperature(comps, [x, 1 - x], P).T - 273.15;
  const tray = col.steps.filter((p) => p.stage >= 1).map((p) => Tk(p.x));
  const Ttop = Tk(col.xD);
  const Tbot = Tk(col.xB);

  // ---- thermodynamics
  const dHtop = mix(col.xD, BEN.dHvap, TOL.dHvap) / 1000; // kJ/mol
  const dHbot = mix(col.xB, BEN.dHvap, TOL.dHvap) / 1000;
  const mol = 1000 / 3600; // kmol/h → mol/s
  const Qcond = col.V * mol * dHtop; // kW
  const Qreb = col.Vp * mol * dHbot;
  const steam = satP(s.steamBar * 100);
  const hfg = steam.hV - steam.hL;
  const steamKgH = s.heating === 'steam' ? (Qreb / hfg) * 3600 : 0;
  const cwM3h = ((Qcond / (CP_WATER * s.dTcw)) * 3600) / 1000;
  const sum = (x: number) => xlnx(x) + xlnx(1 - x);
  // minimum work of separation (ideal mixture), kW
  const Wmin = (R_GAS * T0 * mol * (col.D * sum(col.xD) + col.B * sum(col.xB) - s.F * sum(s.zF))) / 1000;
  const TrebK = Tbot + 273.15;
  const exergyIn = Qreb * (1 - T0 / TrebK);
  const distKg = col.D * (col.xD * BEN.mw + (1 - col.xD) * TOL.mw);
  const thermo = {
    dHtop,
    dHbot,
    Qcond,
    Qreb,
    steamT: steam.T - 273.15,
    hfg,
    steamKgH,
    steamOk: steam.T - 273.15 > Tbot + 10,
    cwM3h,
    Wmin,
    exergyIn,
    etaII: exergyIn > 0 ? Wmin / exergyIn : 0,
    // heat per kg distillate [kWh/kg] = kW / (kg/h)
    kWhPerKg: distKg > 0 ? (s.heating === 'electric' ? Qreb / s.etaHeater : Qreb) / distKg : 0,
  };

  // ---- electrics
  const pump = (flowKmolH: number, x: number) => {
    const { M, rho } = liquid(x);
    const Vdot = (flowKmolH * M) / rho / 3600; // m³/s
    const Phyd = (rho * G * s.head * Vdot) / 1000; // kW
    return { Vdot: Vdot * 3600, Phyd, Pel: Phyd / (s.etaPump * s.etaMotor), rho };
  };
  const feedPump = pump(s.F, s.zF);
  const refluxPump = pump(col.L, col.xD);
  const Paux = Math.max(0, s.aux);
  const Ppumps = feedPump.Pel + refluxPump.Pel + Paux;
  const Pheat = s.heating === 'electric' ? Qreb / s.etaHeater : 0;
  const Pt = Ppumps + Pheat;
  const Qt = Ppumps * Math.tan(Math.acos(s.cosPhiMotor));
  const S = Math.hypot(Pt, Qt);
  const cosPhi = S > 0 ? Pt / S : 1;
  const I = (S * 1000) / (Math.sqrt(3) * s.U);
  const target = Math.tan(Math.acos(0.95));
  const Qc = Math.max(0, Qt - Pt * target);
  const Cdelta = (Qc * 1000) / (3 * 2 * Math.PI * 50 * s.U ** 2);
  const costPerH = Pt * s.priceEl + (steamKgH / 1000) * s.priceSteam;

  // ---- control: dT_sensor/dQ_reb from a 1 % reflux step, FOPDT from hold-up
  const eps = Math.max(0.01 * s.R, 1e-3);
  let K = 0;
  try {
    const c2 = rateColumn({ alpha, F: s.F, zF: s.zF, q: s.q, N: s.N, R: s.R + eps, DF: s.DF, condenser: 'total' });
    const st = Math.min(Math.max(Math.round(s.sensor), 1), s.N);
    const T1 = tray[st - 1] ?? Ttop;
    const T2 = Tk(c2.steps.find((p) => p.stage === st)?.x ?? col.xD);
    const Q2 = c2.Vp * mol * dHbot;
    K = Q2 - Qreb !== 0 ? (T2 - T1) / (Q2 - Qreb) : 0;
  } catch {
    K = 0;
  }
  const st = Math.min(Math.max(Math.round(s.sensor), 1), s.N);
  const nBelow = s.N - st + 1;
  const tau = (nBelow * s.holdup * 60) / Math.max(col.Lp, 1e-9); // min
  const theta = Math.max(0.08, 0.12 * tau);

  return {
    col,
    alpha,
    tray,
    Ttop,
    Tbot,
    thermo,
    elec: { feedPump, refluxPump, Pheat, Ppumps, Paux, P: Pt, Q: Qt, S, cosPhi, I, Qc, Cdelta, costPerH },
    control: { K, tau, theta },
  };
}

// ---------------------------------------------------------------- control loop

export interface LoopResult {
  Kc: number;
  Ti: number;
  plant: TF;
  C: TF;
  L: TF;
  margins: ReturnType<typeof margins>;
  /** setpoint step of 1 K: temperature deviation, controller output [kW] and the open-loop reaction curve */
  t: number[];
  y: number[];
  u: number[];
  open: number[];
  info: ReturnType<typeof stepInfo>;
  tEnd: number;
}

/** SIMC tuning (τc = θ) for K e^{−θs}/(τs+1). Gain K may be negative: the sign is carried by Kc. */
export function simc(K: number, tau: number, theta: number): { Kc: number; Ti: number } {
  const Kc = tau / (K * (theta + theta));
  return { Kc, Ti: Math.min(tau, 4 * (theta + theta)) };
}

export function rateLoop(K: number, tau: number, theta: number, Kc: number, Ti: number): LoopResult {
  const plant = blockTF({ kind: 'PTt', K, T: tau, Tt: theta });
  const C = blockTF({ kind: 'PI', K: Kc, Ti });
  const L = series(C, plant);
  const tEnd = Math.max(10, 10 * (tau + theta) * 0.6);
  const n = 400;
  const closed = feedback(L, tf([1], [1]), -1);
  const toU = feedback(C, plant, -1);
  const ry = stepResponse(closed, tEnd, n);
  const ru = stepResponse(toU, tEnd, n);
  const ro = stepResponse(plant, tEnd, n);
  return {
    Kc,
    Ti,
    plant,
    C,
    L,
    margins: margins(L),
    t: ry.t,
    y: ry.y,
    u: ru.y,
    open: ro.y,
    info: ry.t.length ? stepInfo(ry.t, ry.y, 1) : null,
    tEnd,
  };
}
