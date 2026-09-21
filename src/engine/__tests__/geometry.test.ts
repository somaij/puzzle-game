import { readFileSync } from 'fs';
import { join } from 'path';

import type { Cut, Edge } from '../cuts';
import { pathFor, PIECE_OFFSET, PIECE_SCALE, PIECE_VIEWBOX } from '../geometry';

// Pull the prototype's own knob/pathFor code out of the HTML, so the port is checked
// against the original rather than against a snapshot of itself.
function loadPrototypePathFor(): (cut: Cut) => string {
  const html = readFileSync(join(__dirname, '../../../docs/poc/pulse-puzzle.html'), 'utf8');
  const start = html.indexOf('const R=14');
  const end = html.indexOf('// blank shape only');
  if (start < 0 || end < 0) throw new Error('prototype geometry block not found');
  return new Function(`${html.slice(start, end)}; return pathFor;`)();
}

describe('pathFor', () => {
  const prototypePathFor = loadPrototypePathFor();
  const edges: Edge[] = [-1, 0, 1];

  it('draws the same outline as the prototype for all 81 edge combinations', () => {
    for (const t of edges) for (const r of edges) for (const b of edges) for (const l of edges) {
      const cut = { t, r, b, l };
      expect(pathFor(cut)).toBe(prototypePathFor(cut));
    }
  });

  it('draws a plain square when every edge is flat', () => {
    expect(pathFor({ t: 0, r: 0, b: 0, l: 0 })).toBe('M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z');
  });
});

describe('piece box', () => {
  it('pads the 100-unit cell by 18 on every side', () => {
    expect(PIECE_VIEWBOX).toBe('-18 -18 136 136');
    expect(PIECE_SCALE).toBeCloseTo(1.36);
    expect(PIECE_OFFSET).toBeCloseTo(0.18);
  });
});
