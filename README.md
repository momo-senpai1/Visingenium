# Visingenium

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="animation/logo-dark.gif">
  <img src="animation/logo-light.gif" alt="Visingenium" width="600">
</picture>

Browser-based simulators for the core engineering lectures. The start page
(`#/`) leads to eight areas:

| Area | Routes | What it does |
|---|---|---|
| **Thermal Separation** | `#/flowsheet`, `#/mccabe-thiele`, … | Flowsheet simulator and balance tasks, distillation, extraction, absorption, evaporation, crystallization, drying (described below) |
| **Heat & Mass Transfer** | `#/conduction`, `#/fin`, `#/transient`, `#/convection`, `#/radiation`, `#/exchanger`, `#/diffusion` | Conduction, fins, transient conduction, convection, radiation, heat exchangers, diffusion |
| **Electrical Circuits** | `#/circuits` | Circuit simulator: DC, transient, AC/Bode, step-by-step network simplification |
| **Control Engineering** | `#/control-sim`, `#/control`, `#/bode`, `#/filters`, `#/fourier` | Control loops with block diagram reduction, Bode/Nyquist, stability, filter design, Fourier/FFT |
| **Mechanics** | `#/beam`, `#/truss`, `#/torsion` | Beams, trusses, shafts in torsion (Engineering Mechanics 1 and 2) |
| **Thermodynamics** | `#/cycles`, `#/steam`, `#/realgas`, `#/mixtures`, `#/humidair` | Cycles in T,s and p,v diagrams with draggable state points (Carnot, Clausius–Rankine, Joule, Otto, Diesel) and exergy analysis, steam table, real gases with Maxwell construction, miscibility gaps and gas mixtures, Mollier h,x diagram |
| **Fluid Mechanics** | `#/pipe` | Pipe flow and Bernoulli lab: Reynolds number, laminar/turbulent profile, Colebrook, losses, energy line, cavitation, Moody diagram |
| **Tools** | `#/formulas`, `#/units` | Searchable formula collection (linked to the simulators), unit converter |

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · `@xyflow/react` · Zustand
· Recharts 3 · KaTeX · zod. Fonts (Inter, JetBrains Mono) are bundled; the site makes no
requests to third parties and keeps all data in the browser.

### Heat & Mass Transfer (`engine/heat/`)

Topics follow typical heat and mass transfer lectures (TU Darmstadt WuSt,
TUM Heat and Mass Transfer, Uni Siegen):

- **Conduction (`conduction.ts`):** plane wall, pipe or sphere with any number
  of layers and convection on both sides (thermal-resistance method).
  - Results: Q̇, U-value or k per length, interface temperatures.
  - T(x) profile: linear, logarithmic or 1/r.
  - Heat loss over the insulation thickness, critical insulation radius.
- **Fin / rod:** pin or plate fin with an adiabatic, convective or infinitely
  long tip.
  - T(x) along the fin, Q̇, fin efficiency η, effectiveness ε, Biot check.
  - Comparison of steel, aluminium and copper.
- **Transient conduction (`transient.ts`):**
  - plate, cylinder and sphere by the series solution: eigenvalues from the
    characteristic equation, Bessel functions for the cylinder;
  - lumped capacitance;
  - semi-infinite body with a temperature step or convection at the surface;
  - T(x) at several times and T(t) at the centre and the surface.
- **Convection (`convection.ts`):** air and water property tables, then Re,
  Pr, Gr/Ra, Nu, α and Q̇ for five cases:
  - flat plate (laminar and turbulent combined), with local α(x) and boundary
    layer δ(x);
  - pipe flow (laminar developing flow, transition, Gnielinski);
  - cylinder in cross flow (Churchill–Bernstein);
  - free convection on a vertical plate and a horizontal cylinder
    (Churchill–Chu).
- **Radiation (`radiation.ts`):**
  - Planck spectra, Wien, band fraction;
  - gray two-surface exchange (plates, concentric cylinders and spheres, small
    body in a large room);
  - radiation shields, radiative heat transfer coefficient;
  - analytical view factors.
- **Heat exchanger (`exchanger.ts`):** co-current, counter-current and cross
  flow by ε–NTU, with an LMTD check, temperature profiles along the area and
  ε(NTU) curves.
