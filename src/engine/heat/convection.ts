/**
 * Convective heat transfer: fluid properties (air, water at ~1 bar) and
 * Nusselt correlations from the VDI-Wärmeatlas / standard textbooks.
 */

export type Fluid = 'air' | 'water';

/** T [°C] → ρ [kg/m³], cp [J/(kg K)], λ [W/(m K)], ν [m²/s], Pr, β [1/K] */
const AIR: [number, number, number, number, number, number][] = [
  // T, ρ, cp, λ, ν·1e6, Pr
  [-20, 1.377, 1006, 0.0226, 11.6, 0.716],
  [0, 1.275, 1006, 0.0242, 13.5, 0.711],
  [20, 1.188, 1007, 0.0257, 15.35, 0.709],
  [40, 1.112, 1007, 0.0271, 17.3, 0.706],
  [60, 1.045, 1009, 0.0285, 19.2, 0.703],
  [80, 0.9859, 1010, 0.0299, 21.2, 0.701],
  [100, 0.9329, 1012, 0.0314, 23.3, 0.700],
  [150, 0.8226, 1017, 0.0349, 28.8, 0.697],
  [200, 0.7356, 1025, 0.0383, 34.8, 0.695],
  [300, 0.6075, 1045, 0.0446, 48.2, 0.694],
  [400, 0.5172, 1069, 0.0505, 63.0, 0.699],
  [500, 0.4503, 1092, 0.0559, 79.4, 0.704],
];
const WATER: [number, number, number, number, number, number, number][] = [
  // T, ρ, cp, λ, ν·1e6, Pr, β·1e3
  [0.01, 999.8, 4220, 0.561, 1.792, 13.5, -0.068],
  [10, 999.7, 4196, 0.580, 1.306, 9.45, 0.088],
  [20, 998.2, 4184, 0.598, 1.004, 7.00, 0.207],
  [30, 995.6, 4180, 0.615, 0.801, 5.41, 0.303],
  [40, 992.2, 4180, 0.630, 0.658, 4.32, 0.385],
  [50, 988.0, 4181, 0.643, 0.554, 3.56, 0.457],
  [60, 983.2, 4185, 0.654, 0.475, 2.99, 0.523],
  [70, 977.8, 4190, 0.663, 0.413, 2.56, 0.585],
  [80, 971.8, 4197, 0.670, 0.365, 2.23, 0.643],
  [90, 965.3, 4205, 0.675, 0.326, 1.96, 0.698],
  [100, 958.4, 4216, 0.679, 0.295, 1.75, 0.752],
];

export interface Props {
  rho: number;
  cp: number;
  lambda: number;
  nu: number;
  Pr: number;
  beta: number;
  a: number;
}

function interp<T extends number[]>(table: T[], T: number, col: number) {
  const t = Math.min(Math.max(T, table[0]![0]!), table.at(-1)![0]!);
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i]![0]!) {
      const f = (t - table[i - 1]![0]!) / (table[i]![0]! - table[i - 1]![0]!);
      return table[i - 1]![col]! + f * (table[i]![col]! - table[i - 1]![col]!);
    }
  }
  return table.at(-1)![col]!;
}

export function props(fluid: Fluid, T: number): Props {
  if (fluid === 'air') {
    const rho = interp(AIR, T, 1);
    const cp = interp(AIR, T, 2);
    const lambda = interp(AIR, T, 3);
    return { rho, cp, lambda, nu: interp(AIR, T, 4) * 1e-6, Pr: interp(AIR, T, 5), beta: 1 / (T + 273.15), a: lambda / (rho * cp) };
  }
  const rho = interp(WATER, T, 1);
  const cp = interp(WATER, T, 2);
  const lambda = interp(WATER, T, 3);
  return { rho, cp, lambda, nu: interp(WATER, T, 4) * 1e-6, Pr: interp(WATER, T, 5), beta: interp(WATER, T, 6) * 1e-3, a: lambda / (rho * cp) };
}
export const fluidRange = (f: Fluid) => (f === 'air' ? [-20, 500] : [0, 100]);

export type Case = 'plate' | 'pipe' | 'cylinder' | 'freePlate' | 'freeCylinder';

export interface ConvSpec {
  kind: Case;
  fluid: Fluid;
  /** fluid temperature (bulk / free stream) and wall temperature [°C] */
  Tf: number;
  Tw: number;
  /** velocity [m/s] (forced cases) */
  u: number;
  /** characteristic length [m]: plate length, pipe or cylinder diameter, plate height */
  L: number;
  /** pipe length [m] (developing flow) */
  Lpipe: number;
  /** width (plate) or length (cylinder, pipe) for the transfer area [m] */
  b: number;
}

export interface ConvResult {
  Tm: number;
  p: Props;
  Re: number;
  Gr: number;
  Ra: number;
  Nu: number;
  alpha: number;
  A: number;
  Q: number;
  regime: string;
  correlation: string;
  /** local α(x) [W/m²K] and boundary-layer thickness δ(x) [mm] along a plate */
  local?: { x: number; alpha: number; delta: number }[];
}

const g = 9.81;

