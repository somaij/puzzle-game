import { CELL, PAD, TAB_DEPTH } from './constants';
import type { Cut } from './cuts';

// Bezier handle length that makes each half of the knob a near-quarter-circle.
const HANDLE = TAB_DEPTH * 0.5523;

/** The SVG viewBox for one piece: its cell plus PAD on every side, so tabs fit. */
export const PIECE_VIEWBOX = `${-PAD} ${-PAD} ${CELL + 2 * PAD} ${CELL + 2 * PAD}`;
/** A piece's drawn box relative to its cell (1.36), and how far that box starts before the cell (0.18). */
export const PIECE_SCALE = (CELL + 2 * PAD) / CELL;
export const PIECE_OFFSET = PAD / CELL;

/**
 * One tab or notch on the edge from (ax,ay) to (bx,by). (ox,oy) is the outward direction;
 * a tab bulges that way, a notch the other way.
 */
function knob(ax: number, ay: number, bx: number, by: number, ox: number, oy: number, isTab: boolean): string {
  const nx = isTab ? ox : -ox;
  const ny = isTab ? oy : -oy;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const apx = mx + nx * TAB_DEPTH;
  const apy = my + ny * TAB_DEPTH;
  return (
    `C ${ax + nx * HANDLE} ${ay + ny * HANDLE} ${apx - ux * HANDLE} ${apy - uy * HANDLE} ${apx} ${apy} ` +
    `C ${apx + ux * HANDLE} ${apy + uy * HANDLE} ${bx + nx * HANDLE} ${by + ny * HANDLE} ${bx} ${by} `
  );
}

/** The outline of a piece in its 100×100 cell box, clockwise from the top-left corner. */
export function pathFor(cut: Cut): string {
  let d = 'M 0 0 ';
  d += cut.t === 0 ? 'L 100 0 ' : 'L 35 0 ' + knob(35, 0, 65, 0, 0, -1, cut.t > 0) + 'L 100 0 ';
  d += cut.r === 0 ? 'L 100 100 ' : 'L 100 35 ' + knob(100, 35, 100, 65, 1, 0, cut.r > 0) + 'L 100 100 ';
  d += cut.b === 0 ? 'L 0 100 ' : 'L 65 100 ' + knob(65, 100, 35, 100, 0, 1, cut.b > 0) + 'L 0 100 ';
  d += cut.l === 0 ? 'L 0 0 ' : 'L 0 65 ' + knob(0, 65, 0, 35, -1, 0, cut.l > 0) + 'L 0 0 ';
  return d + 'Z';
}
