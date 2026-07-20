import { parseTikz } from "./frontend/index.js";
import { interpretTikz } from "./engine/index.js";
import { createSvgTextEngine, renderSvg } from "./renderers/svg/index.js";
import { createConversionResult, mergeDiagnostics } from "./shared/result.js";
import { TIKZ_UNIT } from "./tikz/metrics.js";

export { parseTikz } from "./frontend/index.js";
export { evaluateTikzAst, interpretTikz } from "./engine/index.js";
export { renderSvg } from "./renderers/svg/index.js";

export function tikzToSvg(source, options = {}) {
  const conversionOptions = conversionRenderOptions(options);
  const parsed = parseTikz(source, options);
  const interpreted = interpretTikz(parsed.ast, conversionOptions);
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
  const conversionOptions = conversionRenderOptions(options);
  const parsed = parseTikz(source, options);
  let interpreted = interpretTikz(parsed.ast, conversionOptions);
  const maxTextEnginePasses = maxAsyncTextEnginePasses(options);
  let exhaustedTextEnginePasses = false;
  for (let pass = 0; pass < maxTextEnginePasses; pass += 1) {
    const flushed = await flushTextEngineMeasurements(conversionOptions.textEngine);
    if (flushed.length === 0) break;
    interpreted = interpretTikz(parsed.ast, conversionOptions);
    exhaustedTextEnginePasses = pass === maxTextEnginePasses - 1;
  }
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
