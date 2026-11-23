# Scientific sources and validation

Visingenium implements textbook and handbook methods from published equations
(no code is copied from other simulators). This page lists, for every module,
**which method is used, where it comes from, and how the result is checked**.
Where the code names a source (comments in `src/engine/**`), it is the one
listed here. Other entries are the standard references for the same method.

How to read the tables: *Method* is what the code computes, *Source* is where
the equation or data set is published. Data sets are listed separately in
section 11.

---

## 1. Thermal separation: vapour–liquid equilibrium and distillation

Code: `engine/thermodynamics.ts`, `propertyPackage.ts`, `components.ts`,
`vle/systems.ts`, `mccabeThiele.ts`, `mtDesign.ts`, `batch.ts`, `data/*.ts`

| Method | Source |
|---|---|
| Antoine vapour pressure, log₁₀ P° = A − B/(C + T) | Antoine (1888); constants from Dean, *Lange's Handbook of Chemistry*, 15th ed. (1999) |
| Raoult/Dalton K-values, bubble and dew point, Rachford–Rice flash | Rachford & Rice (1952); Prausnitz et al. (1999) |
| Wilson activity coefficients | Wilson (1964) |
| Van Laar activity coefficients (ethanol/water, isopropanol/water) | Van Laar (1910); parameters as in Perry's Handbook |
| Tabulated VLE (ethanol/water, methanol/water at 1 atm) | Perry's Chemical Engineers' Handbook |
| McCabe–Thiele construction | McCabe & Thiele (1925) |
| Murphree stage efficiency | Murphree (1925) |
| Fenske minimum stages | Fenske (1932) |
| Underwood minimum reflux | Underwood (1948) |
| Gilliland correlation, Liddle's fit | Gilliland (1940); Liddle (1968) |
| Rayleigh (open) batch distillation | Rayleigh (1902); Treybal (1980) |

## 2. Ternary distillation lines

Code: `engine/ternary/model.ts`, `lines.ts`

| Method | Source |
|---|---|
| Modified Raoult's law with Wilson γ for the ternary | Wilson (1964) |
| Binary Wilson parameters fitted to the literature azeotrope of each pair (composition and boiling point at 1 atm) | Azeotrope data: Gmehling et al., *Azeotropic Data* (DECHEMA / Wiley-VCH) |
| Distillation lines, singular points (nodes, saddles), border lines, product regions | Doherty & Malone, *Conceptual Design of Distillation Systems* (2001); Stichlmair & Fair, *Distillation: Principles and Practice* (1998) |

## 3. Extraction

Code: `engine/extraction/*.ts`

| Method | Source |
|---|---|
| Cross-current and counter-current cascades, loading diagram | Treybal, *Mass-Transfer Operations*, 3rd ed. (1980) |
| Hunter–Nash construction (ternary, partly miscible) | Hunter & Nash (1934); Treybal (1980) |
| UNIFAC activity coefficients (original UNIFAC, VLE parameter table) | Hansen, Rasmussen, Fredenslund, Schiller & Gmehling (1991) |
| LLE flash (K = γ^R/γ^E, Rachford–Rice) | Prausnitz et al. (1999) |
| Tie-line data: water / acetic acid / isopropyl ether, water / nicotine / kerosene, 20 °C | Treybal, *Mass-Transfer Operations* |

UNIFAC-based systems are labelled "prediction" in the user interface.

## 4. Absorption, evaporation, crystallization, drying

Code: `engine/absorption.ts`, `evaporation.ts`, `crystallization.ts`, `drying.ts`

| Method | Source |
|---|---|
| Henry constants and their temperature dependence | Sander (2015) |
| Kremser equation, NTU × HTU packed height | Kremser (1930); Treybal (1980) |
| Multiple-effect evaporation, forward feed, equal-area design | McCabe, Smith & Harriott, *Unit Operations of Chemical Engineering*, 7th ed. (2005) |
| Latent heat of water (Watson correlation) | Watson (1943) |
| Boiling-point elevation (ebullioscopic estimate) | Atkins & de Paula, *Physical Chemistry* |
| Solubility tables for crystallization | *CRC Handbook of Chemistry and Physics* |
| MSMPR crystal size distribution (dominant size 3Gτ) | Randolph & Larson, *Theory of Particulate Processes*, 2nd ed. (1988) |
| Psychrometrics, wet bulb, constant- and falling-rate drying | Treybal (1980); McCabe, Smith & Harriott (2005) |

