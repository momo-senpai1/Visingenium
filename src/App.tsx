import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SECTION_OF, useRoute, type Route } from '@/lib/route';
import { SubjectBackdrop } from '@/components/bg/SubjectBackdrop';
import { useLang } from '@/i18n';

const FlowsheetPage = lazy(() => import('@/pages/FlowsheetPage'));
const McCabeThielePage = lazy(() => import('@/pages/McCabeThielePage'));
const BatchPage = lazy(() => import('@/pages/BatchPage'));
const DistillationLinesPage = lazy(() => import('@/pages/DistillationLinesPage'));
const ExtractionPage = lazy(() => import('@/pages/ExtractionPage'));
const AbsorptionPage = lazy(() => import('@/pages/AbsorptionPage'));
const EvaporationPage = lazy(() => import('@/pages/EvaporationPage'));
const CrystallizationPage = lazy(() => import('@/pages/CrystallizationPage'));
const DryingPage = lazy(() => import('@/pages/DryingPage'));
const CyclesPage = lazy(() => import('@/pages/thermo/CyclesPage'));
const SteamPage = lazy(() => import('@/pages/thermo/SteamPage'));
const RealGasPage = lazy(() => import('@/pages/thermo/RealGasPage'));
const MixturesPage = lazy(() => import('@/pages/thermo/MixturesPage'));
const HumidAirPage = lazy(() => import('@/pages/thermo/HumidAirPage'));
const PipePage = lazy(() => import('@/pages/fluid/PipePage'));
const FormulasPage = lazy(() => import('@/pages/tools/FormulasPage'));
const UnitsPage = lazy(() => import('@/pages/tools/UnitsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));
const CircuitsPage = lazy(() => import('@/pages/CircuitsPage'));
const BeamPage = lazy(() => import('@/pages/mechanics/BeamPage'));
const TrussPage = lazy(() => import('@/pages/mechanics/TrussPage'));
const TorsionPage = lazy(() => import('@/pages/mechanics/TorsionPage'));
const ConductionPage = lazy(() => import('@/pages/heat/ConductionPage'));
const FinPage = lazy(() => import('@/pages/heat/FinPage'));
const TransientPage = lazy(() => import('@/pages/heat/TransientPage'));
const ConvectionPage = lazy(() => import('@/pages/heat/ConvectionPage'));
const RadiationPage = lazy(() => import('@/pages/heat/RadiationPage'));
const ExchangerPage = lazy(() => import('@/pages/heat/ExchangerPage'));
const DiffusionPage = lazy(() => import('@/pages/heat/DiffusionPage'));
const SimulatorPage = lazy(() => import('@/pages/control/SimulatorPage'));
const ControlLoopPage = lazy(() => import('@/pages/control/ControlLoopPage'));
const BodePage = lazy(() => import('@/pages/control/BodePage'));
const FilterPage = lazy(() => import('@/pages/control/FilterPage'));
const FourierPage = lazy(() => import('@/pages/control/FourierPage'));
const KalmanPage = lazy(() => import('@/pages/control/KalmanPage'));
/** electrical-engineering explainers */
const EE_PAGES: Partial<Record<Route, LazyExoticComponent<ComponentType>>> = {
  'ee-ohm': lazy(() => import('@/pages/circuits/OhmPage')),
  'ee-divider': lazy(() => import('@/pages/circuits/DividerPage')),
  'ee-rc': lazy(() => import('@/pages/circuits/TransientPage')),
  'ee-phasor': lazy(() => import('@/pages/circuits/PhasorPage')),
  'ee-rlc': lazy(() => import('@/pages/circuits/RlcPage')),
  'ee-power': lazy(() => import('@/pages/circuits/PowerPage')),
  'ee-3phase': lazy(() => import('@/pages/circuits/ThreePhasePage')),
  'ee-transformer': lazy(() => import('@/pages/circuits/TransformerPage')),
  'ee-diode': lazy(() => import('@/pages/circuits/DiodePage')),
  'ee-transistor': lazy(() => import('@/pages/circuits/TransistorPage')),
  'ee-motor': lazy(() => import('@/pages/circuits/MotorPage')),
};


export default function App() {
  const { route, params } = useRoute();
  // re-render the whole tree when the language changes; plain t() calls read the store directly
  const lang = useLang((s) => s.lang);
  return (
      <div key={lang} className="relative flex h-full flex-col gap-2 p-2">
        <SubjectBackdrop section={SECTION_OF(route)} />
        <AppHeader route={route} />
        <ErrorBoundary resetKey={route}>
          {route === 'flowsheet' ? (
            <Suspense fallback={<div className="glass flex-1 animate-pulse" aria-busy="true" />}>
              <FlowsheetPage />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="glass flex-1 animate-pulse" aria-busy="true" />}>
              <main key={route} className="relative min-h-0 flex-1 overflow-y-auto">
                {EE_PAGES[route] ? (
                  (() => {
                    const Page = EE_PAGES[route]!;
                    return <Page />;
                  })()
                ) : route === 'mccabe-thiele' ? (
                  <McCabeThielePage params={params} />
                ) : route === 'batch' ? (
                  <BatchPage params={params} />
                ) : route === 'extraction' ? (
                  <ExtractionPage params={params} />
                ) : route === 'absorption' ? (
                  <AbsorptionPage params={params} />
                ) : route === 'evaporation' ? (
                  <EvaporationPage />
                ) : route === 'crystallization' ? (
                  <CrystallizationPage />
                ) : route === 'drying' ? (
                  <DryingPage />
                ) : route === 'home' ? (
                  <HomePage />
                ) : route === 'privacy' ? (
                  <PrivacyPage />
                ) : route === 'cycles' ? (
                  <CyclesPage />
                ) : route === 'steam' ? (
                  <SteamPage />
                ) : route === 'realgas' ? (
                  <RealGasPage />
                ) : route === 'mixtures' ? (
                  <MixturesPage />
                ) : route === 'humidair' ? (
                  <HumidAirPage />
                ) : route === 'pipe' ? (
                  <PipePage />
                ) : route === 'formulas' ? (
                  <FormulasPage />
                ) : route === 'units' ? (
                  <UnitsPage />
                ) : route === 'circuits' ? (
                  <CircuitsPage />
                ) : route === 'beam' ? (
                  <BeamPage />
                ) : route === 'truss' ? (
                  <TrussPage />
                ) : route === 'torsion' ? (
                  <TorsionPage />
                ) : route === 'conduction' ? (
                  <ConductionPage />
                ) : route === 'fin' ? (
                  <FinPage />
                ) : route === 'transient' ? (
                  <TransientPage />
                ) : route === 'convection' ? (
                  <ConvectionPage />
                ) : route === 'radiation' ? (
                  <RadiationPage />
                ) : route === 'exchanger' ? (
                  <ExchangerPage />
                ) : route === 'diffusion' ? (
                  <DiffusionPage />
                ) : route === 'control-sim' ? (
                  <SimulatorPage />
                ) : route === 'control' ? (
                  <ControlLoopPage />
                ) : route === 'bode' ? (
                  <BodePage />
                ) : route === 'filters' ? (
                  <FilterPage />
                ) : route === 'kalman' ? (
                  <KalmanPage />
                ) : route === 'fourier' ? (
                  <FourierPage />
                ) : (
                  <DistillationLinesPage />
                )}
              </main>
            </Suspense>
          )}
        </ErrorBoundary>
      </div>
  );
}
