import { parseTikz } from "./frontend/index.js";
import { interpretTikz } from "./engine/index.js";
import { MathExpressionError, parseDimension } from "./engine/math.js";
import { ForeachExpansionError } from "./tikz/commands/foreach.js";
import { withAxisMathDiagnostics } from "./pgfplots/expressions.js";
import { computeSvgBounds, createSvgTextEngine, renderSvg } from "./renderers/svg/index.js";
import { createConversionResult, mergeDiagnostics } from "./shared/result.js";
import { TIKZ_UNIT } from "./tikz/metrics.js";

export { parseTikz } from "./frontend/index.js";
export { extractTikzCodeBlocks, splitTikzCodeBlocks } from "./frontend/code-blocks.js";
export { evaluateTikzAst, interpretTikz } from "./engine/index.js";
export { createPgfRandom, nextPgfRandomState, pgfRandomRandStep, pgfRandomRndStep } from "./engine/pgfRandom.js";
export { renderSvg } from "./renderers/svg/index.js";

export function tikzToSvg(source, options = {}) {
  try {
    return convertSynchronously(source, options);
  } catch (error) {
    return runtimeFailureResult(error);
  }
}

function convertSynchronously(source, options) {
  const conversionOptions = conversionRenderOptions(options);
  const parsed = parseForConversion(source, options);
  const interpreted = interpretTikz(parsed.ast, conversionOptions);
  applyGraphicxResizeboxTransform(parsed.ast, interpreted.ir, conversionOptions);
  const diagnostics = mergeDiagnostics(parsed.diagnostics, interpreted.diagnostics);
  const svg = renderSvg(interpreted.ir, conversionOptions);
  return createConversionResult({
    svg,
    diagnostics,
    ir: interpreted.ir,
    ast: parsed.ast
  });
}

export const convertTikzToSvg = tikzToSvg;

export async function tikzToSvgAsync(source, options = {}) {
  try {
    return await convertWithTextMeasurements(source, options);
  } catch (error) {
    return runtimeFailureResult(error);
  }
}

async function convertWithTextMeasurements(source, options) {
  const conversionOptions = conversionRenderOptions(options);
  const parsed = parseForConversion(source, options);
  let interpreted = interpretTikz(parsed.ast, conversionOptions);
  const maxTextEnginePasses = maxAsyncTextEnginePasses(options);
  let exhaustedTextEnginePasses = false;
  for (let pass = 0; pass < maxTextEnginePasses; pass += 1) {
    const flushed = await flushTextEngineMeasurements(conversionOptions.textEngine);
    if (flushed.length === 0) break;
    interpreted = interpretTikz(parsed.ast, conversionOptions);
    exhaustedTextEnginePasses = pass === maxTextEnginePasses - 1;
  }
  applyGraphicxResizeboxTransform(parsed.ast, interpreted.ir, conversionOptions);
  const diagnostics = mergeDiagnostics(
    parsed.diagnostics,
    interpreted.diagnostics,
    exhaustedTextEnginePasses ? [textEnginePassLimitDiagnostic(maxTextEnginePasses)] : []
  );
  const svg = renderSvg(interpreted.ir, conversionOptions);
  return createConversionResult({
    svg,
    diagnostics,
    ir: interpreted.ir,
    ast: parsed.ast
  });
}

export const convertTikzToSvgAsync = tikzToSvgAsync;

function runtimeFailureResult(error) {
  // Only expected, structured input failures cross this public boundary.
  // In particular, do not collect speculative frontend math probes globally.
  if (!(error instanceof MathExpressionError) && !(error instanceof ForeachExpansionError)) throw error;
  return createConversionResult({ diagnostics: [error.diagnostic] });
}

function parseForConversion(source, options) {
  const failures = new Map();
  const parsed = withAxisMathDiagnostics(
    (diagnostic) => failures.set(`${diagnostic.code}:${diagnostic.expression}`, diagnostic),
    () => parseTikz(source, options)
  );
  parsed.diagnostics.push(...failures.values());
  return parsed;
}

function applyGraphicxResizeboxTransform(ast, ir, options = {}) {
  const pictures = ast?.pictures || [];
  if (pictures.length !== 1) return false;
  const picture = pictures[0];
  const resize = picture?.graphicxResize;
  if (!resize || resize.applied || resize.starred) return false;

  const targetWidth = parseDimension(resize.width, {});
  const targetHeight = parseDimension(resize.height, {});
  if (!(targetWidth > 0) || !(targetHeight > 0)) return false;

  const bounds = computeSvgBounds(ir?.items || [], options);
  const naturalWidth = bounds.maxX - bounds.minX;
  const naturalHeight = bounds.maxY - bounds.minY;
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return false;

  const xscale = targetWidth / naturalWidth;
  const yscale = targetHeight / naturalHeight;
  if (!Number.isFinite(xscale) || !Number.isFinite(yscale)) return false;

  ir.graphicxResize = {
    xscale,
    yscale,
    bounds
  };
  resize.applied = true;
  return true;
}

function maxAsyncTextEnginePasses(options = {}) {
  const value = Number(options.maxTextEnginePasses ?? options.textEnginePasses);
  if (Number.isFinite(value) && value >= 0) return Math.floor(value);
  return 4;
}

function conversionRenderOptions(options = {}) {
  if (options.textEngine) return options;
  const unit = Number(options.unit) || TIKZ_UNIT;
  return {
    ...options,
    textEngine: createSvgTextEngine({ unit, mathRenderer: options.mathRenderer }),
    textEngineUnit: unit
  };
}

async function flushTextEngineMeasurements(textEngine) {
  if (!textEngine || typeof textEngine.flushPending !== "function") return [];
  try {
    const flushed = await textEngine.flushPending();
    return Array.isArray(flushed) ? flushed : [];
  } catch {
    return [];
  }
}

function textEnginePassLimitDiagnostic(maxPasses) {
  return {
    severity: "warning",
    code: "text-engine-pass-limit",
    message: `Text engine measurement did not settle after ${maxPasses} passes; SVG text or node bounds may use fallback metrics.`
  };
}