## 5. Heat and mass transfer

Code: `engine/heat/*.ts`

| Method | Source |
|---|---|
| Thermal-resistance method (wall, pipe, sphere), critical insulation radius, fins | Incropera, DeWitt, Bergman & Lavine, *Fundamentals of Heat and Mass Transfer*; Baehr & Stephan, *Wärme- und Stoffübertragung* |
| Transient conduction: series solutions (plate, cylinder, sphere), Heisler/Gröber charts, lumped capacitance, semi-infinite body | Heisler (1947); Gröber, Erk & Grigull; Incropera et al. |
| Pipe flow Nusselt number (Gnielinski) | Gnielinski (1976); VDI-Wärmeatlas, 11th ed. (2013) |
| Cylinder in cross flow | Churchill & Bernstein (1977) |
| Free convection, vertical plate and horizontal cylinder | Churchill & Chu (1975a, 1975b) |
| Flat plate, laminar/turbulent combined; transition pipe flow | VDI-Wärmeatlas (2013) |
| Black-body radiation, band fraction, gray surfaces, shields, view factors | Incropera et al. (tables of view factors) |
| Heat exchangers by ε–NTU, LMTD check, cross flow | Kays & London, *Compact Heat Exchangers*, 3rd ed. (1984); Incropera et al. |
| Fick's law, Stefan tube, penetration theory | Bird, Stewart & Lightfoot, *Transport Phenomena*; Incropera et al. |
| Binary gas diffusion coefficients | Fuller, Schettler & Giddings (1966) |
| Error function approximation | Abramowitz & Stegun (1964), 7.1.26 |
| Bessel functions J₀, J₁ | Press et al., *Numerical Recipes* |

Fluid property tables (air, water at about 1 bar) follow VDI-Wärmeatlas and
standard textbook tables.

## 6. Thermodynamics

Code: `engine/thermo/*.ts`

| Method | Source |
|---|---|
| Water saturation line and auxiliary equations | IAPWS SR1-86 (1992); Wagner & Pruß (1993) |
| Superheated steam, region 2 | IAPWS-IF97: Wagner et al. (2000) |
| Cycles (Carnot, Joule/Brayton, Otto, Diesel, Clausius–Rankine) | Baehr & Kabelac, *Thermodynamik*; Çengel & Boles, *Thermodynamics: An Engineering Approach* |
| Exergy balance, Gouy–Stodola theorem (T₀·s_irr) | Bejan, *Advanced Engineering Thermodynamics*; Baehr & Kabelac |
| Real gases: van der Waals, Redlich–Kwong, Peng–Robinson | van der Waals (1873); Redlich & Kwong (1949); Peng & Robinson (1976) |
| Phase equilibrium by equal fugacity (equal-area rule) | Prausnitz et al. (1999) |
| Liquid–liquid miscibility gap, two-parameter Margules model | Prausnitz et al. (1999) |
| Humid air (h,x diagram), saturation over ice | IAPWS (water); Magnus formula (ice); Baehr & Kabelac |

## 7. Fluid mechanics

Code: `engine/fluid/pipe.ts`

| Method | Source |
|---|---|
| Laminar friction 64/Re (Hagen–Poiseuille) | Standard result; Schlichting & Gersten, *Boundary-Layer Theory* |
| Turbulent friction, Colebrook–White (start value Haaland) | Colebrook (1939); Haaland (1983) |
| Moody diagram | Moody (1944) |
| Borda–Carnot loss at area changes, extended Bernoulli equation | Standard; Truckenbrodt, *Fluidmechanik* |
| Power-law exponent of the turbulent velocity profile | Schlichting & Gersten (table, interpolated in log Re) |

## 8. Mechanics

Code: `engine/mechanics/*.ts`