- **Mass transfer (`diffusion.ts`):**
  - Fick's law through a layer;
  - Stefan tube (one-sided diffusion vs equimolar counter-diffusion, with
    profiles);
  - Fuller diffusion coefficients;
  - transient diffusion into a semi-infinite medium (penetration theory).

### Electrical Circuits (`engine/circuits/`)

Drag components onto the sheet, wire their terminals, name them, rotate them
and set their values with SI prefixes (`4k7`, `10m`, `2,2µ`). Switches, push
buttons and logic inputs are operated directly on the sheet.

**Library (57 parts, `devices.ts`, symbols in `components/circuits/shapes.tsx`):**

- **Sources:** DC voltage, battery with internal resistance, AC/signal source
  (sine, square, triangle), current source, ground.
- **Passive:** resistor, potentiometer, capacitor, inductor, transformer,
  lamp, fuse, photoresistor, NTC thermistor, loudspeaker.
- **Switches & relays:** switch, SPDT, DPDT, push buttons (NO/NC), relay with
  pull-in and drop-out.
- **Diodes:** diode, Zener, LED (colour, brightness), photodiode, bridge
  rectifier.
- **Transistors:**
  - NPN/PNP (Ebers–Moll);
  - N/P-MOSFET (square law with λ);
  - N/P-JFET (Shichman–Hodges).
- **Controlled sources:** VCVS, VCCS, CCVS, CCCS.
- **ICs:** op-amp (high gain, saturation), voltage regulator, 555 timer.
- **Digital:** logic input, clock, logic output, buffer, NOT, AND, NAND, OR,
  NOR, XOR, XNOR (AND/NAND/OR/NOR with 2 or 3 inputs), D, JK and T
  flip-flops, SR latch.
- **Meters:** ammeter, voltmeter, scope probe.

**Analysis (`solver.ts`):**

- **Core method:** modified nodal analysis over all devices, with
  Newton–Raphson and junction limiting for the nonlinear ones.
- **DC operating point:** an outer loop settles behavioural parts (gates,
  flip-flops, relays, fuses). Their states persist between solves, so
  toggling a logic input clocks a flip-flop. A ring oscillator is reported.
- **Transient analysis:** backward-Euler companion models for capacitors,
  inductors and the coupled transformer. Behavioural parts react with one
  step of delay.
- **Oscilloscope:** analog traces (probes, meters, selectable component
  currents) and logic-analyser strips.
- **Result tables:**
  - voltage, current, U/I, power and details per component (e.g. BJT
    region, I_C, I_B);
  - node potentials;
  - the nodal equation matrix;
  - a power balance with a Kirchhoff check.
- **Examples:** voltage divider, LED, Wheatstone bridge, lamps, diode OR,
  transistor switch, inverting op-amp, RC charging, mains adapter with
  transformer and bridge, 555 blinker, half adder, 2-bit counter.

### Control Engineering (`engine/control/`)

- **Polynomials and transfer functions (`poly.ts`):** coefficient arrays in
  ascending powers, series/parallel/feedback, roots (Durand–Kerner), Bode with
  unwrapped phase, gain and phase margins, Padé approximation of a dead time,
  step and impulse responses (RK4 on the controllable canonical form), rise
  time, overshoot and settling time, Routh table.
- **Block-diagram simulator (`blocksim.ts`, page `#/control-sim`):** drag
  sources (step, ramp, sine, square, pulse, noise), summing points, gains,
  controllers, plants, dead time, saturation and scopes onto a sheet and wire
  outputs to inputs. Linear blocks are discretised exactly (zero-order hold,
  matrix exponential); algebraic loops are solved directly. The transfer
  function from any source to any signal is found by solving the signal
  equations symbolically, with poles, step response and Bode plot.
- **Control loop (`loop.ts`, page `#/control`):** blocks P, I, PI, PD, PID
  (filtered D), lead/lag, PT1, PT2, PTn, IT1, PT1 with dead time, D, or a custom
  numerator/denominator. Each block can have a parallel branch and a local
  feedback. The block diagram is reduced step by step (parallel → local
  feedback → series → open loop → closed loop) and every step is shown as a
  formula. The page also shows step response, Bode of L with margins, Nyquist,
  pole-zero map, Routh table and steady-state error.
