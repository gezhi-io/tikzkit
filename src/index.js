export { parseTikz } from "./parser.js";
export { interpretTikz } from "./interpreter.js";
export { renderSvg } from "./renderer-svg.js";
export { extractTikzCodeBlocks, splitTikzCodeBlocks } from "./code-blocks.js";
export { BUILTIN_EXTENSIONS, applyPreprocessExtensions } from "./extensions/index.js";
export { tikzBaguaExtension } from "./extensions/tikz-bagua.js";
export { tikzBpmnExtension } from "./extensions/tikz-bpmn.js";
export { tikzNetworkExtension } from "./extensions/tikz-network.js";
export { tikzThreeDPlotExtension } from "./extensions/tikz-3dplot.js";

import { parseTikz } from "./parser.js";
import { interpretTikz } from "./interpreter.js";
import { renderSvg } from "./renderer-svg.js";

export function tikzToSvg(source, options = {}) {
  const parsed = parseTikz(source, options);
  const interpreted = interpretTikz(parsed.ast, options);
  const diagnostics = [...parsed.diagnostics, ...interpreted.diagnostics];
  const svg = renderSvg(interpreted.ir, options);
  return {
    svg,
    diagnostics,
    ir: interpreted.ir,
    ast: parsed.ast
  };
}