| Method | Source |
|---|---|
| Sign conventions, beam theory, N/Q/M diagrams, bending stress | Gross, Hauger, Schröder & Wall, *Technische Mechanik* 1–2 (Springer) |
| Euler–Bernoulli finite elements for beams | Bathe, *Finite Element Procedures*; Przemieniecki, *Theory of Matrix Structural Analysis* |
| Truss: direct stiffness method, determinacy check 2k = s + r | Gross et al.; Przemieniecki |
| Torsion of shafts, τ = M_t/W_t, φ = M_t·L/(G·I_p) | Gross et al., *Technische Mechanik* 2 |

## 9. Control engineering, filters, signals

Code: `engine/control/*.ts`, `lib/kalman.ts`, `lib/nyquist.ts`

| Method | Source |
|---|---|
| Transfer functions, block-diagram reduction, steady-state error | Lunze, *Regelungstechnik 1* (Springer); Ogata, *Modern Control Engineering* |
| Root finding (Durand–Kerner / Weierstrass iteration) | Durand (1960); Kerner (1966) |
| Routh–Hurwitz criterion | Ogata; Lunze |
| Gain and phase margin, Bode, Nyquist | Ogata; Lunze |
| Exact discretisation (zero-order hold, matrix exponential) | Franklin, Powell & Workman, *Digital Control of Dynamic Systems*, 3rd ed. (1998) |
| Padé approximation of dead time, RK4 step response | Standard numerical methods; Press et al. |
| Butterworth, Chebyshev, Bessel prototypes; frequency transformations | Butterworth (1930); Zverev, *Handbook of Filter Synthesis* (1967) |
| Sallen–Key second-order sections | Sallen & Key (1955) |
| Fourier series, Gibbs phenomenon, radix-2 FFT, windows, aliasing | Cooley & Tukey (1965); Oppenheim & Schafer, *Discrete-Time Signal Processing* |
| Discrete Kalman filter (random walk, constant velocity) | Kalman (1960); Welch & Bishop, *An Introduction to the Kalman Filter* (2006) |

## 10. Electrical circuits

Code: `engine/circuits/*.ts`

| Method | Source |
|---|---|
| Modified nodal analysis | Ho, Ruehli & Brennan (1975) |
| Newton–Raphson with junction limiting, backward-Euler companion models | Nagel (1975, SPICE2); Vladimirescu, *The SPICE Book* (1994) |
| Bipolar transistor model (Ebers–Moll) | Ebers & Moll (1954) |
| MOSFET and JFET square-law model | Shichman & Hodges (1968) |
| Star–delta conversion, Thévenin/Norton, phasor analysis, three-phase systems | Standard network theory; Hambley, *Electrical Engineering: Principles and Applications* |

---

## 11. Data provenance

| Data | Origin | Where in the code |
|---|---|---|
| Ethanol/water and methanol/water x–y data, 1 atm | Perry's Chemical Engineers' Handbook | `engine/data/*.ts` |
| Antoine constants | Dean, *Lange's Handbook*, 15th ed. | `engine/components.ts`, `vle/systems.ts`, `ternary/model.ts` |
| Henry constants | Sander (2015) | `engine/absorption.ts` |
| Solubility tables | CRC Handbook of Chemistry and Physics | `engine/crystallization.ts` |
| LLE tie lines | Treybal, *Mass-Transfer Operations* | `engine/extraction/lle.ts` |
| UNIFAC group parameters | Hansen et al. (1991) | `engine/extraction/unifac.ts` |
| Azeotropes used to fit Wilson parameters | Literature azeotrope data (Gmehling et al.) | `engine/propertyPackage.ts`, `ternary/model.ts` |
| THF/H₂O/butanediol balance example | Illustrative process and numbers; THF/water y*(x) tables at 10 and 20 bar | `engine/balance/examples.ts`, `columnMT.ts` |

## 12. Validation

All checks run in the automatic test suite (`npm test`, vitest) and in CI on
every push.