- **Bode diagram (`#/bode`):** G(s) built from factors (gain, integrator,
  differentiator, first/second order poles and zeros, dead time); exact curve
  and straight-line approximation.
- **Filters (`filters.ts`, `#/filters`):** Butterworth, Chebyshev I and Bessel
  prototypes; low-pass, high-pass, band-pass and band-stop transformations;
  second-order sections with Q and ω₀; unity-gain Sallen–Key component values.
- **Fourier (`fourier.ts`, `#/fourier`):** analytic Fourier series (Gibbs
  phenomenon), radix-2 FFT with windows, aliasing at low sampling rates.

In the circuit editor, rotating a part detaches its wires (reconnect them, or
undo the rotation).

In the circuit simulator, **AC / Bode** linearises every part at the DC
operating point and sweeps the frequency (|H| and phase at each probe or
voltmeter). The **Simplify** tab combines two-terminal parts step by step
(series, parallel, star → delta, sources set to zero) for the impedance seen by
a source, between two nodes, or as a Thévenin/Norton equivalent, and checks the
result by nodal analysis.

### Thermodynamics (`engine/thermo/`) and fluid mechanics (`engine/fluid/`)

- **Water and steam (`steam.ts`):** IAPWS 1992 saturation equations (Wagner–Pruß, auxiliary
  equations for ρ′, ρ″, h′, h″, s′, s″) and IAPWS-IF97 region 2 (complete ideal-gas part and the
  leading residual terms) for superheated steam. Checked against steam tables: deviation below
  0.1 % (a few % only right next to the saturation line above 120 bar, so the boiler pressure of
  the Rankine cycle is limited to 120 bar).
- **Cycles (`cycles.ts`):** Carnot, Joule/Brayton (with compressor and turbine efficiencies),
  Otto, Diesel (air-standard, ideal gas) and Clausius–Rankine (pump, turbine efficiency). Energy
  balance and an exergy balance per component (Gouy–Stodola, T₀·s_irr); tests check that supplied
  exergy = net work + losses. The page draws T,s and p,v diagrams with draggable state points.
- **Real gases (`realgas.ts`):** van der Waals, Redlich–Kwong, Peng–Robinson; roots of the cubic,
  stable root by fugacity, vapour pressure from equal fugacities (= Maxwell's equal-area rule,
  verified numerically), departure functions, numerical check of a Maxwell relation.
- **Mixtures (`mixtures.ts`):** ideal gas mixtures (Dalton, mixing entropy) and liquid–liquid
  miscibility gaps with the two-parameter Margules model: binodal (equal activities), spinodal,
  upper critical solution temperature, lever rule.
- **Humid air (`humidair.ts`):** Mollier h,x diagram in skewed coordinates; heating/cooling with
  condensation, mixing, adiabatic humidification, dew point and wet-bulb temperature.
- **Pipe flow (`fluid/pipe.ts`):** segments with diameter, length, height and fittings; Reynolds
  number, laminar (64/Re) / transitional / turbulent (Colebrook–White) friction, Borda–Carnot and
  contraction losses, static and total pressure along the pipe (extended Bernoulli), cavitation
  where p < p_v; laminar parabola vs. turbulent power-law profile.

### Mechanics (`engine/mechanics/`)

Topics follow the usual Engineering Mechanics 1 and 2 syllabus (statics, then
strength of materials):

- **Beam (`beam.ts`):**
  - pinned, roller and fixed supports, hinges (Gerber beams);
  - point forces at any angle, point moments, uniform, trapezoidal and
    triangular line loads;
  - all supports and loads can be dragged along the beam.
  - Reactions and the deflection come from Euler–Bernoulli finite elements
    between the load points, with the curve inside each element added
    analytically, so statically indeterminate beams are exact too.
  - N/Q/M diagrams, bending stress for rectangle, circle, tube or I-section,
    deflection curve.
  - Degree of indeterminacy n = r − 3 − g, and the equilibrium equations with
    numbers as the solution path.
