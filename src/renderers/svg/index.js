export { renderSvg } from "./renderSvg.js";
export { computeSvgBounds, includeTextRenderBounds } from "./bounds.js";
export {
  blurShadowFilterId,
  collectAxisGradientDefs,
  collectBallGradientDefs,
  collectBlurShadowDefs,
  collectPathFadingDefs,
  collectPatternDefs,
  collectRadialGradientDefs,
  collectSvgDefs,
  createSvgDefs,
  renderAxisGradientDef,
  renderBallGradientDef,
  renderBlurShadowFilterDef,
  renderPathFadingDefs,
  renderPatternDef,
  renderRadialGradientDef
} from "./defs.js";
export { renderBpmnIcon, renderBpmnMarker } from "./bpmnNodes.js";
export { isCircuitikzNodeShape, renderCircuitikzNodeBox } from "./circuitikzNodes.js";
export { createSvgView, renderSvgBackground, renderSvgDocument, svgViewBox } from "./document.js";
export { escapeAttribute, escapeHtml, escapeText } from "./escape.js";
export { formatSvgNumber } from "./format.js";
export { imagePlaceholderScale, renderImagePlaceholder } from "./imagePlaceholders.js";
export {
  renderUnitScale,
  scaleItemForRenderUnit,
  scaleItemsForRenderUnit,
  scaleNumeric,
  scaleStyleForRenderUnit,
  textFontSizeForUnit
} from "./layout.js";
export { arrowMarkerId, collectArrowMarkerDefs, renderArrowMarkerDef, renderMarker, resolvedArrowMarker } from "./markers.js";
export {
  hasWholeMathBoldCommand,
  isAccentMathAtom,
  mathAtomCommandTakesGroup,
  mathFallbackFontStyle,
  mathFallbackFontWeight,
  mathScriptFallbackText,
  normalizeKatexTex,
  readBalancedGroup,
  readBalancedParenthesis,
  readMathScriptAtom,
  readMathScriptValue,
  skipInlineWhitespace
} from "./mathFallbackSyntax.js";
export {
  extensibleMathArrowFallback,
  renderExtensibleMathArrowFallback
} from "./mathArrowFallback.js";
export {
  estimateMathBox,
  measureMathBoxPt,
  mathStyleScale,
  renderMathNode,
  scopedMathForeignObjectBox,
  scopedMathHostFontSize
} from "./mathNode.js";
export {
  coloredMathTextFallback,
  readStatefulColorCommand,
  readTextColorCommand,
  renderColoredMathTextFallback,
  renderSvgMathColorSegmentsContent,
  statefulColorMathTextFallback
} from "./mathColorFallback.js";
export {
  fractionTextWidth,
  inlineFractionFallback,
  renderFractionMathFallback,
  renderFractionPartContent,
  renderInlineFractionMathFallback,
  simpleFractionFallback
} from "./mathFractionFallback.js";
export {
  compactSumLimitScriptOperators,
  readMathScriptArgument,
  renderSumLimitPartContent,
  renderSumLimitsContentFallback,
  renderSumLimitsInlineFallback,
  renderSumSideScriptsContentFallback,
  sumLimitsInlineFallback,
  sumLimitsPartWidth
} from "./mathSumFallback.js";
export {
  hatAccentSubscriptFallback,
  leadingScriptFallback,
  mathFallbackSegmentText,
  mixedAlphabeticSubscriptFallback,
  renderHatSubscriptMathFallback,
  renderLeadingScriptContent,
  renderMathBaseText,
  renderMathTextWithUprightOperators,
  renderMixedSubscriptContent,
  renderMixedSubscriptMathFallback,
  renderNestedScriptText,
  renderScriptedMathFallback,
  renderScriptedSegmentsContent,
  renderSimpleSubscriptContent,
  renderSimpleSubscriptMathFallback,
  scriptedMathFallback,
  scriptedMathFallbackTextLength,
  simpleNumericSubscriptFallback,
  styledScriptedMathFallback,
  texNeedsOperatorSpacing
} from "./mathScriptFallback.js";
export {
  curlyDelimiterPath,
  findSvgMatrixEnvironmentEnd,
  inlineMathTextWidth,
  inlineMatrixMathFallback,
  matchSvgMatrixEnvToken,
  renderInlineMatrixDelimiters,
  renderInlineMatrixMathFallback,
  splitSvgMatrixTopLevel
} from "./mathMatrixFallback.js";
export { renderScopedMathHtml, renderScopedMathStyleDef } from "./mathHtml.js";
export { scopeMathHtml, scopedMathClassName, TIKZKIT_SCOPED_MATH_CSS } from "./mathScopedCss.js";
export {
  LIBRARY_NODE_SHAPES,
  arrowNodePoints,
  closedPolygonCommands,
  diamondNodePolygonPoints,
  isoscelesTriangleNodePoints,
  nodeShapeCommands,
  rectangleNodePoints,
  regularPolygonNodePoints,
  renderCircleCrossSplitNodeBox,
  renderCylinderNodeBox,
  renderDiamondNodeBox,
  renderLibraryShapeNodeBox,
  rotatePoint,
  starNodePoints,
  superellipseNodeCommands,
  trapeziumNodePoints
} from "./nodeShapes.js";
export {
  renderDoubleNodeOutline,
  renderNodeBoxOverlay,
  renderNodeBoxShadow,
  renderNodeBoxShadows,
  renderNodeBoxWithOverlay,
  renderPathPictureOverlay
} from "./nodeOverlays.js";
export {
  doubleStrokeStyles,
  inlineArrowGeometry,
  pathTerminalSegments,
  renderArrowedPath,
  renderCompactDashedDoublePath,
  renderDoublePath,
  renderInlineArrowTip,
  renderPathElement,
  resolveInlineArrowTip,
  shortenPathTerminals,
  svgAngle,
  usesCompactDashedDoubleStroke,
  usesCustomArrowDimension
} from "./paths.js";
export { svgPathData } from "./pathData.js";
export { estimatePlainTextRenderBounds, renderPlainTextNode } from "./plainTextNode.js";
export { isRectangleSplitNodeShape, renderRectangleSplitNodeBox } from "./rectangleSplitNodes.js";
export { renderEllipseSplitNodeBox } from "./ellipseSplitNodes.js";
export {
  cleanRichTextSource,
  defaultTexCharWidthEm,
  estimateRichMathWidthEm,
  estimateRichTextBox,
  estimateRichTextWidthEm,
  KATEX_RICH_TEXT_FONT_SCALE,
  KATEX_RICH_TEXT_LINE_BOX_SCALE,
  KATEX_RICH_TEXT_WRAP_WIDTH_SCALE,
  normalizeRichWrappedLineSpacing,
  renderInlineMathHtml,
  richTextFallbackItem,
  richTextSourceLines,
  richTextWrapTokens,
  TEX_SPACE_WIDTH_EM,
  wrapRichTextLine,
  wrapRichTextLines,
  wrapRichTextTokensBalanced
} from "./richText.js";
export { estimateRichTextRenderBounds, fitRichFontSizeToBox, renderRichTextNode } from "./richTextNode.js";
export {
  hasTextColorSegments,
  inlineBoxRects,
  parseTextColorSegments,
  renderFlatSegmentedTextLine,
  renderSegmentedTextNode,
  splitTextLines
} from "./segmentedText.js";
export {
  axisGradientId,
  ballGradientId,
  mixPaint,
  pathFadingGradientId,
  pathFadingMaskId,
  pathFadingName,
  patternId,
  patternPathData,
  radialGradientId,
  styleAttributes,
  svgPaint
} from "./style.js";
export { formatPlainTexText, renderPlainSvgTextContent, renderSvgText } from "./text.js";
export { createSvgTextEngine } from "./textEngine.js";
export {
  formatTextLine,
  hasInlineMath,
  renderInlineSvgMathContent,
  renderSvgMathFallbackContent,
  renderSvgMathFallbackContentWithoutColor,
  renderSvgTextLineContent
} from "./textLineContent.js";
export { fitFontSizeToBox } from "./textFit.js";
export { applyTextContour, readContourColor } from "./textContour.js";
export {
  alignedTextX,
  baselineOffsets,
  collapseTeXParagraphWhitespace,
  fontStyleAttribute,
  fontVariantAttribute,
  fontWeightAttribute,
  hasInlineMathSource,
  lineBaselineGap,
  lineFontAttributes,
  mathLineFontStyleAttribute,
  mathOnlySourceLineTex,
  normalizedTextAlign,
  SVG_TEXT_WRAP_CHAR_WIDTH_EM,
  svgTextAnchorForItem,
  svgTextAnchorPoint,
  svgTextAnchorX,
  svgTextWrapTokens,
  textAnchorForAlign,
  textFontScale,
  textWidthScale,
  textLineStyles,
  typewriterWidthScale,
  wrapTypewriterWidth,
  wrapStyledSvgTextLines,
  wrapSvgTextLine,
  wrapSvgTextLines,
  wrapSvgTextLineWithSource,
  wrapSvgTextTokensBalanced
} from "./textLayout.js";
export {
  parseSmallMatrixBody,
  readTensorMatrixMacro,
  renderTensorMatrixBlock,
  renderTensorMatrixFallback,
  squareBracketPath,
  tensorBracePath,
  tensorMatrixColor,
  tensorMatrixFallbackParts,
  tensorMatrixLabelText
} from "./tensorMatrixFallback.js";
export { isTikzquadsNodeShape, renderTikzquadsNodeBox, TIKZQUADS_NODE_SHAPES } from "./tikzquadsNodes.js";
export { wrapNodeRotation } from "./transforms.js";