| Area | Check | Result |
|---|---|---|
| Benzene/toluene, 1 atm, z = 0.5 | Bubble point, dew point, vapour composition, mean α against textbook values | 92.1 °C, 98.8 °C, y = 0.714, α̅ = 2.47 |
| Ethanol/water Wilson fit | Compared with Perry's VLE | Within 0.02 in y; azeotrope at 78.2 °C |
| Ternary acetone/chloroform/methanol | Predicted saddle azeotrope (not fitted) against the literature | 57.3 °C vs. ≈ 57.5 °C |
| McCabe–Thiele workbench | Reference values for a binary design (α = 2, x_D = 0.95, x_B = 0.05) | N = 15.01, v_min = 2.123, Gilliland 15.62, feed-stage table, Murphree cases |
| Steam and saturation properties | Against steam tables | Deviation below 0.1 %; a few % only next to the saturation line above 120 bar (boiler pressure limited to 120 bar) |
| Exergy balance of cycles | Supplied exergy = net work + losses | Tested for every cycle |
| UNIFAC | Infinite-dilution γ∞ and mutual solubilities against literature; tie lines verified isoactive | Tests in `engine/extraction/__tests__` |
| Maxwell construction | Equal-area rule against equal fugacity | Verified numerically |
| Robustness | Every solver fed with 0, negative, huge, tiny, NaN and ±∞ inputs | No throw, no hang (`src/__tests__/robustness.test.ts`) |

## 13. Scope and limitations

Stated openly so the results are not over-read:

- Educational and pre-design tool. It is **not validated for plant design,
  safety-relevant sizing or regulatory use**.
- The flowsheet property package is ideal or Wilson-based and limited to
  validated binary pairs. Pairs that form two liquid phases, or that lack
  validated parameters, are refused with the reason shown.
- Recycle loops in the flowsheet simulator are detected and flagged, not yet
  solved (the balance-task module does solve recycles).
- Superheated steam uses region 2 of IAPWS-IF97 with the leading residual
  terms only (about 0.5 % in h and s up to roughly 100 bar).
- UNIFAC systems are predictions; tabulated systems are measured data.
- Kurdish interface strings are pending review by a native speaker.

## 14. Bibliography

<!-- TODO(author): add edition/year for Perry's, CRC Handbook, Incropera and the other works cited without one, matching the edition actually used. -->

**Journal articles and original papers**

