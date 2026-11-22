/** Formula collection: the relations the simulators use, grouped by subject. */

export interface Formula {
  subject: 'Thermal separation' | 'Heat & mass transfer' | 'Electrical circuits' | 'Control engineering' | 'Mechanics' | 'Thermodynamics' | 'Fluid mechanics';
  topic: string;
  name: string;
  tex: string;
  /** meaning of the symbols */
  vars: string;
  /** route of the simulator that uses it */
  route?: string;
}

export const FORMULAS: Formula[] = [
  // ---------------------------------------------------------------- thermal separation
  { subject: 'Thermal separation', topic: 'Phase equilibrium', name: "Raoult's law (ideal mixture)", tex: 'y_i\\,p = x_i\\,p_i^{s}(T)', vars: 'x, y: liquid / vapour mole fraction, p: total pressure, pˢ: vapour pressure', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'Phase equilibrium', name: 'Antoine equation', tex: '\\log_{10} p^{s} = A - \\frac{B}{C + T}', vars: 'A, B, C: substance constants (units as tabulated)', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'Phase equilibrium', name: 'Relative volatility, equilibrium curve', tex: '\\alpha = \\frac{p_A^{s}}{p_B^{s}},\\qquad y = \\frac{\\alpha\\,x}{1 + (\\alpha - 1)\\,x}', vars: 'α: relative volatility of the light key A', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'Balances', name: 'Total and component balance of a column', tex: 'F = D + B,\\qquad F\\,x_F = D\\,x_D + B\\,x_B', vars: 'F, D, B: feed, distillate, bottoms [kmol/h]', route: 'flowsheet' },
  { subject: 'Thermal separation', topic: 'McCabe–Thiele', name: 'Rectifying operating line', tex: 'y = \\frac{R}{R + 1}\\,x + \\frac{x_D}{R + 1}', vars: 'R = L/D: reflux ratio', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'McCabe–Thiele', name: 'q-line (feed line)', tex: 'y = \\frac{q}{q - 1}\\,x - \\frac{x_F}{q - 1}', vars: 'q: liquid fraction of the feed (1 = boiling liquid, 0 = saturated vapour)', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'Shortcut', name: 'Fenske equation (minimum stages)', tex: 'N_{min} = \\frac{\\ln\\left[\\frac{x_D}{1 - x_D}\\cdot\\frac{1 - x_B}{x_B}\\right]}{\\ln \\alpha}', vars: 'total reflux, constant α', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'Shortcut', name: 'Minimum reflux (boiling-liquid feed, constant α)', tex: 'R_{min} = \\frac{x_D - y^{*}}{y^{*} - x^{*}}', vars: 'x*, y*: intersection of the q-line with the equilibrium curve (pinch)', route: 'mccabe-thiele' },
  { subject: 'Thermal separation', topic: 'Absorption', name: 'Kremser equation', tex: '\\frac{Y_{in} - Y_{out}}{Y_{in} - Y^{*}_{out}} = \\frac{A^{N+1} - A}{A^{N+1} - 1},\\quad A = \\frac{L}{m\\,G}', vars: 'A: absorption factor, m: slope of the equilibrium line, N: stages', route: 'absorption' },
  { subject: 'Thermal separation', topic: 'Batch distillation', name: 'Rayleigh equation', tex: '\\ln\\frac{W_0}{W} = \\int_{x_W}^{x_{W,0}} \\frac{\\mathrm{d}x}{y^{*} - x}', vars: 'W: still content, x_W: still composition', route: 'batch' },

  // ---------------------------------------------------------------- heat & mass transfer
  { subject: 'Heat & mass transfer', topic: 'Conduction', name: "Fourier's law", tex: '\\dot q = -\\lambda\\,\\frac{\\mathrm{d}T}{\\mathrm{d}x}', vars: 'q̇: heat flux [W/m²], λ: thermal conductivity [W/(m·K)]', route: 'conduction' },
  { subject: 'Heat & mass transfer', topic: 'Conduction', name: 'Thermal resistances: plane wall, convection', tex: 'R_{\\lambda} = \\frac{s}{\\lambda A},\\qquad R_{\\alpha} = \\frac{1}{\\alpha A},\\qquad \\dot Q = \\frac{\\Delta T}{\\sum R}', vars: 's: thickness, A: area, α: heat transfer coefficient', route: 'conduction' },
  { subject: 'Heat & mass transfer', topic: 'Conduction', name: 'Cylinder wall (pipe)', tex: 'R_{\\lambda} = \\frac{\\ln(r_a / r_i)}{2\\pi\\lambda L}', vars: 'r_i, r_a: inner / outer radius, L: pipe length', route: 'conduction' },
  { subject: 'Heat & mass transfer', topic: 'Conduction', name: 'Critical insulation radius (cylinder)', tex: 'r_{krit} = \\frac{\\lambda_{iso}}{\\alpha_a}', vars: 'below r_krit, insulation increases the heat loss', route: 'conduction' },
  { subject: 'Heat & mass transfer', topic: 'Fins', name: 'Fin with adiabatic tip', tex: 'm = \\sqrt{\\frac{\\alpha U}{\\lambda A_q}},\\qquad \\eta_R = \\frac{\\tanh(mL)}{mL}', vars: 'U: perimeter, A_q: cross-section, L: fin length', route: 'fin' },
  { subject: 'Heat & mass transfer', topic: 'Transient', name: 'Biot and Fourier numbers, lumped capacity', tex: 'Bi = \\frac{\\alpha L_c}{\\lambda},\\quad Fo = \\frac{a\\,t}{L_c^2},\\quad \\frac{T - T_\\infty}{T_0 - T_\\infty} = e^{-Bi\\,Fo}\\ (Bi < 0.1)', vars: 'a = λ/(ρc): thermal diffusivity, L_c = V/A', route: 'transient' },
  { subject: 'Heat & mass transfer', topic: 'Transient', name: 'Semi-infinite body, fixed surface temperature', tex: '\\frac{T(x,t) - T_s}{T_i - T_s} = \\operatorname{erf}\\left(\\frac{x}{2\\sqrt{a\\,t}}\\right)', vars: 'T_s: surface, T_i: initial temperature', route: 'transient' },
  { subject: 'Heat & mass transfer', topic: 'Convection', name: 'Dimensionless numbers', tex: 'Re = \\frac{w L}{\\nu},\\quad Pr = \\frac{\\nu}{a},\\quad Nu = \\frac{\\alpha L}{\\lambda}', vars: 'Reynolds, Prandtl, Nusselt number; w: velocity, ν: kinematic viscosity, L: characteristic length', route: 'convection' },
  { subject: 'Heat & mass transfer', topic: 'Convection', name: 'Flat plate, laminar (mean)', tex: 'Nu_m = 0.664\\,Re^{1/2}\\,Pr^{1/3}\\quad (Re < 5\\cdot 10^5)', vars: 'properties at the film temperature', route: 'convection' },
  { subject: 'Heat & mass transfer', topic: 'Convection', name: 'Pipe, turbulent (Dittus–Boelter)', tex: 'Nu = 0.023\\,Re^{0.8}\\,Pr^{n},\\quad n = 0.4\\ \\text{(heating)},\\ 0.3\\ \\text{(cooling)}', vars: 'Re > 10⁴, 0.7 < Pr < 160, L/d > 10', route: 'convection' },
  { subject: 'Heat & mass transfer', topic: 'Radiation', name: 'Stefan–Boltzmann, Wien', tex: '\\dot q = \\varepsilon\\,\\sigma\\,T^4,\\qquad \\lambda_{max}\\,T = 2897.8\\ \\mu\\mathrm{m\\,K}', vars: 'σ = 5.670·10⁻⁸ W/(m²K⁴), ε: emissivity', route: 'radiation' },
  { subject: 'Heat & mass transfer', topic: 'Radiation', name: 'Two parallel gray plates', tex: '\\dot q_{12} = \\frac{\\sigma\\,(T_1^4 - T_2^4)}{\\frac{1}{\\varepsilon_1} + \\frac{1}{\\varepsilon_2} - 1}', vars: 'large plates, no losses at the edges', route: 'radiation' },
  { subject: 'Heat & mass transfer', topic: 'Heat exchangers', name: 'Logarithmic mean temperature difference', tex: '\\dot Q = k A\\,\\Delta T_{m},\\qquad \\Delta T_{m} = \\frac{\\Delta T_1 - \\Delta T_2}{\\ln(\\Delta T_1 / \\Delta T_2)}', vars: 'ΔT₁, ΔT₂: temperature differences at both ends', route: 'exchanger' },
  { subject: 'Heat & mass transfer', topic: 'Heat exchangers', name: 'ε–NTU, counter flow', tex: 'NTU = \\frac{kA}{\\dot C_{min}},\\quad C_r = \\frac{\\dot C_{min}}{\\dot C_{max}},\\quad \\varepsilon = \\frac{1 - e^{-NTU(1 - C_r)}}{1 - C_r\\,e^{-NTU(1 - C_r)}}', vars: 'Ċ = ṁ·c_p: heat capacity rates', route: 'exchanger' },
  { subject: 'Heat & mass transfer', topic: 'Mass transfer', name: "Fick's first law", tex: '\\dot n_A = -D_{AB}\\,\\frac{\\mathrm{d}c_A}{\\mathrm{d}x}', vars: 'D_AB: diffusion coefficient [m²/s]', route: 'diffusion' },
  { subject: 'Heat & mass transfer', topic: 'Mass transfer', name: 'Stefan diffusion (through a stagnant gas)', tex: '\\dot n_A = \\frac{D_{AB}\\,p}{R\\,T\\,L}\\,\\ln\\frac{1 - y_{A,L}}{1 - y_{A,0}}', vars: 'y_A: mole fraction at both ends, L: diffusion length', route: 'diffusion' },

  // ---------------------------------------------------------------- circuits
  { subject: 'Electrical circuits', topic: 'Basics', name: "Ohm's law, power", tex: 'U = R\\,I,\\qquad P = U\\,I = I^2 R = \\frac{U^2}{R}', vars: '', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'Basics', name: "Kirchhoff's laws", tex: '\\sum_{\\text{node}} I_k = 0,\\qquad \\sum_{\\text{loop}} U_k = 0', vars: 'current law (KCL), voltage law (KVL)', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'Networks', name: 'Series and parallel connection', tex: 'R_{ges} = \\sum R_i,\\qquad \\frac{1}{R_{ges}} = \\sum \\frac{1}{R_i},\\qquad R_1 \\parallel R_2 = \\frac{R_1 R_2}{R_1 + R_2}', vars: '', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'Networks', name: 'Voltage and current divider', tex: 'U_2 = U\\,\\frac{R_2}{R_1 + R_2},\\qquad I_2 = I\\,\\frac{R_1}{R_1 + R_2}', vars: 'unloaded divider / two parallel branches', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'Networks', name: 'Star–delta transformation', tex: 'R_{12} = \\frac{R_1 R_2 + R_2 R_3 + R_3 R_1}{R_3}', vars: 'delta element between nodes 1 and 2; R₃ is the opposite star element', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'AC', name: 'Impedances', tex: 'Z_R = R,\\qquad Z_L = j\\omega L,\\qquad Z_C = \\frac{1}{j\\omega C},\\qquad \\omega = 2\\pi f', vars: '', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'AC', name: 'RC low-pass', tex: 'H(j\\omega) = \\frac{1}{1 + j\\omega RC},\\qquad f_g = \\frac{1}{2\\pi R C}', vars: 'f_g: −3 dB cut-off frequency', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'Transients', name: 'RC charging', tex: 'u_C(t) = U_0\\left(1 - e^{-t/\\tau}\\right),\\qquad \\tau = R C', vars: 'τ: time constant', route: 'circuits' },
  { subject: 'Electrical circuits', topic: 'Op-amp', name: 'Inverting and non-inverting amplifier', tex: 'V_{inv} = -\\frac{R_f}{R_1},\\qquad V_{nicht\\,inv} = 1 + \\frac{R_f}{R_1}', vars: 'ideal op-amp', route: 'circuits' },

  // ---------------------------------------------------------------- control
  { subject: 'Control engineering', topic: 'Block diagrams', name: 'Series, parallel, feedback', tex: 'G_1 G_2,\\qquad G_1 + G_2,\\qquad \\frac{G}{1 + G H}', vars: 'negative feedback: + in the denominator', route: 'control' },
  { subject: 'Control engineering', topic: 'Block diagrams', name: 'Reference and disturbance transfer functions', tex: 'T(s) = \\frac{L(s)}{1 + L(s)},\\qquad S(s) = \\frac{1}{1 + L(s)}', vars: 'L = R·G: open loop, S: sensitivity', route: 'control' },
  { subject: 'Control engineering', topic: 'Controllers', name: 'PID controller', tex: 'R(s) = K_P\\left(1 + \\frac{1}{T_i s} + T_d s\\right)', vars: 'T_i: reset time, T_d: derivative time', route: 'control' },
  { subject: 'Control engineering', topic: 'Plants', name: 'PT1 and PT2', tex: 'G_{PT1} = \\frac{K}{1 + T s},\\qquad G_{PT2} = \\frac{K}{1 + 2 D T s + T^2 s^2}', vars: 'D: damping ratio', route: 'control' },
  { subject: 'Control engineering', topic: 'Time response', name: 'Final value theorem, steady-state error', tex: 'y_\\infty = \\lim_{s \\to 0} s\\,Y(s),\\qquad e_\\infty = \\frac{1}{1 + L(0)}\\ \\text{(step, no integrator)}', vars: 'with an integrator in L: e_∞ = 0', route: 'control' },
  { subject: 'Control engineering', topic: 'Time response', name: 'Second-order overshoot', tex: '\\ddot u = \\exp\\left(-\\frac{\\pi D}{\\sqrt{1 - D^2}}\\right),\\qquad t_{5\\%} \\approx \\frac{3}{D\\,\\omega_0}', vars: '0 < D < 1', route: 'control' },
  { subject: 'Control engineering', topic: 'Stability', name: 'Phase and gain margin', tex: '\\varphi_R = 180^\\circ + \\arg L(j\\omega_c),\\qquad A_R = \\frac{1}{|L(j\\omega_{180})|}', vars: 'ω_c: |L| = 1, ω₁₈₀: arg L = −180°', route: 'control' },
  { subject: 'Control engineering', topic: 'Frequency response', name: 'Bode asymptotes', tex: '|G|_{dB} = 20\\log_{10}|G|,\\quad \\text{PT1: } -20\\ \\mathrm{dB/Dekade}\\ \\text{above } \\omega_E = \\frac{1}{T}', vars: 'phase of PT1: −45° at ω_E', route: 'bode' },
  { subject: 'Control engineering', topic: 'Filters', name: 'Butterworth low-pass', tex: '|H(j\\omega)|^2 = \\frac{1}{1 + (\\omega/\\omega_c)^{2n}}', vars: 'n: order, −20·n dB per decade', route: 'filters' },
  { subject: 'Control engineering', topic: 'Signals', name: 'Fourier series, sampling theorem', tex: 'x(t) = \\frac{a_0}{2} + \\sum_k \\left(a_k \\cos k\\omega t + b_k \\sin k\\omega t\\right),\\qquad f_s > 2 f_{max}', vars: 'otherwise aliasing', route: 'fourier' },

  // ---------------------------------------------------------------- mechanics
  { subject: 'Mechanics', topic: 'Statics', name: 'Equilibrium in the plane', tex: '\\sum F_x = 0,\\qquad \\sum F_z = 0,\\qquad \\sum M^{(A)} = 0', vars: 'three equations for three unknowns (statically determinate)', route: 'beam' },
  { subject: 'Mechanics', topic: 'Beams', name: 'Relations between load, shear force and moment', tex: '\\frac{\\mathrm{d}Q}{\\mathrm{d}x} = -q(x),\\qquad \\frac{\\mathrm{d}M}{\\mathrm{d}x} = Q(x)', vars: 'M is extreme where Q = 0', route: 'beam' },
  { subject: 'Mechanics', topic: 'Beams', name: 'Bending stress, section modulus', tex: '\\sigma = \\frac{M}{I}\\,z,\\qquad \\sigma_{max} = \\frac{M}{W},\\qquad W_{rect} = \\frac{b h^2}{6}', vars: 'I: second moment of area', route: 'beam' },
  { subject: 'Mechanics', topic: 'Beams', name: 'Deflection: simply supported, central load', tex: 'w_{max} = \\frac{F L^3}{48\\,E I},\\qquad M_{max} = \\frac{F L}{4}', vars: '', route: 'beam' },
  { subject: 'Mechanics', topic: 'Beams', name: 'Deflection: cantilever, end load', tex: 'w_{max} = \\frac{F L^3}{3\\,E I},\\qquad M_A = F L', vars: '', route: 'beam' },
  { subject: 'Mechanics', topic: 'Trusses', name: 'Static determinacy of a truss', tex: 'n = s + r - 2k', vars: 's: bars, r: support reactions, k: joints; n = 0: determinate', route: 'truss' },
  { subject: 'Mechanics', topic: 'Torsion', name: 'Circular shaft', tex: '\\tau_{max} = \\frac{M_t}{W_t},\\quad W_t = \\frac{\\pi d^3}{16},\\quad \\vartheta = \\frac{M_t\\,L}{G\\,I_p},\\quad I_p = \\frac{\\pi d^4}{32}', vars: 'ϑ: angle of twist, G: shear modulus', route: 'torsion' },

  // ---------------------------------------------------------------- thermodynamics
  { subject: 'Thermodynamics', topic: 'Cycles', name: 'Carnot efficiency', tex: '\\eta_C = 1 - \\frac{T_L}{T_H}', vars: 'upper limit for every cycle between T_L and T_H (temperatures in K)', route: 'cycles' },
  { subject: 'Thermodynamics', topic: 'Cycles', name: 'Clausius–Rankine efficiency, wet steam', tex: '\\eta = \\frac{(h_3 - h_4) - (h_2 - h_1)}{h_3 - h_2},\\qquad h = h\' + x\\,(h\'\' - h\')', vars: 'x: vapour quality, h′/h″: saturated liquid / vapour', route: 'cycles' },
  { subject: 'Thermodynamics', topic: 'Cycles', name: 'Joule, Otto and Diesel (ideal, air-standard)', tex: '\\eta_J = 1 - \\Pi^{-\\frac{\\kappa - 1}{\\kappa}},\\quad \\eta_O = 1 - \\varepsilon^{1 - \\kappa},\\quad \\eta_D = 1 - \\frac{\\varphi^\\kappa - 1}{\\kappa\\,\\varepsilon^{\\kappa - 1}(\\varphi - 1)}', vars: 'Π: pressure ratio, ε: compression ratio, φ: cut-off ratio', route: 'cycles' },
  { subject: 'Thermodynamics', topic: 'Exergy', name: 'Exergy of heat, exergy loss (Gouy–Stodola)', tex: 'e_q = q\\left(1 - \\frac{T_0}{T}\\right),\\qquad e_V = T_0\\,s_{irr}', vars: 'T₀: ambient temperature, s_irr: entropy generated', route: 'cycles' },
  { subject: 'Thermodynamics', topic: 'Ideal gas', name: 'Ideal gas: state, entropy, isentrope', tex: 'p v = R T,\\quad s_2 - s_1 = c_p \\ln\\frac{T_2}{T_1} - R\\ln\\frac{p_2}{p_1},\\quad p v^\\kappa = \\text{const}', vars: 'R = R_m/M specific gas constant', route: 'cycles' },
  { subject: 'Thermodynamics', topic: 'Real gases', name: 'van der Waals equation', tex: '\\left(p + \\frac{a}{v^2}\\right)(v - b) = R T,\\quad a = \\frac{27 R^2 T_c^2}{64 p_c},\\quad b = \\frac{R T_c}{8 p_c}', vars: 'v: molar volume; Z_c = 3/8', route: 'realgas' },
  { subject: 'Thermodynamics', topic: 'Real gases', name: 'Maxwell relation and equal-area rule', tex: '\\left(\\frac{\\partial s}{\\partial v}\\right)_T = \\left(\\frac{\\partial p}{\\partial T}\\right)_v,\\qquad \\int_{v\'}^{v\'\'} p\\,\\mathrm{d}v = p_s\\,(v\'\' - v\')', vars: 'p_s: vapour pressure of the equation of state', route: 'realgas' },
  { subject: 'Thermodynamics', topic: 'Mixtures', name: 'Phase equilibrium of two liquid phases', tex: 'x_i^{\\alpha}\\gamma_i^{\\alpha} = x_i^{\\beta}\\gamma_i^{\\beta},\\qquad \\frac{n^{\\beta}}{n} = \\frac{z - x^{\\alpha}}{x^{\\beta} - x^{\\alpha}}', vars: 'equal activities; lever rule for the amounts', route: 'mixtures' },
  { subject: 'Thermodynamics', topic: 'Humid air', name: 'Water content and enthalpy of humid air', tex: 'x = 0.622\\,\\frac{\\varphi\\,p_s}{p - \\varphi\\,p_s},\\qquad h_{1+x} = 1.006\\,t + x\\,(2501 + 1.86\\,t)', vars: 'h in kJ/kg dry air, t in °C', route: 'humidair' },

  // ---------------------------------------------------------------- fluid mechanics
  { subject: 'Fluid mechanics', topic: 'Pipe flow', name: 'Reynolds number', tex: 'Re = \\frac{w\\,d}{\\nu} = \\frac{\\rho\\,w\\,d}{\\eta},\\qquad Re_{krit} \\approx 2300', vars: 'laminar below 2300, turbulent above ≈ 4000', route: 'pipe' },
  { subject: 'Fluid mechanics', topic: 'Pipe flow', name: 'Pressure loss in a pipe (Darcy–Weisbach)', tex: '\\Delta p_V = \\left(\\lambda\\,\\frac{L}{d} + \\sum \\zeta\\right)\\frac{\\rho}{2}\\,w^2', vars: 'λ: friction factor, ζ: loss coefficients of fittings', route: 'pipe' },
  { subject: 'Fluid mechanics', topic: 'Pipe flow', name: 'Friction factor: laminar and Colebrook–White', tex: '\\lambda_{lam} = \\frac{64}{Re},\\qquad \\frac{1}{\\sqrt{\\lambda}} = -2\\log_{10}\\left(\\frac{2.51}{Re\\sqrt{\\lambda}} + \\frac{k/d}{3.71}\\right)', vars: 'k: wall roughness', route: 'pipe' },
  { subject: 'Fluid mechanics', topic: 'Pipe flow', name: 'Laminar velocity profile (Hagen–Poiseuille)', tex: 'u(r) = 2\\bar w\\left(1 - \\frac{r^2}{R^2}\\right),\\qquad \\dot V = \\frac{\\pi R^4}{8 \\eta}\\,\\frac{\\Delta p}{L}', vars: '', route: 'pipe' },
  { subject: 'Fluid mechanics', topic: 'Bernoulli', name: 'Extended Bernoulli equation', tex: 'p_1 + \\frac{\\rho}{2}w_1^2 + \\rho g z_1 = p_2 + \\frac{\\rho}{2}w_2^2 + \\rho g z_2 + \\Delta p_V', vars: 'continuity: w₁A₁ = w₂A₂', route: 'pipe' },
  { subject: 'Fluid mechanics', topic: 'Bernoulli', name: 'Sudden expansion (Borda–Carnot), cavitation', tex: '\\zeta = \\left(1 - \\frac{A_1}{A_2}\\right)^2\\ (\\text{on } w_1),\\qquad \\text{cavitation if } p < p_v(T)', vars: 'p_v: vapour pressure of the liquid', route: 'pipe' },
];
