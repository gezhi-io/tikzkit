export { parseTikz } from "./parser.js";
export { interpretTikz } from "./interpreter.js";
export { renderSvg } from "./renderer-svg.js";
export { extractTikzCodeBlocks, splitTikzCodeBlocks } from "./code-blocks.js";
export { BUILTIN_TIKZ_LIBRARIES, collectTikzLibraries, resolveTikzLibraries } from "./tikz-libraries.js";
export { BUILTIN_EXTENSIONS, applyPreprocessExtensions } from "./extensions/index.js";
export { tikzBaguaExtension } from "./extensions/tikz-bagua.js";
export { tikzBayesnetExtension } from "./extensions/tikz-bayesnet.js";
export { tikzBpmnExtension } from "./extensions/tikz-bpmn.js";
export { tikzCdExtension } from "./extensions/tikz-cd.js";
export { tikzCnnExtension } from "./extensions/tikz-cnn.js";
export { tikzDecofontsExtension } from "./extensions/tikz-decofonts.js";
export { tikzDimlineExtension } from "./extensions/tikz-dimline.js";
export { tikzExtExtension } from "./extensions/tikz-ext.js";
export { tikzFeynhandExtension } from "./extensions/tikz-feynhand.js";
export { tikzFeynmanExtension } from "./extensions/tikz-feynman.js";
export { tikzfxgraphExtension } from "./extensions/tikzfxgraph.js";
export { tikzNetworkExtension } from "./extensions/tikz-network.js";
export { tikzPalatticeExtension } from "./extensions/tikz-palattice.js";
export { tikzQtreeExtension } from "./extensions/tikz-qtree.js";
export { tikzquadsExtension } from "./extensions/tikzquads.js";
export { tikzThreeDPlotExtension } from "./extensions/tikz-3dplot.js";
export { stanliExtension } from "./extensions/stanli.js";

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
