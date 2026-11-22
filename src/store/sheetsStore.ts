/** Named sheets the user saved (block diagrams, circuits), kept in the browser's local storage. */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/components/mechanics/common';

export type SheetApp = 'control-sim' | 'circuit';
export interface SavedSheet {
  name: string;
  savedAt: number;
  payload: unknown;
}

interface State {
  sheets: Record<SheetApp, SavedSheet[]>;
  save: (app: SheetApp, name: string, payload: unknown) => void;
  remove: (app: SheetApp, name: string) => void;
}

export const useSheets = create<State>()(
  persist(
    (set, get) => ({
      sheets: { 'control-sim': [], circuit: [] },
      save: (app, name, payload) => {
        const list = get().sheets[app].filter((s) => s.name !== name);
        set({ sheets: { ...get().sheets, [app]: [{ name, savedAt: Date.now(), payload: structuredClone(payload) }, ...list] } });
      },
      remove: (app, name) => set({ sheets: { ...get().sheets, [app]: get().sheets[app].filter((s) => s.name !== name) } }),
    }),
    { name: 'pe-saved-sheets', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);

/** Offer a sheet as a .json file download. */
export function downloadSheet(app: SheetApp, name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify({ format: 'practical-engineering-sheet', app, name, payload }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\w\- ]+/g, '_') || 'sheet'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Parse an imported file; returns null when it is not a sheet of this app. */
export function parseSheet(app: SheetApp, text: string): { name: string; payload: unknown } | null {
  try {
    const j = JSON.parse(text) as { format?: string; app?: string; name?: string; payload?: unknown };
    if (j.format !== 'practical-engineering-sheet' || j.app !== app || !j.payload) return null;
    return { name: String(j.name ?? 'Imported'), payload: j.payload };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// share by link: the sheet is compressed (deflate) and base64url-encoded into the URL hash

const b64url = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeSheet(payload: unknown): Promise<string> {
  return b64url(await pipe(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream('deflate-raw')));
}
export async function decodeSheet(code: string): Promise<unknown | null> {
  try {
    if (code.length > 200_000) return null;
    const raw = await pipe(unb64url(code), new DecompressionStream('deflate-raw'));
    if (raw.length > 5_000_000) return null;
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
}
