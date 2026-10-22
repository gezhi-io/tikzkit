import assert from "node:assert/strict";

export function nativeMathGroups(svg) {
  return [...svg.matchAll(/<g\b[^>]*data-math-layout="cm-tex-box"[^>]*>([\s\S]*?)<\/g>/g)].map(match => {
    const transform = match[0].match(/transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/);
    const glyphs = [...match[1].matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(glyph => {
      const attributes = Object.fromEntries([...glyph[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      return { text: glyph[2].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"),
        x: Number(attributes.x), y: Number(attributes.y), size: Number(attributes["font-size"]),
        family: attributes["font-family"], style: attributes["font-style"] };
    });
    return { x: Number(transform?.[1]), y: Number(transform?.[2]), scale: Number(transform?.[3]), glyphs,
      text: glyphs.map(g => g.text).join(""), rules: [...match[1].matchAll(/<rect\b[^>]*>/g)].length };
  });
}

export function assertNativeText(svg, text) {
  const group = nativeMathGroups(svg).find(group => group.text.includes(text));
  assert.ok(group, `Missing native math glyph sequence: ${text}`);
  assert.ok(group.glyphs.every(g => Number.isFinite(g.x) && Number.isFinite(g.y) && g.size > 0));
  return group;
}