- Abramowitz, M. & Stegun, I. A. (1964). *Handbook of Mathematical Functions.* National Bureau of Standards.
- Antoine, C. (1888). Tensions des vapeurs: nouvelle relation entre les tensions et les températures. *Comptes Rendus* 107, 681–684.
- Butterworth, S. (1930). On the theory of filter amplifiers. *Wireless Engineer* 7, 536–541.
- Churchill, S. W. & Bernstein, M. (1977). A correlating equation for forced convection from gases and liquids to a circular cylinder in crossflow. *J. Heat Transfer* 99, 300–306.
- Churchill, S. W. & Chu, H. H. S. (1975a). Correlating equations for laminar and turbulent free convection from a vertical plate. *Int. J. Heat Mass Transfer* 18, 1323–1329.
- Churchill, S. W. & Chu, H. H. S. (1975b). Correlating equations for laminar and turbulent free convection from a horizontal cylinder. *Int. J. Heat Mass Transfer* 18, 1049–1053.
- Colebrook, C. F. (1939). Turbulent flow in pipes, with particular reference to the transition region between the smooth and rough pipe laws. *J. Inst. Civ. Eng.* 11, 133–156.
- Cooley, J. W. & Tukey, J. W. (1965). An algorithm for the machine calculation of complex Fourier series. *Math. Comp.* 19, 297–301.
- Durand, E. (1960). *Solutions numériques des équations algébriques.* Masson.
- Ebers, J. J. & Moll, J. L. (1954). Large-signal behavior of junction transistors. *Proc. IRE* 42, 1761–1772.
- Fenske, M. R. (1932). Fractionation of straight-run Pennsylvania gasoline. *Ind. Eng. Chem.* 24, 482–485.
- Fuller, E. N., Schettler, P. D. & Giddings, J. C. (1966). A new method for prediction of binary gas-phase diffusion coefficients. *Ind. Eng. Chem.* 58(5), 18–27.
- Gilliland, E. R. (1940). Multicomponent rectification: estimation of the number of theoretical plates as a function of the reflux ratio. *Ind. Eng. Chem.* 32, 1220–1223.
- Gnielinski, V. (1976). New equations for heat and mass transfer in turbulent pipe and channel flow. *Int. Chem. Eng.* 16, 359–368.
- Haaland, S. E. (1983). Simple and explicit formulas for the friction factor in turbulent pipe flow. *J. Fluids Eng.* 105, 89–90.
- Hansen, H. K., Rasmussen, P., Fredenslund, A., Schiller, M. & Gmehling, J. (1991). Vapor–liquid equilibria by UNIFAC group contribution. 5. Revision and extension. *Ind. Eng. Chem. Res.* 30, 2352–2355.
- Heisler, M. P. (1947). Temperature charts for induction and constant-temperature heating. *Trans. ASME* 69, 227–236.
- Ho, C.-W., Ruehli, A. E. & Brennan, P. A. (1975). The modified nodal approach to network analysis. *IEEE Trans. Circuits Syst.* 22, 504–509.
- Hunter, T. G. & Nash, A. W. (1934). The application of physico-chemical principles to the design of liquid–liquid contact equipment. *J. Soc. Chem. Ind.* 53, 95T–102T.
- Kalman, R. E. (1960). A new approach to linear filtering and prediction problems. *J. Basic Eng.* 82, 35–45.
- Kerner, I. O. (1966). Ein Gesamtschrittverfahren zur Berechnung der Nullstellen von Polynomen. *Numer. Math.* 8, 290–294.
- Kremser, A. (1930). Theoretical analysis of absorption process. *Natl. Petroleum News* 22(21), 43–49.
- Liddle, C. J. (1968). Improved shortcut method for distillation calculations. *Chem. Eng.* 75(23), 137–142.
- McCabe, W. L. & Thiele, E. W. (1925). Graphical design of fractionating columns. *Ind. Eng. Chem.* 17, 605–611.
- Moody, L. F. (1944). Friction factors for pipe flow. *Trans. ASME* 66, 671–684.
- Murphree, E. V. (1925). Rectifying column calculations. *Ind. Eng. Chem.* 17, 747–750.
- Nagel, L. W. (1975). *SPICE2: A computer program to simulate semiconductor circuits.* Memorandum ERL-M520, UC Berkeley.
- Peng, D.-Y. & Robinson, D. B. (1976). A new two-constant equation of state. *Ind. Eng. Chem. Fundam.* 15, 59–64.
- Rachford, H. H. & Rice, J. D. (1952). Procedure for use of electronic digital computers in calculating flash vaporization hydrocarbon equilibrium. *J. Pet. Technol.* 4(10), 19–3.
- Redlich, O. & Kwong, J. N. S. (1949). On the thermodynamics of solutions. V. An equation of state. *Chem. Rev.* 44, 233–244.
- Sallen, R. P. & Key, E. L. (1955). A practical method of designing RC active filters. *IRE Trans. Circuit Theory* 2, 74–85.
- Sander, R. (2015). Compilation of Henry's law constants (version 4.0) for water as solvent. *Atmos. Chem. Phys.* 15, 4399–4981.
- Shichman, H. & Hodges, D. A. (1968). Modeling and simulation of insulated-gate field-effect transistor switching circuits. *IEEE J. Solid-State Circuits* 3, 285–289.
- Lord Rayleigh (1902). On the distillation of binary mixtures. *Phil. Mag.* 4, 521–537.
- Underwood, A. J. V. (1948). Fractional distillation of multicomponent mixtures. *Chem. Eng. Prog.* 44, 603–614.
- van der Waals, J. D. (1873). *Over de continuïteit van den gas- en vloeistoftoestand.* PhD thesis, Leiden.
- Van Laar, J. J. (1910). Über Dampfspannungen von binären Gemischen. *Z. Phys. Chem.* 72, 723–751.
- Wagner, W. & Pruß, A. (1993). International equations for the saturation properties of ordinary water substance. Revised according to the International Temperature Scale of 1990. *J. Phys. Chem. Ref. Data* 22, 783–787.
- Wagner, W. et al. (2000). The IAPWS Industrial Formulation 1997 for the thermodynamic properties of water and steam. *J. Eng. Gas Turbines Power* 122, 150–184.
- Watson, K. M. (1943). Thermodynamics of the liquid state. *Ind. Eng. Chem.* 35, 398–406.
- Wilson, G. M. (1964). Vapor–liquid equilibrium. XI. A new expression for the excess free energy of mixing. *J. Am. Chem. Soc.* 86, 127–130.
- IAPWS (1992). *Revised Supplementary Release on Saturation Properties of Ordinary Water Substance* (SR1-86).

