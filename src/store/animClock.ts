/**
 * One clock for all background animations: every scene is drawn as a function of this time,
 * so pausing, scrubbing and changing the speed affect all of them at once.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/components/mechanics/common';

export type BgMode = 'all' | 'home' | 'off';

interface Clock {
  playing: boolean;
  speed: number;
  /** time [s] at the anchor */
  base: number;
  /** performance.now() at the anchor */
  anchor: number;
  /** where animated backgrounds are shown */
  mode: BgMode;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  setSpeed: (s: number) => void;
  setMode: (m: BgMode) => void;
}

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** current animation time [s] */
export const clockNow = (c: Pick<Clock, 'playing' | 'base' | 'anchor' | 'speed'>) => (c.playing ? c.base + ((performance.now() - c.anchor) / 1000) * c.speed : c.base);

export const useAnimClock = create<Clock>()(
  persist(
    (set, get) => ({
      playing: !reduced(),
      speed: 1,
      base: 0,
      anchor: typeof performance !== 'undefined' ? performance.now() : 0,
      mode: 'all',
      play: () => set({ playing: true, anchor: performance.now() }),
      pause: () => set({ playing: false, base: clockNow(get()) }),
      toggle: () => (get().playing ? get().pause() : get().play()),
      seek: (t) => set({ base: Math.max(0, t), anchor: performance.now() }),
      setSpeed: (s) => set({ base: clockNow(get()), anchor: performance.now(), speed: s }),
      setMode: (m) => set({ mode: m }),
    }),
    {
      name: 'pe-anim',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ speed: s.speed, mode: s.mode }),
    },
  ),
);
