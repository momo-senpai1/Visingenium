/**
 * Sheets shipped with the website. Put a file exported with "Export file" (My sheets) into
 * src/examples/control-sim/ or src/examples/circuit/ and it appears for every visitor after the next deploy.
 */

import type { SheetApp } from '@/store/sheetsStore';

interface SheetFile {
  format?: string;
  app?: string;
  name?: string;
  payload?: unknown;
}

const files = import.meta.glob<SheetFile>('./*/*.json', { eager: true, import: 'default' });

export function sharedExamples(app: SheetApp): { name: string; payload: unknown }[] {
  return Object.entries(files)
    .filter(([path, f]) => path.startsWith(`./${app}/`) && f.format === 'practical-engineering-sheet' && f.app === app && f.payload)
    .map(([path, f]) => ({ name: f.name ?? path.split('/').pop()!.replace(/\.json$/, ''), payload: f.payload }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