**Books and handbooks**

- Atkins, P. & de Paula, J. *Physical Chemistry.* Oxford University Press.
- Baehr, H. D. & Kabelac, S. *Thermodynamik.* Springer.
- Baehr, H. D. & Stephan, K. *Wärme- und Stoffübertragung.* Springer.
- Bathe, K.-J. (1996). *Finite Element Procedures.* Prentice Hall.
- Bejan, A. (2016). *Advanced Engineering Thermodynamics*, 4th ed. Wiley.
- Bird, R. B., Stewart, W. E. & Lightfoot, E. N. *Transport Phenomena.* Wiley.
- Çengel, Y. A. & Boles, M. A. *Thermodynamics: An Engineering Approach.* McGraw-Hill.
- *CRC Handbook of Chemistry and Physics.* CRC Press.
- Dean, J. A. (ed.) (1999). *Lange's Handbook of Chemistry*, 15th ed. McGraw-Hill.
- Doherty, M. F. & Malone, M. F. (2001). *Conceptual Design of Distillation Systems.* McGraw-Hill.
- Franklin, G. F., Powell, J. D. & Workman, M. L. (1998). *Digital Control of Dynamic Systems*, 3rd ed. Addison-Wesley.
- Gmehling, J. et al. *Azeotropic Data.* Wiley-VCH / DECHEMA.
- Gross, D., Hauger, W., Schröder, J. & Wall, W. A. *Technische Mechanik* 1–2. Springer.
- Hambley, A. R. *Electrical Engineering: Principles and Applications.* Pearson.
- Incropera, F. P., DeWitt, D. P., Bergman, T. L. & Lavine, A. S. *Fundamentals of Heat and Mass Transfer.* Wiley.
- Kays, W. M. & London, A. L. (1984). *Compact Heat Exchangers*, 3rd ed. McGraw-Hill.
- Lunze, J. *Regelungstechnik 1.* Springer.
- McCabe, W. L., Smith, J. C. & Harriott, P. (2005). *Unit Operations of Chemical Engineering*, 7th ed. McGraw-Hill.
- Ogata, K. *Modern Control Engineering.* Pearson.
- Oppenheim, A. V. & Schafer, R. W. *Discrete-Time Signal Processing.* Pearson.
- *Perry's Chemical Engineers' Handbook.* McGraw-Hill.
- Press, W. H. et al. *Numerical Recipes.* Cambridge University Press.
- Prausnitz, J. M., Lichtenthaler, R. N. & de Azevedo, E. G. (1999). *Molecular Thermodynamics of Fluid-Phase Equilibria*, 3rd ed. Prentice Hall.
- Przemieniecki, J. S. (1968). *Theory of Matrix Structural Analysis.* McGraw-Hill.
- Randolph, A. D. & Larson, M. A. (1988). *Theory of Particulate Processes*, 2nd ed. Academic Press.
- Schlichting, H. & Gersten, K. *Boundary-Layer Theory.* Springer.
- Stichlmair, J. G. & Fair, J. R. (1998). *Distillation: Principles and Practice.* Wiley-VCH.
- Treybal, R. E. (1980). *Mass-Transfer Operations*, 3rd ed. McGraw-Hill.
- Truckenbrodt, E. *Fluidmechanik.* Springer.
- VDI e. V. (2013). *VDI-Wärmeatlas*, 11th ed. Springer.
- Vladimirescu, A. (1994). *The SPICE Book.* Wiley.
- Welch, G. & Bishop, G. (2006). *An Introduction to the Kalman Filter.* UNC Chapel Hill, TR 95-041.
- Zverev, A. I. (1967). *Handbook of Filter Synthesis.* Wiley.

**Topics follow typical lectures in:** heat and mass transfer (TU Darmstadt, TU München, Universität Siegen) and the usual undergraduate engineering syllabi.
