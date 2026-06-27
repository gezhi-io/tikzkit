import { tikzLibrary as _3dLibrary } from "./3d.js";
import { tikzLibrary as anglesLibrary } from "./angles.js";
import { tikzLibrary as arrowsLibrary } from "./arrows.js";
import { tikzLibrary as arrowsMetaLibrary } from "./arrows.meta.js";
import { tikzLibrary as automataLibrary } from "./automata.js";
import { tikzLibrary as babelLibrary } from "./babel.js";
import { tikzLibrary as backgroundsLibrary } from "./backgrounds.js";
import { tikzLibrary as bayesnetLibrary } from "./bayesnet.js";
import { tikzLibrary as bendingLibrary } from "./bending.js";
import { tikzLibrary as bpmnLibrary } from "./bpmn.js";
import { tikzLibrary as calcLibrary } from "./calc.js";
import { tikzLibrary as calendarLibrary } from "./calendar.js";
import { tikzLibrary as chainsLibrary } from "./chains.js";
import { tikzLibrary as circuitsLibrary } from "./circuits.js";
import { tikzLibrary as circuitsEeIECLibrary } from "./circuits.ee.IEC.js";
import { tikzLibrary as circuitsPidLibrary } from "./circuits.pid.js";
import { tikzLibrary as circuitsPidISO14617Library } from "./circuits.pid.ISO14617.js";
import { tikzLibrary as decorationsLibrary } from "./decorations.js";
import { tikzLibrary as decorationsMarkingsLibrary } from "./decorations.markings.js";
import { tikzLibrary as decorationsPathmorphingLibrary } from "./decorations.pathmorphing.js";
import { tikzLibrary as decorationsPathreplacingLibrary } from "./decorations.pathreplacing.js";
import { tikzLibrary as decorationsTextLibrary } from "./decorations.text.js";
import { tikzLibrary as extPathsArctoLibrary } from "./ext.paths.arcto.js";
import { tikzLibrary as extPathsOrthoLibrary } from "./ext.paths.ortho.js";
import { tikzLibrary as extShapesCirclecrosssplitLibrary } from "./ext.shapes.circlecrosssplit.js";
import { tikzLibrary as extShapesSuperellipseLibrary } from "./ext.shapes.superellipse.js";
import { tikzLibrary as extTopathsArcthroughLibrary } from "./ext.topaths.arcthrough.js";
import { tikzLibrary as extTransformationsMirrorLibrary } from "./ext.transformations.mirror.js";
import { tikzLibrary as fadingsLibrary } from "./fadings.js";
import { tikzLibrary as fitLibrary } from "./fit.js";
import { tikzLibrary as foldingLibrary } from "./folding.js";
import { tikzLibrary as fpuLibrary } from "./fpu.js";
import { tikzLibrary as graphsLibrary } from "./graphs.js";
import { tikzLibrary as hobbyLibrary } from "./hobby.js";
import { tikzLibrary as intersectionsLibrary } from "./intersections.js";
import { tikzLibrary as matrixLibrary } from "./matrix.js";
import { tikzLibrary as mindmapLibrary } from "./mindmap.js";
import { tikzLibrary as patternsLibrary } from "./patterns.js";
import { tikzLibrary as petriLibrary } from "./petri.js";
import { tikzLibrary as plotmarksLibrary } from "./plotmarks.js";
import { tikzLibrary as positioningLibrary } from "./positioning.js";
import { tikzLibrary as quotesLibrary } from "./quotes.js";
import { tikzLibrary as scopesLibrary } from "./scopes.js";
import { tikzLibrary as shadingsLibrary } from "./shadings.js";
import { tikzLibrary as shadowsLibrary } from "./shadows.js";
import { tikzLibrary as shadowsBlurLibrary } from "./shadows.blur.js";
import { tikzLibrary as shapesLibrary } from "./shapes.js";
import { tikzLibrary as shapesArrowsLibrary } from "./shapes.arrows.js";
import { tikzLibrary as shapesGeometricLibrary } from "./shapes.geometric.js";
import { tikzLibrary as shapesMiscLibrary } from "./shapes.misc.js";
import { tikzLibrary as shapesMultipartLibrary } from "./shapes.multipart.js";
import { tikzLibrary as shapesSymbolsLibrary } from "./shapes.symbols.js";
import { tikzLibrary as snakesLibrary } from "./snakes.js";
import { tikzLibrary as splineLibrary } from "./spline.js";
import { tikzLibrary as spyLibrary } from "./spy.js";
import { tikzLibrary as throughLibrary } from "./through.js";
import { tikzLibrary as tikzmarkLibrary } from "./tikzmark.js";
import { tikzLibrary as tqftLibrary } from "./tqft.js";
import { tikzLibrary as treesLibrary } from "./trees.js";
import { tikzLibrary as unitcircleLibrary } from "./unitcircle.js";

const tikzLibraries = Object.freeze([
  _3dLibrary,
  anglesLibrary,
  arrowsLibrary,
  arrowsMetaLibrary,
  automataLibrary,
  babelLibrary,
  backgroundsLibrary,
  bayesnetLibrary,
  bendingLibrary,
  bpmnLibrary,
  calcLibrary,
  calendarLibrary,
  chainsLibrary,
  circuitsLibrary,
  circuitsEeIECLibrary,
  circuitsPidLibrary,
  circuitsPidISO14617Library,
  decorationsLibrary,
  decorationsMarkingsLibrary,
  decorationsPathmorphingLibrary,
  decorationsPathreplacingLibrary,
  decorationsTextLibrary,
  extPathsArctoLibrary,
  extPathsOrthoLibrary,
  extShapesCirclecrosssplitLibrary,
  extShapesSuperellipseLibrary,
  extTopathsArcthroughLibrary,
  extTransformationsMirrorLibrary,
  fadingsLibrary,
  fitLibrary,
  foldingLibrary,
  fpuLibrary,
  graphsLibrary,
  hobbyLibrary,
  intersectionsLibrary,
  matrixLibrary,
  mindmapLibrary,
  patternsLibrary,
  petriLibrary,
  plotmarksLibrary,
  positioningLibrary,
  quotesLibrary,
  scopesLibrary,
  shadingsLibrary,
  shadowsLibrary,
  shadowsBlurLibrary,
  shapesLibrary,
  shapesArrowsLibrary,
  shapesGeometricLibrary,
  shapesMiscLibrary,
  shapesMultipartLibrary,
  shapesSymbolsLibrary,
  snakesLibrary,
  splineLibrary,
  spyLibrary,
  throughLibrary,
  tikzmarkLibrary,
  tqftLibrary,
  treesLibrary,
  unitcircleLibrary
].map(normalizeTikzLibrary));

export const tikzLibraryCatalog = Object.freeze(
  Object.fromEntries(tikzLibraries.map((library) => [library.name, library]))
);

export const knownTikzLibraries = Object.freeze(tikzLibraries.map((library) => library.name));
export const builtinTikzLibraries = knownTikzLibraries;
export const supportedTikzLibraries = Object.freeze(
  tikzLibraries.filter((library) => library.status !== "unsupported").map((library) => library.name)
);

export { tikzLibrary as calcLibrary } from "./calc.js";
export { tikzLibrary as positioningLibrary } from "./positioning.js";
export { tikzLibrary as matrixLibrary } from "./matrix.js";

function normalizeTikzLibrary(library) {
  const features = library.features || library.implements || [];
  return Object.freeze({
    ...library,
    features: Object.freeze([...features]),
    implements: Object.freeze([...(library.implements || features)])
  });
}