- **Truss (`truss.ts`):**
  - draw nodes and bars on the canvas, set supports and loads;
  - bar forces (tension/compression, zero-force members) and reactions by the
    direct stiffness method;
  - determinacy check 2k = s + r, mechanism detection, deformed shape;
  - method of joints shown per node.
- **Shaft (`torsion.ts`):**
  - stepped solid or hollow segments, torques at the stations;
  - clamped–free, or clamped–clamped solved with the compatibility condition;
  - torque, shear stress τ = M_t/W_t and angle of twist φ = M_t·L/(G·I_p) per
    segment, with the solution path;
  - power-to-torque helper.

---

## Run locally

Requires **Node.js 20.19+ or 22+** (`node -v`).

```bash
git clone https://github.com/momo-senpai1/Practical-Engineering.git
cd Practical-Engineering
npm ci            # install exact locked dependencies
npm run dev       # dev server with hot reload → http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit + integration tests (vitest) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | ESLint (TypeScript, React hooks) |
| `npm run build` | Type-check + production bundle in `dist/` |
| `npm run preview` | Serve the production build → http://localhost:4173 |

## Deploy on GitHub Pages

`.github/workflows/deploy-pages.yml` builds, tests and publishes on every push to
`main` (or manually from the Actions tab). One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Merge to `main` (or run the workflow manually: **Actions → Deploy to GitHub Pages → Run workflow**).
3. The site appears at `https://momo-senpai1.github.io/Practical-Engineering/`.

GitHub Pages on a **private** repository needs a paid plan (Pro/Team/Enterprise);
otherwise make the repository public, or deploy `dist/` to any static host
(Vercel, Netlify, Cloudflare Pages: build command `npm run build`, output `dist`).
The base path comes from `VITE_BASE` (set automatically by the workflow).

`.github/workflows/ci.yml` runs type-check, lint, tests and build on every push and PR.
Dependabot (`.github/dependabot.yml`) opens weekly pull requests for dependency updates.

**Recommended:** protect `main` (Settings → Branches → Add rule → *Require status checks to
pass before merging* → select the `verify` job), so only green builds are merged.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | React Flow canvas, custom P&ID nodes (Feed, Mixer, Heater, Column), Zustand store | ✅ |
| 2 | `thermodynamics.ts` — Raoult/Dalton VLE, Antoine, enthalpy balances | ✅ |
| 3 | Engine ↔ UI: unit solve in topological order, live stream propagation | ✅ |
| 4 | McCabe–Thiele side panel (Recharts) on column selection | ✅ |

## Modules

The header switches between modules (hash routes, so links work on static hosting):

| Route | Module |
|---|---|
| `#/flowsheet` | P&ID flowsheet: feeds, mixer, heater, distillation column, **batch still** |
| `#/mccabe-thiele` | McCabe–Thiele design workbench |
| `#/batch` | Batch distillation workbench |
| `#/distillation-lines` | Ternary distillation lines, border lines and product regions |
| `#/extraction?tool=cross\|counter\|hn` | Cross-current, counter-current and Hunter–Nash extraction |
| `#/absorption` | Gas absorption and stripping (Henry's law, Kremser, NTU/HTU) |
| `#/evaporation` | Single/multiple-effect evaporation, steam economy, MVR |
| `#/crystallization` | Solubility, cooling/evaporative yield, MSMPR crystal size distribution |
| `#/drying` | Psychrometrics, drying curves and time, continuous dryer air/heat |

Planned: reactive extraction, adsorption.

### Feed materials (flowsheet)

The flowsheet's **Feed materials** picker selects the two components (water,
methanol, ethanol, acetone, benzene, toluene, p-xylene, n-hexane, n-heptane,
cyclohexane). `engine/propertyPackage.ts` decides the model per pair:
Raoult for similar hydrocarbons and methanol/ethanol; **Wilson** for
ethanol/water and methanol/water (fitted to Perry's VLE — within 0.02 in y,
ethanol azeotrope at 78.2 °C) and for acetone/methanol and benzene/cyclohexane
(fitted to their azeotropes). Pairs that form two liquid phases (water +
hydrocarbons) or lack validated parameters are refused with the reason. With
an activity model the column and batch still step on the real equilibrium
curve (tangent-pinch R_min, total-reflux N_min, azeotrope limit). A **flash
drum** unit (heat duty + drum pressure) is available in the palette.

