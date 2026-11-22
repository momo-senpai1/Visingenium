import { describe, expect, it } from 'vitest';
import shared from '@/examples/control-sim/position-lead.json';
import { checkSheet, circuitSheet, simSheet } from '../sheetSchemas';
import { SIM_EXAMPLES } from '../controlSimStore';

describe('sheet validation', () => {
  it('accepts the built-in and shared control examples', () => {
    for (const ex of Object.values(SIM_EXAMPLES)) expect(checkSheet(simSheet, { nodes: ex.nodes, edges: ex.edges, settings: ex.settings })).not.toBeNull();
    expect(checkSheet(simSheet, shared.payload)).not.toBeNull();
  });
  it('rejects broken or manipulated files', () => {
    expect(checkSheet(simSheet, null)).toBeNull();
    expect(checkSheet(simSheet, { nodes: 'x', edges: [] })).toBeNull();
    expect(checkSheet(simSheet, { nodes: [{ id: 'a', type: 'cblock', position: { x: 0, y: 0 }, data: { kind: 'evil', name: 'a' } }], edges: [] })).toBeNull();
    expect(checkSheet(simSheet, { nodes: [{ id: 'a', type: 'cblock', position: { x: NaN, y: 0 }, data: { kind: 'gain', name: 'a' } }], edges: [] })).toBeNull();
    expect(checkSheet(simSheet, { nodes: [{ id: 'a', type: 'cblock', position: { x: 0, y: 0 }, data: { kind: 'sum', name: 'a', signs: '+-*' } }], edges: [] })).toBeNull();
    expect(checkSheet(circuitSheet, { nodes: [{ id: 'c', type: 'ccomp', position: { x: 0, y: 0 }, data: { kind: 'resistor', name: 'R1', params: {}, rot: 45 } }], edges: [] })).toBeNull();
  });
  it('drops wires to missing blocks', () => {
    const s = checkSheet(simSheet, { nodes: [{ id: 'a', type: 'cblock', position: { x: 0, y: 0 }, data: { kind: 'gain', name: 'K' } }], edges: [{ id: 'w', source: 'a', target: 'zz', targetHandle: 'in0' }] });
    expect(s!.edges).toHaveLength(0);
  });
  it('accepts a circuit sheet', () => {
    const s = checkSheet(circuitSheet, {
      nodes: [{ id: 'c', type: 'ccomp', position: { x: 0, y: 0 }, data: { kind: 'resistor', name: 'R1', params: { R: 1000 }, rot: 90 } }],
      edges: [],
      analysis: { mode: 'dc', tEnd: 1, steps: 100, fromDC: true },
    });
    expect(s).not.toBeNull();
  });
});

describe('share link encoding', () => {
  it('round-trips a sheet and stays short', async () => {
    const { encodeSheet, decodeSheet } = await import('../sheetsStore');
    const ex = SIM_EXAMPLES.cascade!;
    const payload = { nodes: ex.nodes, edges: ex.edges, settings: ex.settings };
    const code = await encodeSheet(payload);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(JSON.stringify(payload).length / 2);
    expect(await decodeSheet(code)).toEqual(JSON.parse(JSON.stringify(payload)));
    expect(await decodeSheet('not-valid!!')).toBeNull();
  });
});
