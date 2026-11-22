import { Pause, Play, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { clockNow, useAnimClock, type BgMode } from '@/store/animClock';

const WINDOW = 60; // the time slider covers 0 … 60 s (the scenes repeat within that)

/** Header control: play/pause, and a popover with time slider, speed and where backgrounds run. */
export function AnimControls() {
  const c = useAnimClock();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(clockNow(useAnimClock.getState())), 100);
    const down = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as globalThis.Node) && setOpen(false);
    document.addEventListener('pointerdown', down);
    return () => {
      clearInterval(id);
      document.removeEventListener('pointerdown', down);
    };
  }, [open]);
  const btn = 'grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] text-plant-300 hover:text-signal-liquid';
  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button type="button" aria-label={c.playing ? t('Pause animations') : t('Play animations')} onClick={c.toggle} className={btn}>
        {c.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button type="button" aria-label={t('Animation settings')} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={btn}>
        <Sparkles className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="dialog" aria-label={t('Animation settings')} className="glass absolute right-0 top-full z-50 mt-2 w-72 space-y-3 !bg-plant-900 p-3 text-[11px] text-plant-300 shadow-lg">
          <label className="block">
            <span className="flex justify-between">
              {t('Time')} <span className="font-mono text-plant-100">{(now % WINDOW).toFixed(1)} s</span>
            </span>
            <input
              aria-label={t('Time')}
              type="range"
              min={0}
              max={WINDOW}
              step={0.05}
              value={now % WINDOW}
              onChange={(e) => {
                if (c.playing) c.pause();
                c.seek(Number(e.target.value));
                setNow(Number(e.target.value));
              }}
              className="mt-1 w-full accent-[rgb(var(--sig-liquid))]"
            />
          </label>
          <div className="flex items-center gap-1">
            <span className="mr-1">{t('Speed')}</span>
            {[0.25, 0.5, 1, 2].map((s) => (
              <button key={s} type="button" aria-pressed={c.speed === s} onClick={() => c.setSpeed(s)} className={cn('rounded-full px-2 py-0.5', c.speed === s ? 'bg-signal-liquid/15 text-signal-liquid' : 'hover:bg-white/[0.05]')}>
                {s}×
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1">{t('Animated backgrounds')}</p>
            <div className="flex gap-1">
              {(
                [
                  ['all', 'Everywhere'],
                  ['home', 'Start page only'],
                  ['off', 'Off'],
                ] as [BgMode, string][]
              ).map(([m, l]) => (
                <button key={m} type="button" aria-pressed={c.mode === m} onClick={() => c.setMode(m)} className={cn('rounded-full px-2 py-0.5', c.mode === m ? 'bg-signal-liquid/15 text-signal-liquid' : 'hover:bg-white/[0.05]')}>
                  {t(l)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-plant-500">{t('Move the mouse (or touch) over a background: the load follows it on the beam, the heat source in the temperature field, the cut-off frequency in the filter.')}</p>
        </div>
      )}
    </div>
  );
}
