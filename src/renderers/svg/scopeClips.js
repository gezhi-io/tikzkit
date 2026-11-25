import { svgDefinitionId } from "./definitionScope.js";
import { escapeAttribute } from "./escape.js";
import { svgPathData } from "./pathData.js";

const clipId = (index, context) => svgDefinitionId(`scope-clip-${index}`, context);

export function indexScopeClips(items) {
  const indices = new Map();
  for (const item of items) {
    for (const clip of item.scopeClips || []) {
      if (!indices.has(clip)) indices.set(clip, indices.size);
    }
  }
  return indices;
}

export function renderPathClipDef(id, commands, fillRule, unit) {
  const rule = fillRule ? ` clip-rule="${escapeAttribute(fillRule)}"` : "";
  return `<clipPath id="${escapeAttribute(id)}" clipPathUnits="userSpaceOnUse"><path d="${svgPathData(commands, unit)}"${rule} /></clipPath>`;
}

export function renderScopeClipDefs(indices, context, unit) {
  return Array.from(indices, ([clip, index]) =>
    renderPathClipDef(clipId(index, context), clip.commands, clip.fillRule, unit));
}

export function renderWithScopeClips(items, indices, renderItem) {
  const fragments = [];
  let open = [];
  for (const [i, item] of items.entries()) {
    const content = renderItem(item, i);
    if (!content) continue;
    const next = item.scopeClips || [];
    // Nest successive regions (intersection); multiple children inside one
    // SVG clipPath would mean union. Neighbouring paint shares the open groups.
    let common = 0;
    while (common < open.length && open[common] === next[common]) common++;
    if (open.length > common) fragments.push("</g>".repeat(open.length - common));
    for (let j = common; j < next.length; j++) {
      const id = clipId(indices.get(next[j]), item);
      fragments.push(`<g clip-path="url(#${escapeAttribute(id)})">`);
    }
    fragments.push(content);
    open = next;
  }
  if (open.length) fragments.push("</g>".repeat(open.length));
  return fragments.join("");
}