### Flowsheet equipment

The equipment cards (schematic, use, limits, design parameters) appear at the
bottom of each topic page. Auxiliary equipment such as flash drums, demisters,
ejectors and exchangers appears under McCabe–Thiele.


Drag any unit from the palette onto the canvas and wire it up:

- **Streams:** feed, mixer, splitter (fraction to outlet 1).
- **Heat & pressure:** heater, cooler/condenser (duty Q < 0), pump
  (W = V̇·Δp/η from liquid densities), valve (isenthalpic let-down, flashes if
  the outlet crosses the bubble point).
- **Separation:** column (trays with an overall efficiency or packing with an
  HETP — the node shows real trays or packed height), flash drum, evaporator
  (set the vaporized fraction, the duty is computed), batch still.
- **Process blocks:** absorber/stripper, extraction column, multiple-effect
  evaporator, crystallizer and dryer. Each one is a standalone block with its own
  feed specification, solved by the same engine as its workbench page. The
  inspector edits the block and links to the full module.

### Balance tasks (flowsheet → "Balance task")

Switch the flowsheet from **Simulation** to **Balance task** to work an
exercise the way it is solved on paper:

1. Draw the process with the same equipment as the simulator, joined by streams:
   - feed, product, mixer, splitter (same composition in every outlet);
   - heater and cooler: energy balance on q with Q̇ and Δh_v;
   - pump and valve: flow and composition unchanged;
   - column, flash drum, evaporator, absorber, extraction column, crystallizer
     and dryer: two outlets (top / bottom, e.g. distillate / bottoms,
     vapour / liquid, extract / raffinate), balances around the unit;
   - a generic black box.

   The batch still is left out, because a batch process has no steady-state
   balance.
2. Enter what the exercise gives for each stream: ṅ, mole fractions, q. Leave
   unknowns empty.
3. The **solution path** solves the problem step by step, typeset with KaTeX.
   Each step shows the balance, the substituted numbers and the result. The
   solver (`engine/balance/solver.ts`) uses total and component balances around
   every unit and around groups of units, so a recycle is solved with an
   envelope the way it is done by hand. It also uses Σx = 1, equal compositions
   across splitters and heat exchangers, and the exchanger energy balance
   ṅ·(q_out − q_in)·Δh_v = Q̇. It reports what is still undetermined and
   checks every balance at the end.
4. For stage numbers, enable **McCabe–Thiele** on a column and set the reflux
   ratio, the condenser type and the equilibrium curve: constant α, your own
   x–y table, or a preset (`engine/balance/columnMT.ts`). The construction
   handles several feeds with their own q, a total or partial condenser, and
   runs below the diagonal when the key component leaves at the bottom.

The bundled example is the RWTH AVT exercise on THF/H₂O/butanediol
pressure-swing distillation. Its x–y curves were extracted from the vector
graphics of the exercise sheet. The drawing and the specifications are stored
in the browser.

### Theme and languages

- **Light and dark mode:** use the sun/moon button in the header. The first
  visit follows the operating system; the choice is then stored in the browser.
  All colours, including chart colours, are CSS variables (`src/index.css`).
- **English, German and Kurdish (Kurmanji, Latin script):** use the EN / DE / KU
  switch in the header. Strings are keyed by their English text (`src/i18n/`).
  Missing entries fall back to English, and chemical names inside longer labels
  are translated term by term. Navigation, panels, controls, palette, inspector
  and equipment names are translated. Longer explanatory paragraphs are still in
  English. The Kurdish wording needs review by a native speaker; corrections go
  in `src/i18n/ku.ts`.

### Unit operations

- **Absorption / stripping** (`engine/absorption.ts`): Henry constants for NH₃,
  acetone, SO₂, H₂S, CO₂ (absorption) and benzene, toluene, O₂ (stripping) with
  temperature dependence; loading-ratio equilibrium, minimum L/G or G/L, stage
  stepping vs Kremser, packed height from NTU × HTU.
- **Evaporation** (`engine/evaporation.ts`): forward-feed multiple effects
  designed for equal areas, boiling-point elevation, steam economy vs number of
  effects, MVR compressor power and COP.
