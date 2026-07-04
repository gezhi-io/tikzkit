export { parseTikz } from "./frontend/parser.js";
export { evaluateTikzAst, interpretTikz } from "./engine/evaluate.js";
export { renderSvg } from "./renderers/svg/renderSvg.js";
export { appendSceneItem, createSceneGraph, sceneItems } from "./scene/index.js";
export {
  axisModelToSceneGraphPlan,
  axisTickValues,
  createAddplotModel,
  createAxisGeometry,
  createAxisGridModel,
  createAxisModel,
  createAxisTickModel,
  createDataToCanvasTransform,
  parseCoordinateAddplot,
  parseAxisAt,
  parseAxisDimension,
  parseCoordinateList as parsePgfplotsCoordinateList,
  PGFPLOTS_DEFAULT_AXIS_WIDTH,
  renderAxisBounds,
  renderAxisBox,
  renderAxisGrid,
  renderAxisLabels,
  renderAxisLines,
  renderAxisTicks,
  renderDatavisualizationCleanAxes,
  shouldRenderAxisLines,
  transformDataToCanvas
} from "./pgfplots/index.js";
export { createTikzRegistry, registerCoreTikz } from "./tikz/registerCoreTikz.js";
export { createConversionResult, mergeDiagnostics } from "./shared/result.js";
export { extractTikzCodeBlocks, splitTikzCodeBlocks } from "./code-blocks.js";
export { BUILTIN_TIKZ_LIBRARIES, collectTikzLibraries, resolveTikzLibraries } from "./tikz-libraries.js";
export {
  builtinTikzLibraries,
  knownTikzLibraries,
  supportedTikzLibraries,
  tikzLibraryCatalog,
  calcLibrary,
  matrixLibrary,
  positioningLibrary
} from "./libraries/index.js";
export {
  knownTexPackages,
  mathtoolsPackage,
  pgfplotsPackage,
  supportedTexPackages,
  texPackageCatalog,
  tikzPackage,
  xcolorPackage
} from "./packages/index.js";
export {
  addplotCommand,
  axisCommand,
  coordinateCommand,
  drawCommand,
  fillCommand,
  foreachCommand,
  knownTikzCommands,
  nodeCommand,
  pathCommand,
  supportedTikzCommands,
  tikzCommandCatalog,
  tikzpictureCommand
} from "./commands/index.js";
export { collectTexPackages, resolveTexPackage, resolveTexPackages } from "./tex-packages.js";
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
export { forestExtension } from "./extensions/forest.js";
export { neuralNetworkExtension } from "./extensions/neuralnetwork.js";
export { stanliExtension } from "./extensions/stanli.js";

import { parseTikz } from "./frontend/parser.js";
import { interpretTikz } from "./engine/evaluate.js";
import { renderSvg } from "./renderers/svg/renderSvg.js";
import { createConversionResult, mergeDiagnostics } from "./shared/result.js";

export function tikzToSvg(source, options = {}) {
  const parsed = parseTikz(source, options);
  const interpreted = interpretTikz(parsed.ast, options);
  const diagnostics = mergeDiagnostics(parsed.diagnostics, interpreted.diagnostics);
  const svg = renderSvg(interpreted.ir, options);
  return createConversionResult({
    svg,
    diagnostics,
    ir: interpreted.ir,
    ast: parsed.ast
  });
}

export const convertTikzToSvg = tikzToSvg;
