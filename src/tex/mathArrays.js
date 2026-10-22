import { nativeMathFont } from "./mathFonts.js";

// amsmath's aligned uses an \ialign with \openup\jot; cases and matrices
// use LaTeX's \array struts. They share column measurement, not row spacing.
export function layoutMathArray(node, ctx, { build, append, empty, unsupported, dimension, axis }) {
  const aligned = node.colSeparationType === "align";
  const cases = node.arraystretch === 1.2 && node.cols?.length === 2
    && node.cols.every(col => col.align === "l") && node.cols[0].postgap === 1;
  if ((node.colSeparationType && !aligned) || (node.addJot && !aligned) || node.tags
      || node.hLinesBeforeRow?.some(row => row.length)
      || node.cols?.some(col => col.type !== "align" || !["l", "c", "r"].includes(col.align)
        || (!aligned && !cases && (col.pregap || col.postgap)))) return unsupported();

  let position = "c";
  if (aligned) {
    // KaTeX preserves amsmath's optional position as ordinary first-cell
    // tokens. Interpret it before measuring, including for nested aligned.
    const first = node.body[0]?.[0]?.body?.[0]?.body;
    if (first?.[0]?.text === "[" && /^[tbc]$/.test(first[1]?.text || "") && first[2]?.text === "]") {
      position = first[1].text;
      first.splice(0, 3);
    }
  }
  const rows = node.body.map(row => row.map(cell => build(cell, ctx)));
  const columns = Math.max(0, ...rows.map(row => row.length));
  const widths = Array.from({length:columns}, (_, c) => Math.max(0, ...rows.map(row => row[c]?.width || 0)));
  const strut = (node.arraystretch || 1) * ctx.baselineSkip;
  const metrics = rows.map((row, r) => {
    const height = Math.max(strut * 0.7, ...row.map(cell => cell.height));
    let depth = Math.max(strut * 0.3, ...row.map(cell => cell.depth));
    const extra = node.rowGaps?.[r] ? dimension(node.rowGaps[r], ctx) : 0;
    if (!aligned && extra > 0) depth = Math.max(depth, strut * 0.3 + extra);
    return { height, depth, extra: aligned ? extra : Math.min(0, extra) };
  });
  let total = 0;
  const baselines = metrics.map((row, r) => {
    if (r && aligned) {
      const glue = ctx.baselineSkip + 3 - metrics[r - 1].depth - row.height;
      total += glue < 3 - 1e-8 ? 4 : glue;
    }
    const baseline = total + row.height;
    total += row.height + row.depth + row.extra;
    return baseline;
  });
  const box = empty();
  box.height = position === "t" ? baselines[0] : position === "b" ? baselines.at(-1) : total / 2 + axis;
  box.depth = total - box.height;
  const quad = nativeMathFont("CMR", ctx.base).parameters.QUAD * ctx.base;
  const gap = c => aligned ? (c % 2 ? 10 : 0) : cases ? quad : 10;
  const inset = !aligned && node.hskipBeforeAndAfter ? 5 : 0;
  box.width = widths.reduce((sum, width, c) => sum + width + (c < columns - 1 ? gap(c) : 0), 2 * inset);
  rows.forEach((row, r) => {
    let x = inset;
    widths.forEach((width, c) => {
      const cell = row[c] || empty();
      const align = node.cols?.[c]?.align || "c";
      append(box, cell, x + (width - cell.width) * ({l:0,c:0.5,r:1})[align], baselines[r] - box.height);
      x += width + gap(c);
    });
  });
  return box;
}