- **Crystallization** (`engine/crystallization.ts`): CRC solubility tables,
  yield and duties for cooling and evaporative crystallization, MSMPR
  distribution (dominant size 3Gτ, cumulative undersize).
- **Drying** (`engine/drying.ts`): humidity, enthalpy, wet bulb, dew point;
  constant- and falling-rate drying time; adiabatic continuous dryer with the
  air path on a psychrometric chart.

### McCabe–Thiele workbench (`engine/mtDesign.ts`)

- **VLE systems** (`engine/vle/systems.ts`): constant α; benzene/toluene and
  n-hexane/n-heptane (Raoult); methanol/water (Perry's datasheet); ethanol/water
  and isopropanol/water (Van Laar — azeotropes at x ≈ 0.91 and 0.66, validated
  against literature).
- **Calculation targets:** number of stages (fractional last stage), bottoms
  x_B for a given N, distillate x_D for a given N.
- **Murphree efficiency** on pseudo-equilibrium curves (kinked at the section switch).
- **Fixed feed stage** with dashed operating-line extensions; pinch and
  "feed below the column end" detection.
- **Azeotropes:** specifications must lie on one side; above the azeotrope the
  column is solved mirrored (x′ = 1 − x) and drawn under the diagonal.
- **Shortcuts (constant α):** Fenske N_min, Underwood v_min (binary, exact θ),
  Gilliland via Liddle's fit (slide misprints corrected) with an N–v chart,
  asymptotes and the 1.05–1.5·v_min design band.
- The unit tests reproduce every reference value of the workbench specification
  (N = 15.01, v_min = 2.123, Gilliland 15.62, the feed-stage table, Murphree cases, …).

### Batch distillation workbench (`engine/batch.ts`)

Open distillation (Rayleigh), batch rectification at constant reflux and at
constant distillate purity. Play / scrub the batch progress D/L₀; the y–x
construction, still / instantaneous / collected compositions, reflux, boil-up
and recovery follow. The flowsheet's **batch still** uses the same engine
(inlet = charge per cycle, outlets = receiver and residue at the chosen cut) and
can open the workbench pre-filled.

### Distillation lines (`engine/ternary/`)

Three components on one triangle, at total reflux (x_{n+1} = y*(x_n), every
point a stage):

- **Systems:** n-hexane / cyclohexane / n-heptane (ideal, zeotropic reference)
  and acetone / chloroform / methanol (Wilson). Each Wilson binary is fitted to
  its literature azeotrope at 1 atm; the ternary saddle azeotrope is then a
  *prediction* — 57.3 °C at (0.355, 0.213, 0.432) vs. ≈ 57.5 °C in the literature.
- **Singular points** found and classified from the stage map's Jacobian
  (light node / heavy node / saddle); **border lines** traced from saddle
  eigen-directions; the field seeded from heavy nodes and saddles, with arrows
  towards rising temperature.
- **Product regions** for a feed: between the distillation line through F and
  the direct / indirect splits, closed along the triangle edges or a border line.
- **Column at total reflux:** drag F and D; B follows from the material balance
  on the D–F line, chosen so that D and B share a distillation line; stage count
  and D/F are reported. *Snap D onto the line* iterates to a consistent split.
- Pressure slider moves the azeotropes (ternary saddle 51.5 °C at ≈ 0.81 bar).

### Extraction (`engine/extraction/`)

Three tools on one shared specification (X₀, Y₀, X_N, Ġ/L̇ per system), so they
compare number for number:

- **Cross-current** (loading diagram): one operating line per stage from the
  solvent line, whole stages, extraction factor per stage, pooled extract,
  X*(Y₀) limit; targets: stages, raffinate for given N, solvent ratio for given N.
- **Counter-current:** one operating line stepped off from the feed end,
  fractional stages, minimum solvent ratio (tangent pinch) and the one-stage
  ratio; same three targets; side-by-side solvent comparison with cross-current.
- **Hunter–Nash** (ternary, partly miscible): mixing point, E₁ by the lever
  rule, pole Δ = F − E₁ = R_N − S, stages from the feed end, S/F_min (tie-line
  pinch) and S/F_max (M reaches the binodal).

LLE systems (`lle.ts`): Water / Acetic acid / Isopropyl ether and Water /
Nicotine / Kerosene from Treybal's tables; Water with acetone or ethanol and
toluene, benzene or MIBK predicted with UNIFAC (`unifac.ts`, Hansen et al. 1991)
and an LLE flash continued to the plait point. The UNIFAC implementation is
checked against literature γ∞ (benzene and toluene in water, water in the
aromatics) and mutual solubilities; tie lines are verified isoactive. UNIFAC
systems are labelled as predictions in the UI.

## Data contract

Defined in `src/types/process.ts`. Internal units: kmol/h, **K**, kPa, kW
(°C is used only at the UI boundary).

```ts
// Stream (edge)
{ id, source, target, flowRate, temperature, pressure, vaporFraction /* q */, molarFractions: { compA, compB } }

// Unit operation (node)
{ id, type: 'feed' | 'mixer' | 'heater' | 'distillation' | 'batch' | 'flash',
  params: { theoreticalStages, refluxRatio, heatDuty, condenserType?, distillateToFeed?, feedSpec?, batchMode?, distilledFraction? },
  state:  { topProduct, bottomProduct } }
```

Extensions to the original contract: `type: 'feed'` (boundary streams), and the
optional params `condenserType` (`total` = 0 equilibrium stages, `partial` = +1),
`distillateToFeed` (D/F — closes the column rating problem) and `feedSpec`
(`'T'` → q computed, `'q'` → T computed; at fixed P and z they are not independent).
`useFlowsheet.getState().getUnitPayloads()` / `getStreamPayloads()` serialise the
canvas to exactly this schema.

## Thermodynamics engine (`src/engine/`)

Ideal property package: ideal liquid (γ = 1) + ideal gas, Raoult/Dalton
K-values `Kᵢ = Pᵢ°(T)/P`, Antoine vapour pressures. Enthalpy reference is the
pure liquid at 298.15 K; latent heat follows Kirchhoff's law from ΔHvap(Tb).

| Function | Purpose |
|---|---|
| `vaporPressure`, `saturationTemperature` | Antoine P°(T) and its analytic inverse |
| `bubbleTemperature`, `dewTemperature`, `bubblePressure`, `dewPressure` | Saturation points |
| `relativeVolatility`, `averageRelativeVolatility` | α(T) and column-average α |
| `yFromAlpha`, `xFromAlpha`, `equilibriumCurveAlpha`, `txyDiagram` | Equilibrium curves |
| `flashTP` (Rachford–Rice), `flashPH` | Isothermal and isenthalpic flash |
| `thermalCondition`, `stateFromThermalCondition` | Feed q ↔ (T, β) |
| `mixStreams`, `heatStream` | Adiabatic mixer and heater/cooler balances |
| `validityWarnings` | Antoine-range / Tc diagnostics |

Core functions take composition vectors (multicomponent-ready for MESH);
`binaryComponents`, `toVector`, `toBinary` adapt to the `{ compA, compB }` schema.
Components: benzene, toluene, n-hexane, n-heptane (default system benzene/toluene).
Polar/associating mixtures are excluded — Raoult's law does not apply to them.

### Flowsheet solver (`engine/flowsheet.ts`)

Sequential-modular: units are solved in topological order on every parameter
change, so downstream nodes update in the same render. Feed → (T or q) spec;
mixer → adiabatic mass/enthalpy balance + PH flash; heater → H_out = H_in + 3600·Q/F
+ PH flash; column → McCabe–Thiele rating (`engine/mccabeThiele.ts`: CMO,
column-average α, optimal feed stage, x_D solved by Brent so the reboiler liquid
equals x_B), products at bubble/dew point, condenser/reboiler duties from
rigorous enthalpies. Recycle loops are detected and flagged (not yet solved).
Each unit reports `ok / warning / error / idle` diagnostics (status LED on the node).

Validation (benzene/toluene, 1 atm, z = 0.5): bubble 92.1 °C, y = 0.714,
dew 98.8 °C, α̅ = 2.47 — matching textbook values.

## Column analysis panel (`components/analysis/`)

Selecting a distillation node docks a panel beside the canvas (lazy-loaded):

- **KPI cards**: distillate / bottoms purity, R/Rmin with an
  optimum-range badge, reboiler and condenser duty, feed stage and q.
- **McCabe–Thiele** (Recharts): constant-α equilibrium curve, y = x, rectifying
  (solid) and stripping (dashed) operating lines, q-line to the equilibrium
  pinch, stage staircase from x_D to x_B, highlighted feed stage, hover tooltip
  per stage. A partial condenser appears as the first step.
- **T–x–y**: rigorous Raoult envelope at column pressure with crosshair tooltip
  and the F / D / B stream points.
- **Stage table**: x, y and bubble-point temperature per stage (table view of
  the diagram).

Everything is driven by the store, so the panel redraws as sliders move.
Chart colours were validated for colour-vision deficiency on the dark surface
(`vizTokens.ts`); line style and direct labels carry identity alongside colour.

## Layout

```
src/
  types/process.ts          schema + port definitions
  engine/                   thermodynamics.ts, components.ts, numerics.ts + tests
  store/flowsheetStore.ts   Zustand store, propagation hook, demo flowsheet
  nodes/                    custom P&ID nodes (SVG symbols, glass instrument cards)
  edges/StreamEdge.tsx      phase-coloured pipe with live data tag
  components/               palette, inspector (shadcn sliders), status bar, canvas
  components/analysis/      McCabe–Thiele, T–x–y, stage table, KPI panel + chart data builders
```

## References

Thermodynamic and numerical methods are implemented independently from
published equations; the following projects are used as logic references only
(no code is copied — DWSIM and CADET are GPL-licensed):
DWSIM, CADET, ThermalSeparation (Modelica), and the McCabe–Thiele simulators by
trsav, 314arhaam and minangajayasekera-ops.

## Learning aids

- **Tutor mode** (circuit simplification, block-diagram reduction): the solution path step by step,
  three hints per step (idea → formula → approach), and an answer check.
- **Error diagnosis** (`src/lib/diagnose.ts`): a wrong answer is checked for typical slips — unit
  prefixes (×1000), sign, °C/K, factor 2/4/π/2π, time units, decimal point — and for the typical
  wrong method of the step (e.g. series formula used for a parallel connection).
- **Parameter help** for P/PI/PD/PID and **curve comparison** in the control simulator.

## Security and privacy

- **No third-party requests:** fonts are bundled (`@fontsource`), there is no tracking or
  analytics. Sheets and settings live in the browser's local storage only (see `#/privacy`).
- **Content Security Policy** (production build, `vite.config.ts`): scripts only from the site
  itself, no inline scripts (the theme bootstrap is `public/theme.js`).
- **Imported sheets are validated** with zod (`src/store/sheetSchemas.ts`) before they reach a
  store; invalid files are rejected without changing anything.
- **Robustness:** `src/__tests__/robustness.test.ts` feeds every solver with 0, negative, huge,
  tiny, NaN and ±∞ inputs; none may throw or hang. Inputs of the control pages are limited in
  `src/lib/guard.ts`, and every page has an error boundary instead of a blank screen.
- **CI hardening:** GitHub Actions pinned to commit SHAs, least-privilege `permissions`, CodeQL
  (`.github/workflows/codeql.yml`), `SECURITY.md` for private vulnerability reports, and
  security headers for Vercel (`vercel.json`: CSP incl. `frame-ancestors`, HSTS, nosniff …).

## Saving, exporting and shared examples

- **My sheets** (circuit simulator and control simulator): save the current sheet under a name in the
  browser, reopen or delete it, or export/import it as a `.json` file.
- **Export** (top right of the canvas): the whole diagram as PNG, the result panel as PNG, or a PDF report
  with the diagram and the results tab that is open.
- **Shared examples:** a sheet exported as a file and placed in `src/examples/control-sim/` or
  `src/examples/circuit/` is listed under "Shared examples" for every visitor after the next deploy.

## License

Copyright 2026 momo-senpai1. Licensed under the **Apache License, Version 2.0** — see
[`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Bundled third-party software and fonts keep their own
licenses (MIT, ISC, BSD, Apache-2.0, SIL OFL 1.1); every build writes the full list with license
texts to `third-party-licenses.txt`, linked in the footer of the start page.