export function convection(s: ConvSpec): ConvResult {
  const forced = s.kind === 'plate' || s.kind === 'pipe' || s.kind === 'cylinder';
  // properties: film temperature for external flow, bulk for pipe flow
  const Tm = s.kind === 'pipe' ? s.Tf : (s.Tf + s.Tw) / 2;
  const p = props(s.fluid, Tm);
  const Re = forced ? (s.u * s.L) / p.nu : 0;
  const Gr = forced ? 0 : (g * p.beta * Math.abs(s.Tw - s.Tf) * s.L ** 3) / p.nu ** 2;
  const Ra = Gr * p.Pr;
  let Nu = 0;
  let regime = '';
  let correlation = '';
  let local: ConvResult['local'];
  let A = 0;
  switch (s.kind) {
    case 'plate': {
      const lam = 0.664 * Math.sqrt(Re) * Math.cbrt(p.Pr);
      const turb = (0.037 * Re ** 0.8 * p.Pr) / (1 + 2.443 * Re ** -0.1 * (p.Pr ** (2 / 3) - 1));
      Nu = Re < 5e5 ? lam : Math.sqrt(lam ** 2 + turb ** 2);
      regime = Re < 5e5 ? 'laminar' : 'laminar–turbulent';
      correlation = Re < 5e5 ? 'Nu = 0.664·Re^½·Pr^⅓' : 'Nu = √(Nu_lam² + Nu_turb²), Nu_turb = 0.037Re^0.8Pr / (1 + 2.443Re^-0.1(Pr^⅔ − 1))';
      A = s.L * s.b;
      local = Array.from({ length: 80 }, (_, i) => {
        const x = (s.L * (i + 1)) / 80;
        const Rex = (s.u * x) / p.nu;
        const Nux = Rex < 5e5 ? 0.332 * Math.sqrt(Rex) * Math.cbrt(p.Pr) : (0.0296 * Rex ** 0.8 * p.Pr) / (1 + 2.185 * Rex ** -0.1 * (p.Pr - 1));
        const delta = Rex < 5e5 ? (5 * x) / Math.sqrt(Rex) : 0.37 * x * Rex ** -0.2;
        return { x, alpha: (Nux * p.lambda) / x, delta: delta * 1000 };
      });
      break;
    }
    case 'pipe': {
      const dL = s.L / Math.max(s.Lpipe, s.L);
      const lamNu = Math.cbrt(3.66 ** 3 + 0.7 ** 3 + (1.615 * Math.cbrt(Re * p.Pr * dL) - 0.7) ** 3);
      const turbNu = (R: number) => {
        const xi = (1.8 * Math.log10(R) - 1.5) ** -2;
        return ((xi / 8) * R * p.Pr) / (1 + 12.7 * Math.sqrt(xi / 8) * (p.Pr ** (2 / 3) - 1)) * (1 + dL ** (2 / 3));
      };
      if (Re <= 2300) {
        Nu = lamNu;
        regime = 'laminar';
        correlation = 'Nu = [3.66³ + 0.7³ + (1.615·(Re·Pr·d/L)^⅓ − 0.7)³]^⅓';
      } else if (Re >= 1e4) {
        Nu = turbNu(Re);
        regime = 'turbulent';
        correlation = 'Gnielinski: Nu = (ξ/8)·Re·Pr / [1 + 12.7√(ξ/8)(Pr^⅔ − 1)]·[1 + (d/L)^⅔]';
      } else {
        const gamma = (Re - 2300) / (1e4 - 2300);
        const lam2300 = Math.cbrt(3.66 ** 3 + 0.7 ** 3 + (1.615 * Math.cbrt(2300 * p.Pr * dL) - 0.7) ** 3);
        Nu = (1 - gamma) * lam2300 + gamma * turbNu(1e4);
        regime = 'transition';
        correlation = 'VDI: Nu = (1 − γ)·Nu_lam,2300 + γ·Nu_turb,10⁴';
      }
      A = Math.PI * s.L * s.Lpipe;
      break;
    }
    case 'cylinder': {
      Nu = 0.3 + ((0.62 * Math.sqrt(Re) * Math.cbrt(p.Pr)) / (1 + (0.4 / p.Pr) ** (2 / 3)) ** 0.25) * (1 + (Re / 282000) ** (5 / 8)) ** (4 / 5);
      regime = Re < 2e5 ? 'subcritical' : 'supercritical';
      correlation = 'Churchill–Bernstein';
      A = Math.PI * s.L * s.b;
      break;
    }
    case 'freePlate': {
      Nu = (0.825 + (0.387 * Ra ** (1 / 6)) / (1 + (0.492 / p.Pr) ** (9 / 16)) ** (8 / 27)) ** 2;
      regime = Ra < 1e9 ? 'laminar' : 'turbulent';
      correlation = 'Churchill–Chu (vertical plate)';
      A = s.L * s.b;
      break;
    }
    case 'freeCylinder': {
      Nu = (0.6 + (0.387 * Ra ** (1 / 6)) / (1 + (0.559 / p.Pr) ** (9 / 16)) ** (8 / 27)) ** 2;
      regime = Ra < 1e9 ? 'laminar' : 'turbulent';
      correlation = 'Churchill–Chu (horizontal cylinder)';
      A = Math.PI * s.L * s.b;
      break;
    }
  }
  const alpha = (Nu * p.lambda) / s.L;
  return { Tm, p, Re, Gr, Ra, Nu, alpha, A, Q: alpha * A * (s.Tw - s.Tf), regime, correlation, local };
}
