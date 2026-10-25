import { layoutNativeParagraph, nativeParagraphLines } from "../../tex/paragraphBox.js";
import { layoutNativeScopedParagraph } from "../../tikz/textMetrics.js";
import { resolvedFontStyle } from "./fontFamilies.js";
import { formatTextLine } from "./textLineContent.js";
import { textFontScale, textLineStyles, wrapStyledSvgTextLines } from "./textLayout.js";

const TEX_PT_PER_CM = 28.4527559;

export function nativeWrappedParagraphBox(item, normalized) {
  if (!(item.wrapWidth > 0) || item.fitBox || normalized.displayMathSequence ||
      (item.style?.textWidthScaleExplicit && Number(item.style.textWidthScale) !== 1)) return null;
  const lines = normalized.lines;
  if (!lines?.length) return null;
  const sizePt = 10 * (Number(normalized.scale) || 1) * textFontScale(item, normalized);
  const font = { ...item.font, sizePt };
  const scoped = layoutNativeScopedParagraph(normalized, font, item.wrapWidth * TEX_PT_PER_CM,
    item.textAlign, item.textWrapMode !== "flush");
  if (scoped) return scoped;
  if (item.textWrapMode !== "flush") return null;
  const styles = textLineStyles(normalized, lines.length, resolvedFontStyle(item));
  // Preserve unsupported font/color scopes through the existing renderer.
  // The native paragraph path currently accepts one inherited face and size.
  if (styles.some(style => style.scale !== 1 || style.fontSegments.some(run =>
    run.family || run.weight || run.style || run.variant || (run.scale && run.scale !== 1)))) return null;
  if ((!item.textAlign || item.textAlign === "justify") && lines.length === 1) {
    const broken = nativeParagraphLines(lines[0], font, item.wrapWidth * TEX_PT_PER_CM,
      { hyphenate: item.textWrapHyphenation });
    if (broken) return layoutNativeParagraph(broken, font, item.wrapWidth * TEX_PT_PER_CM);
  }
  const wrapped = wrapStyledSvgTextLines(lines, lines.map(formatTextLine), styles, item.wrapWidth,
    TEX_PT_PER_CM, sizePt, { lineBreakMode: item.textWrapMode, hyphenate: item.textWrapHyphenation });
  return layoutNativeParagraph(wrapped.contentLines, font, item.wrapWidth * TEX_PT_PER_CM,
    item.textAlign || "justify");
}
