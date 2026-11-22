import { useEffect } from 'react';
import type { Section } from '@/lib/route';
import { useAnimClock } from '@/store/animClock';
import { AnimatedCanvas } from './AnimatedCanvas';
import type { SceneId } from './scenes';

export const SECTION_SCENE: Record<Section, SceneId> = {
  thermal: 'separation',
  heat: 'heat',
  circuits: 'circuits',
  mechanics: 'mechanics',
  control: 'control',
  thermo: 'thermo',
  fluid: 'fluid',
  tools: 'smoke',
};

/**
 * Full-screen animated background behind the pages of a subject. On the tool pages it stays
 * faint and cheap (lower resolution and frame rate, no pointer input); the glass panels switch
 * to opaque without blur meanwhile, so the moving background never has to be re-blurred.
 */
export function SubjectBackdrop({ section }: { section: Section | null }) {
  const mode = useAnimClock((s) => s.mode);
  const live = section !== null && mode === 'all';
  useEffect(() => {
    document.documentElement.classList.toggle('bg-live', live);
    return () => document.documentElement.classList.remove('bg-live');
  }, [live]);
  if (!live) return <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--sig-liquid)/0.06),transparent_60%)]" />;
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden>
      <AnimatedCanvas scene={SECTION_SCENE[section]} fps={20} resolution={0.6} pointer="none" opacity={0.45} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(var(--plant-950)/0.7)_100%)]" />
    </div>
  );
}
