import { axisNumber } from "./coordinates.js";
import { evaluateAxisExpression } from "./expressions.js";
import { formatAxisNumber, formatAxisPoint } from "./format.js";
import { plotColorValue, selectPlotColor, isPlotColorToken } from "./plotStyle.js";
import { axisSamples, parseDomain, parseZRestriction, restrictSurfaceZ, sampleParametricSurfaceGrid } from "./rangeResolver.js";
import { parsePgfplotsColormaps } from "./axisOptions.js";
import { isPgfplotsTopView, pgfplotsViewDirection } from "./geometry.js";
import { colorToRgb, normalizeColor } from "../engine/options.js";
import { encodeRgbaPngDataUri } from "./rasterPng.js";

export function isAxisTrianglePatchPlot(plot, axisOptions = {}) {
  return axisLinearPatchType(plot, axisOptions) === "triangle";
}

export function renderAxisTrianglePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex = 0) {
  return renderAxisLinearPatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
}

export function isAxisRectanglePatchPlot(plot, axisOptions = {}) {
  return axisLinearPatchType(plot, axisOptions) === "rectangle";
}

export function renderAxisRectanglePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex = 0) {
  return renderAxisLinearPatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
}

export function isAxisLinePatchPlot(plot, axisOptions = {}) {
  return axisLinearPatchType(plot, axisOptions) === "line";
}

export function renderAxisLinePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex = 0) {
  return renderAxisLinearPatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
}

function axisLinearPatchType(plot, axisOptions = {}) {
  if (!plot?.is3d) return "";
  const options = plot.options || {};
  if (!options.patch && !axisOptions.patch) return "";
  const type = String(options["patch type"] ?? axisOptions["patch type"] ?? "").trim().toLowerCase();
  return type === "line" || type === "triangle" || type === "rectangle" ? type : "";
}

function renderAxisLinearPatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex = 0) {
  const patchType = axisLinearPatchType(plot, axisOptions);
  const verticesPerPatch = patchType === "line" ? 2 : patchType === "rectangle" ? 4 : 3;
  const points = plot.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  const patches = [];
  for (let index = 0; index + verticesPerPatch - 1 < points.length; index += verticesPerPatch) {
    // PGFPlots' linear patch classes consume vertex streams directly. In
    // particular, a rectangle is A -> B -> C -> D, not a coordinate grid.
    const patch = surfacePatchFromCorners(points.slice(index, index + verticesPerPatch), ranges, axisOptions);
    if (patch) patches.push(patch);
  }
  if (!patches.length) return [];

  const colorRanges = surfaceColorRanges(ranges, [points], axisOptions, plot.options);
  const zBuffer = String(plot.options["z buffer"] ?? axisOptions["z buffer"] ?? "sort").trim().toLowerCase();
  const orderedPatches = zBuffer === "none" ? patches : [...patches].sort((left, right) => left.depth - right.depth);
  const opacity = axisOpacity(plot.options.opacity ?? axisOptions.opacity ?? 1);
  if (patchType === "line") {
    const lineWidth = pgfplotsSurfacePatchLineWidth(plot.options);
    return orderedPatches.map((patch) => {
      const mappedColor = pgfplotsLinearPatchMappedColor(
        surfacePatchColorValue(patch),
        colorRanges,
        plot.options,
        axisOptions,
        plotIndex
      );
      const pointsText = patch.corners.map((corner) => formatAxisPoint(geometry.mapPoint3d(corner))).join(" -- ");
      return `\\draw[axis surface mesh, draw=${mappedColor}, fill=none, opacity=${opacity}, line width=${lineWidth}] ${pointsText};`;
    });
  }
  return renderAxisSurfacePatchLayerCommands(orderedPatches.map((patch) => {
    const fill = pgfplotsSurfacePatchColor(plot.options, surfacePatchColorValue(patch), colorRanges, plotIndex, axisOptions);
    // PGFPlots' linear patch handler uses its faceted mesh color even when
    // the plot also provides a generic draw key. This matches the native
    // triangle patch's separate orange fill and darker mesh outline.
    const mappedColor = pgfplotsLinearPatchMappedColor(
      surfacePatchColorValue(patch),
      colorRanges,
      plot.options,
      axisOptions,
      plotIndex
    );
    const draw = pgfplotsSurfacePatchStrokeColor({ ...plot.options, surf: true }, mappedColor);
    const lineWidth = pgfplotsSurfacePatchLineWidth(plot.options);
    const pointsText = patch.corners.map((corner) => formatAxisPoint(geometry.mapPoint3d(corner))).join(" -- ");
    return renderAxisSurfacePatchLayers(pointsText, { fill, draw, opacity, lineWidth });
  }));
}

export function renderAxisSurfaceCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex = 0) {
  const points = plot.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  const coordinateRows = finiteSurfaceCoordinateRows(plot.coordinateRows);
  const steppedCells = steppedSurfaceCellsFromCoordinateRows(coordinateRows);
  let rowsForColor = null;
  let patches = null;
  if (steppedCells.length > 0 && !hasExplicitSurfaceMeshDimensions(plot.options, axisOptions)) {
    rowsForColor = [steppedCells.map((cell) => ({ x: cell.x0, y: cell.y0, z: cell.z }))];
    patches = cuboidSurfacePatches(steppedCells, ranges, axisOptions);
  } else if (shouldUseRaggedCoordinateRows(coordinateRows, plot.options, axisOptions)) {
    rowsForColor = coordinateRows;
    patches = coordinateRowStripPatches(coordinateRows, ranges, axisOptions);
  } else {
    const grid = inferSurfaceCoordinateGrid(points, plot.options, axisOptions, plot.coordinateRows);
    if (grid) {
      rowsForColor = grid.points;
      patches = coordinateGridPatches(grid.points, ranges, axisOptions);
    }
  }
  if (!patches?.length) return [];
  if (isAxisMeshWireframe(plot.options, axisOptions)) {
    return renderAxisMeshWireframePatches(patches, plot.options, axisOptions, geometry, plotIndex);
  }
  const colorRanges = surfaceColorRanges(ranges, rowsForColor, axisOptions, plot.options);
  patches.sort(steppedCells.length > 0 ? (a, b) => b.depth - a.depth : (a, b) => a.depth - b.depth);
  const opacity = axisOpacity(plot.options.opacity ?? axisOptions.opacity ?? 1);
  return renderAxisSurfacePatchLayerCommands(patches.map((patch) => {
    const fill = pgfplotsSurfacePatchColor(plot.options, surfacePatchColorValue(patch), colorRanges, plotIndex, axisOptions);
    const draw = pgfplotsSurfacePatchStrokeColor(plot.options, fill);
    const lineWidth = pgfplotsSurfacePatchLineWidth(plot.options);
    const pointsText = patch.corners.map((corner) => formatAxisPoint(geometry.mapPoint3d(corner))).join(" -- ");
    return renderAxisSurfacePatchLayers(pointsText, { fill, draw, opacity, lineWidth });
  }));
}

function coordinateGridPatches(rows, ranges, axisOptions) {
  const patches = [];
  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    for (let colIndex = 0; colIndex < rows[rowIndex].length - 1; colIndex += 1) {
      const corners = [
        rows[rowIndex][colIndex],
        rows[rowIndex][colIndex + 1],
        rows[rowIndex + 1][colIndex + 1],
        rows[rowIndex + 1][colIndex]
      ];
      const patch = surfacePatchFromCorners(corners, ranges, axisOptions);
      if (patch) patches.push(patch);
    }
  }
  return patches;
}

function coordinateRowStripPatches(rows, ranges, axisOptions) {
  const patches = [];
  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const current = rows[rowIndex];
    const next = rows[rowIndex + 1];
    const count = Math.min(current.length, next.length);
    for (let colIndex = 0; colIndex < count - 1; colIndex += 1) {
      const corners = [current[colIndex], current[colIndex + 1], next[colIndex + 1], next[colIndex]];
      const patch = surfacePatchFromCorners(corners, ranges, axisOptions);
      if (patch) patches.push(patch);
    }
  }
  return patches;
}

function cuboidSurfacePatches(cells, ranges, axisOptions) {
  const patches = [];
  for (const cell of cells) {
    const { x0, x1, y0, y1, z } = cell;
    const faces = [
      [
        { x: x0, y: y0, z },
        { x: x1, y: y0, z },
        { x: x1, y: y1, z },
        { x: x0, y: y1, z }
      ]
    ];
    faces.push(...cuboidExposedSideFaces(cell, cells));
    for (const face of faces) {
      const patch = surfacePatchFromCorners(face, ranges, axisOptions);
      if (patch) patches.push(patch);
    }
  }
  return patches;
}

function cuboidExposedSideFaces(cell, cells) {
  return [
    ...cuboidSideFaces(cell, cells, "yMin"),
    ...cuboidSideFaces(cell, cells, "xMax"),
    ...cuboidSideFaces(cell, cells, "yMax"),
    ...cuboidSideFaces(cell, cells, "xMin")
  ];
}

function cuboidSideFaces(cell, cells, side) {
  const interval = cuboidSideInterval(cell, side);
  const neighbors = cuboidSideNeighbors(cell, cells, side);
  const cuts = uniqueSortedAxisValues([
    interval.min,
    interval.max,
    ...neighbors.flatMap((neighbor) => [Math.max(interval.min, neighbor.min), Math.min(interval.max, neighbor.max)])
  ]);
  const faces = [];
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const start = cuts[index];
    const end = cuts[index + 1];
    if (end - start <= 1e-9) continue;
    const middle = (start + end) / 2;
    const floorZ = Math.max(0, ...neighbors.filter((neighbor) => neighbor.min < middle && middle < neighbor.max).map((neighbor) => neighbor.z));
    if (floorZ >= cell.z - 1e-9) continue;
    faces.push(cuboidSideFace(cell, side, start, end, floorZ));
  }
  return faces;
}

function cuboidSideInterval(cell, side) {
  if (side === "xMin" || side === "xMax") return { min: cell.y0, max: cell.y1 };
  return { min: cell.x0, max: cell.x1 };
}

function cuboidSideNeighbors(cell, cells, side) {
  return cells
    .filter((candidate) => candidate !== cell && cuboidSharesSide(cell, candidate, side))
    .map((candidate) => ({
      ...cuboidSideInterval(candidate, side),
      z: candidate.z
    }))
    .filter((neighbor) => neighbor.max > cuboidSideInterval(cell, side).min + 1e-9 && neighbor.min < cuboidSideInterval(cell, side).max - 1e-9);
}

function cuboidSharesSide(cell, candidate, side) {
  if (side === "yMin") return sameAxisValue(candidate.y1, cell.y0);
  if (side === "yMax") return sameAxisValue(candidate.y0, cell.y1);
  if (side === "xMin") return sameAxisValue(candidate.x1, cell.x0);
  if (side === "xMax") return sameAxisValue(candidate.x0, cell.x1);
  return false;
}

function cuboidSideFace(cell, side, start, end, floorZ) {
  const { x0, x1, y0, y1, z } = cell;
  if (side === "yMin") {
    return [
      { x: start, y: y0, z: floorZ },
      { x: end, y: y0, z: floorZ },
      { x: end, y: y0, z },
      { x: start, y: y0, z }
    ];
  }
  if (side === "yMax") {
    return [
      { x: start, y: y1, z: floorZ },
      { x: end, y: y1, z: floorZ },
      { x: end, y: y1, z },
      { x: start, y: y1, z }
    ];
  }
  if (side === "xMax") {
    return [
      { x: x1, y: start, z: floorZ },
      { x: x1, y: end, z: floorZ },
      { x: x1, y: end, z },
      { x: x1, y: start, z }
    ];
  }
  return [
    { x: x0, y: start, z: floorZ },
    { x: x0, y: end, z: floorZ },
    { x: x0, y: end, z },
    { x: x0, y: start, z }
  ];
}

function uniqueSortedAxisValues(values) {
  const result = [];
  for (const value of values.filter(Number.isFinite).sort((a, b) => a - b)) {
    if (!result.some((existing) => sameAxisValue(existing, value))) result.push(value);
  }
  return result;
}

function steppedSurfaceCellsFromCoordinateRows(rows) {
  const cells = [];
  for (const row of rows || []) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const baseX = row[0].x;
    const bridge = row.find((point) => !sameAxisValue(point.x, baseX));
    if (!bridge) continue;
    const basePoints = row.filter((point) => sameAxisValue(point.x, baseX));
    for (let index = 0; index < basePoints.length - 1; index += 1) {
      const start = basePoints[index];
      const end = basePoints[index + 1];
      if (sameAxisValue(start.y, end.y) || !sameAxisValue(start.z, end.z) || Math.abs(start.z) < 1e-12) continue;
      cells.push({
        x0: Math.min(baseX, bridge.x),
        x1: Math.max(baseX, bridge.x),
        y0: Math.min(start.y, end.y),
        y1: Math.max(start.y, end.y),
        z: start.z
      });
    }
  }
  return cells;
}

function surfacePatchFromCorners(corners, ranges, axisOptions) {
  if (corners.some((corner) => !corner || !isFiniteSurfacePoint(corner))) return null;
  const zMean = corners.reduce((sum, corner) => sum + corner.z, 0) / corners.length;
  const metaMean = surfacePatchMetaMean(corners, zMean);
  const xMean = corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length;
  const yMean = corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length;
  return {
    corners,
    zMean,
    metaMean,
    depth: surfaceDepth(xMean, yMean, zMean, ranges, axisOptions)
  };
}

function shouldUseRaggedCoordinateRows(rows, plotOptions = {}, axisOptions = {}) {
  return Array.isArray(rows) && rows.length >= 2 && !hasExplicitSurfaceMeshDimensions(plotOptions, axisOptions) && !surfaceRowsAreRectangular(rows);
}

function hasExplicitSurfaceMeshDimensions(plotOptions = {}, axisOptions = {}) {
  return Boolean(
    surfaceMeshDimension(plotOptions["mesh/rows"] ?? axisOptions["mesh/rows"] ?? plotOptions.rows ?? axisOptions.rows) ||
      surfaceMeshDimension(plotOptions["mesh/cols"] ?? axisOptions["mesh/cols"] ?? plotOptions.cols ?? axisOptions.cols)
  );
}

function surfaceRowsAreRectangular(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return false;
  const cols = rows[0]?.length || 0;
  return cols >= 2 && rows.every((row) => row.length === cols);
}

export function renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex = 0) {
  const xDomain = parseDomain(plot.options.domain || axisOptions.domain || `${ranges.xMin}:${ranges.xMax}`);
  const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || `${ranges.yMin}:${ranges.yMax}`);
  const visibleXDomain = clipDomainToAxisRange(xDomain, ranges);
  const visibleYDomain = clipDomainToRange(yDomain, ranges.yMin, ranges.yMax);
  if (!visibleXDomain || !visibleYDomain) return [];
  const xSamples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25, 80);
  const ySamples = axisSamples(plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25, 80);
  const zRestriction = parseZRestriction(plot.options, axisOptions);
  const xValues = sampleDomainValues(visibleXDomain, xSamples);
  const yValues = sampleDomainValues(visibleYDomain, ySamples);
  const grid = [];
  for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
    const row = [];
    const y = yValues[yIndex];
    for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
      const x = xValues[xIndex];
      const z = restrictSurfaceZ(evaluateAxisExpression(plot.expression, x, axisOptions, { y }), zRestriction);
      if (!Number.isFinite(z)) {
        row.push(null);
        continue;
      }
      const point = { x, y, z, projected: geometry.mapPoint3d({ x, y, z }) };
      const meta = evaluateSurfacePointMeta(plot.options["point meta"], x, y, axisOptions);
      if (Number.isFinite(meta)) point.meta = meta;
      row.push(point);
    }
    grid.push(row);
  }
  if (isTopViewShaderInterpSurface(plot.options, axisOptions) && !isAxisMeshWireframe(plot.options, axisOptions)) {
    const colorRanges = surfaceColorRanges(ranges, grid, axisOptions, plot.options);
    return renderAxisSurfaceImageCells({
      grid,
      xValues,
      yValues,
      xRange: visibleXDomain,
      yRange: visibleYDomain,
      plotOptions: plot.options,
      axisOptions,
      ranges: colorRanges,
      geometry,
      options,
      plotIndex
    });
  }
  const patches = [];
  for (let yIndex = 0; yIndex < ySamples - 1; yIndex += 1) {
    for (let xIndex = 0; xIndex < xSamples - 1; xIndex += 1) {
      const corners = [grid[yIndex][xIndex], grid[yIndex][xIndex + 1], grid[yIndex + 1][xIndex + 1], grid[yIndex + 1][xIndex]];
      if (corners.some((corner) => !corner)) continue;
      const zMean = corners.reduce((sum, corner) => sum + corner.z, 0) / corners.length;
      const metaMean = surfacePatchMetaMean(corners, zMean);
      const xMean = corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length;
      const yMean = corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length;
      patches.push({
        corners,
        zMean,
        metaMean,
        depth: surfaceDepth(xMean, yMean, zMean, ranges, axisOptions),
        xIndex,
        yIndex
      });
    }
  }
  const orderedPatches = orderFunctionSurfacePatches(patches, xSamples - 1, ySamples - 1, axisOptions, plot.options);
  if (isAxisMeshWireframe(plot.options, axisOptions)) {
    return renderAxisMeshWireframePatches(orderedPatches, plot.options, axisOptions, geometry, plotIndex);
  }
  const colorRanges = surfaceColorRanges(ranges, grid, axisOptions, plot.options);
  const opacity = axisOpacity(plot.options.opacity ?? axisOptions.opacity ?? 1);
  return renderAxisSurfacePatchLayerCommands(orderedPatches.map((patch) => {
    const fill = pgfplotsSurfacePatchColor(plot.options, surfacePatchColorValue(patch), colorRanges, plotIndex, axisOptions);
    const draw = pgfplotsSurfacePatchStrokeColor(plot.options, fill);
    const lineWidth = pgfplotsSurfacePatchLineWidth(plot.options);
    const points = patch.corners.map((corner) => formatAxisPoint(corner.projected)).join(" -- ");
    return renderAxisSurfacePatchLayers(points, { fill, draw, opacity, lineWidth });
  }));
}

export function renderAxisParametricSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex = 0) {
  const sampled = sampleParametricSurfaceGrid(plot, axisOptions, options);
  const grid = sampled.grid.map((row) => row.map((point) => point
    ? { ...point, projected: geometry.mapPoint3d(point) }
    : null));
  const colorRanges = surfaceColorRanges(ranges, grid, axisOptions, plot.options);
  const patches = [];
  for (let rowIndex = 0; rowIndex < sampled.vSamples - 1; rowIndex += 1) {
    for (let colIndex = 0; colIndex < sampled.uSamples - 1; colIndex += 1) {
      const corners = [
        grid[rowIndex][colIndex],
        grid[rowIndex][colIndex + 1],
        grid[rowIndex + 1][colIndex + 1],
        grid[rowIndex + 1][colIndex]
      ];
      if (corners.some((corner) => !corner)) continue;
      const patch = surfacePatchFromCorners(corners, ranges, axisOptions);
      if (patch) patches.push({ ...patch, xIndex: colIndex, yIndex: rowIndex });
    }
  }
  const orderedPatches = orderFunctionSurfacePatches(
    patches,
    sampled.uSamples - 1,
    sampled.vSamples - 1,
    axisOptions,
    plot.options
  );
  if (isAxisMeshWireframe(plot.options, axisOptions)) {
    return renderAxisMeshWireframePatches(orderedPatches, plot.options, axisOptions, geometry, plotIndex);
  }
  const opacity = axisOpacity(plot.options.opacity ?? axisOptions.opacity ?? 1);
  return renderAxisSurfacePatchLayerCommands(orderedPatches.map((patch) => {
    const fill = pgfplotsSurfacePatchColor(plot.options, surfacePatchColorValue(patch), colorRanges, plotIndex, axisOptions);
    const draw = pgfplotsSurfacePatchStrokeColor(plot.options, fill);
    const lineWidth = pgfplotsSurfacePatchLineWidth(plot.options);
    const points = patch.corners.map((corner) => formatAxisPoint(corner.projected)).join(" -- ");
    return renderAxisSurfacePatchLayers(points, { fill, draw, opacity, lineWidth });
  }));
}

function isAxisMeshWireframe(plotOptions = {}, axisOptions = {}) {
  const value = plotOptions.mesh ?? axisOptions.mesh;
  if (value === undefined || value === null || value === false) return false;
  const text = String(value).trim().toLowerCase();
  return text !== "false" && text !== "0" && text !== "none" && text !== "off";
}

function renderAxisMeshWireframePatches(patches, plotOptions, axisOptions, geometry, plotIndex) {
  const draw = plotColorValue(selectPlotColor(plotOptions, plotIndex));
  const opacity = axisOpacity(plotOptions.opacity ?? axisOptions.opacity ?? 1);
  // PGFPlots forces mesh mode through its flat handler, so an incidental
  // `shader=interp` must not suppress the wireframe stroke.
  const lineWidth = pgfplotsSurfacePatchLineWidth(plotOptions, { ignoreShader: true });
  const lineStyle = pgfplotsMeshWireframeLineStyle(plotOptions);
  return patches.map((patch) => {
    const points = patch.corners
      .map((corner) => formatAxisPoint(corner.projected || geometry.mapPoint3d(corner)))
      .join(" -- ");
    return `\\draw[axis surface mesh, draw=${draw}, fill=none, opacity=${opacity}, line width=${lineWidth}${lineStyle}] ${points} -- cycle;`;
  });
}

function pgfplotsMeshWireframeLineStyle(options = {}) {
  const styles = [];
  for (const key of ["dashed", "densely dashed", "loosely dashed", "dotted", "densely dotted", "loosely dotted"]) {
    if (options[key]) styles.push(key);
  }
  if (options["dash pattern"] && options["dash pattern"] !== true) styles.push(`dash pattern=${options["dash pattern"]}`);
  if (options["line cap"] && options["line cap"] !== true) styles.push(`line cap=${options["line cap"]}`);
  if (options["line join"] && options["line join"] !== true) styles.push(`line join=${options["line join"]}`);
  return styles.length ? `, ${styles.join(", ")}` : "";
}

function renderAxisSurfacePatchLayers(points, { fill, draw, opacity, lineWidth }) {
  const fillCommand = `\\path[axis surface fill, draw=none, fill=${fill}, opacity=${opacity}] ${points} -- cycle;`;
  let meshCommand = "";
  if (draw !== "none" && lineWidth !== "0pt") {
    meshCommand = `\\draw[axis surface mesh, draw=${draw}, fill=none, opacity=${opacity}, line width=${lineWidth}] ${points} -- cycle;`;
  }
  return { fillCommand, meshCommand };
}

function renderAxisSurfacePatchLayerCommands(layers) {
  return layers.flatMap((layer) => [layer.fillCommand, layer.meshCommand].filter(Boolean));
}

function orderFunctionSurfacePatches(patches, cols, rows, axisOptions = {}, plotOptions = {}) {
  const zBuffer = String(plotOptions["z buffer"] ?? axisOptions["z buffer"] ?? "default").trim().toLowerCase();
  if (zBuffer === "sort") return [...patches].sort((a, b) => a.depth - b.depth);
  if (zBuffer === "none") return patches;
  if (zBuffer === "reverse x seq") return scanlineOrderedPatches(patches, cols, rows, { reverseX: true, reverseY: false });
  if (zBuffer === "reverse y seq") return scanlineOrderedPatches(patches, cols, rows, { reverseX: false, reverseY: true });
  if (zBuffer === "reverse xy seq") return scanlineOrderedPatches(patches, cols, rows, { reverseX: true, reverseY: true });
  const reverse = defaultSurfaceScanlineReversal(axisOptions);
  return scanlineOrderedPatches(patches, cols, rows, reverse);
}

function defaultSurfaceScanlineReversal(axisOptions = {}) {
  const view = pgfplotsViewDirection(axisOptions);
  return {
    reverseX: view.x >= 0,
    reverseY: view.y >= 0
  };
}

function scanlineOrderedPatches(patches, cols, rows, { reverseX = false, reverseY = false } = {}) {
  if (!cols || !rows) return patches;
  const byCell = new Map(patches.map((patch) => [`${patch.yIndex}:${patch.xIndex}`, patch]));
  const yOrder = Array.from({ length: rows }, (_, index) => index);
  const xOrder = Array.from({ length: cols }, (_, index) => index);
  if (reverseY) yOrder.reverse();
  if (reverseX) xOrder.reverse();
  const ordered = [];
  for (const yIndex of yOrder) {
    for (const xIndex of xOrder) {
      const patch = byCell.get(`${yIndex}:${xIndex}`);
      if (patch) ordered.push(patch);
    }
  }
  return ordered.length === patches.length ? ordered : patches;
}

function renderAxisSurfaceImageCells({ grid, xValues, yValues, xRange, yRange, plotOptions, axisOptions, ranges, geometry, options, plotIndex }) {
  const xBounds = cellBoundaries(xValues, xRange.start, xRange.end);
  const yBounds = cellBoundaries(yValues, yRange.start, yRange.end);
  const opacity = axisOpacity(plotOptions.opacity ?? axisOptions.opacity ?? 1);
  const surfaceBounds = projectedSurfaceBounds(xBounds, yBounds, geometry);
  const image = topViewSurfaceImageDataUri({ grid, plotOptions, axisOptions, ranges, options, plotIndex });
  const payload = encodeRasterImagePayload({
    href: image,
    preserveAspectRatio: "none",
    imageRendering: "auto",
    opacity
  });
  return [
    `\\path[axis surface raster image=${payload}, draw=none] ${formatAxisPoint({
      x: surfaceBounds.minX,
      y: surfaceBounds.minY
    })} rectangle ${formatAxisPoint({ x: surfaceBounds.maxX, y: surfaceBounds.maxY })};`
  ];
}

function topViewSurfaceImageDataUri({ grid, plotOptions, axisOptions, ranges, options, plotIndex }) {
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((row) => row.length));
  const raster = topViewSurfaceRasterDimensions(cols, rows, options);
  const pixels = new Uint8Array(raster.width * raster.height * 4);
  for (let yIndex = 0; yIndex < raster.height; yIndex += 1) {
    for (let xIndex = 0; xIndex < raster.width; xIndex += 1) {
      const fill = sampleTopViewSurfaceColor({
        grid,
        rasterX: xIndex,
        rasterY: yIndex,
        rasterWidth: raster.width,
        rasterHeight: raster.height,
        plotOptions,
        axisOptions,
        ranges,
        plotIndex
      });
      if (!fill) continue;
      const rgb = parseRgbColor(fill);
      if (!rgb) continue;
      const offset = (yIndex * raster.width + xIndex) * 4;
      pixels[offset] = rgb[0];
      pixels[offset + 1] = rgb[1];
      pixels[offset + 2] = rgb[2];
      pixels[offset + 3] = 255;
    }
  }
  return encodeRgbaPngDataUri(raster.width, raster.height, pixels);
}

function topViewSurfaceRasterDimensions(cols, rows, options = {}) {
  const rawScale = Number(options?.pgfplotsSurfaceRasterScale);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 6;
  const maxPixelsPerSide = Math.max(16, Math.min(512, Number(options?.pgfplotsSurfaceRasterMaxSide) || 320));
  return {
    width: Math.max(cols, Math.min(maxPixelsPerSide, Math.round(cols * scale))),
    height: Math.max(rows, Math.min(maxPixelsPerSide, Math.round(rows * scale)))
  };
}

function sampleTopViewSurfaceColor({ grid, rasterX, rasterY, rasterWidth, rasterHeight, plotOptions, axisOptions, ranges, plotIndex }) {
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((row) => row.length));
  if (!rows || !cols) return "";
  const x = rasterWidth <= 1 ? 0 : (rasterX / (rasterWidth - 1)) * (cols - 1);
  const y = rasterHeight <= 1 ? 0 : ((rasterHeight - 1 - rasterY) / (rasterHeight - 1)) * (rows - 1);
  const left = Math.max(0, Math.min(cols - 1, Math.floor(x)));
  const right = Math.max(0, Math.min(cols - 1, Math.ceil(x)));
  const bottom = Math.max(0, Math.min(rows - 1, Math.floor(y)));
  const top = Math.max(0, Math.min(rows - 1, Math.ceil(y)));
  const points = {
    bottomLeft: grid[bottom]?.[left],
    bottomRight: grid[bottom]?.[right],
    topLeft: grid[top]?.[left],
    topRight: grid[top]?.[right]
  };
  if (Object.values(points).every((point) => point && Number.isFinite(point.z))) {
    const tx = x - left;
    const ty = y - bottom;
    const colors = {
      bottomLeft: surfacePointRgb(points.bottomLeft, plotOptions, axisOptions, ranges, plotIndex),
      bottomRight: surfacePointRgb(points.bottomRight, plotOptions, axisOptions, ranges, plotIndex),
      topLeft: surfacePointRgb(points.topLeft, plotOptions, axisOptions, ranges, plotIndex),
      topRight: surfacePointRgb(points.topRight, plotOptions, axisOptions, ranges, plotIndex)
    };
    if (Object.values(colors).every(Boolean)) {
      return rgbArrayToCss(bilinearRgb(colors, tx, ty));
    }
    const bottomZ = points.bottomLeft.z + (points.bottomRight.z - points.bottomLeft.z) * tx;
    const topZ = points.topLeft.z + (points.topRight.z - points.topLeft.z) * tx;
    return pgfplotsSurfacePatchColor(plotOptions, bottomZ + (topZ - bottomZ) * ty, ranges, plotIndex, axisOptions);
  }
  const nearest = nearestFiniteGridPoint(grid, Math.round(x), Math.round(y));
  if (!nearest) return "";
  return pgfplotsSurfacePatchColor(plotOptions, nearest.z, ranges, plotIndex, axisOptions);
}

function surfacePointRgb(point, plotOptions, axisOptions, ranges, plotIndex) {
  const color = pgfplotsSurfacePatchColor(plotOptions, surfacePointColorValue(point), ranges, plotIndex, axisOptions);
  return parseRgbColor(color);
}

function bilinearRgb(colors, tx, ty) {
  const bottom = interpolateRgb(colors.bottomLeft, colors.bottomRight, tx);
  const top = interpolateRgb(colors.topLeft, colors.topRight, tx);
  return interpolateRgb(bottom, top, ty);
}

function interpolateRgb(left, right, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return left.map((channel, index) => channel + (right[index] - channel) * clamped);
}

function rgbArrayToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel)))).join(",")})`;
}

function nearestFiniteGridPoint(grid, x, y) {
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((row) => row.length));
  for (let radius = 0; radius <= Math.max(rows, cols); radius += 1) {
    for (let yy = Math.max(0, y - radius); yy <= Math.min(rows - 1, y + radius); yy += 1) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(cols - 1, x + radius); xx += 1) {
        const point = grid[yy]?.[xx];
        if (point && Number.isFinite(point.z)) return point;
      }
    }
  }
  return null;
}

function projectedSurfaceBounds(xBounds, yBounds, geometry) {
  const corners = [
    geometry.mapPoint3d({ x: xBounds[0], y: yBounds[0], z: 0 }),
    geometry.mapPoint3d({ x: xBounds.at(-1), y: yBounds[0], z: 0 }),
    geometry.mapPoint3d({ x: xBounds[0], y: yBounds.at(-1), z: 0 }),
    geometry.mapPoint3d({ x: xBounds.at(-1), y: yBounds.at(-1), z: 0 })
  ];
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y))
  };
}

function encodeRasterImagePayload(payload) {
  const text = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64url");
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isTopViewShaderInterpSurface(plotOptions = {}, axisOptions = {}) {
  return String(plotOptions.shader || "").trim().toLowerCase() === "interp" && isPgfplotsTopView(axisOptions);
}

function sampleDomainValues(domain, samples) {
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const t = samples === 1 ? 0 : index / (samples - 1);
    values.push(domain.start + (domain.end - domain.start) * t);
  }
  return values;
}

function cellBoundaries(values, min, max) {
  if (!values.length) return [];
  if (values.length === 1) return [min, max];
  const bounds = [min];
  for (let index = 1; index < values.length; index += 1) {
    bounds.push((values[index - 1] + values[index]) / 2);
  }
  bounds.push(max);
  return bounds.map((value) => Math.max(min, Math.min(max, value)));
}

function inferSurfaceCoordinateGrid(points, plotOptions = {}, axisOptions = {}, coordinateRows = null) {
  if (points.length < 4) return null;
  const optionRows = surfaceMeshDimension(plotOptions["mesh/rows"] ?? axisOptions["mesh/rows"] ?? plotOptions.rows ?? axisOptions.rows);
  const optionCols = surfaceMeshDimension(plotOptions["mesh/cols"] ?? axisOptions["mesh/cols"] ?? plotOptions.cols ?? axisOptions.cols);
  let rows = optionRows;
  let cols = optionCols;
  if (rows && !cols && points.length % rows === 0) cols = points.length / rows;
  if (cols && !rows && points.length % cols === 0) rows = points.length / cols;
  if (!rows && !cols) {
    const rowGrid = surfaceGridFromCoordinateRows(coordinateRows);
    if (rowGrid) return rowGrid;
  }
  if (!rows || !cols) {
    const inferred = inferSurfaceMatrixShape(points);
    if (!inferred) return null;
    rows = inferred.rows;
    cols = inferred.cols;
  }
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows * cols > points.length) return null;
  const grid = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    grid.push(points.slice(rowIndex * cols, rowIndex * cols + cols));
  }
  return { rows, cols, points: grid };
}

function surfaceGridFromCoordinateRows(coordinateRows) {
  const rows = finiteSurfaceCoordinateRows(coordinateRows);
  if (rows.length < 2) return null;
  const cols = rows[0].length;
  if (cols < 2 || rows.some((row) => row.length !== cols)) return null;
  return {
    rows: rows.length,
    cols,
    points: rows
  };
}

function finiteSurfaceCoordinateRows(coordinateRows) {
  if (!Array.isArray(coordinateRows)) return [];
  return coordinateRows
    .map((row) => (Array.isArray(row) ? row.filter(isFiniteSurfacePoint) : []))
    .filter((row) => row.length > 0);
}

function isFiniteSurfacePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

function surfaceMeshDimension(value) {
  if (value === undefined || value === null || value === true || value === "") return null;
  const parsed = Math.round(axisNumber(value, NaN));
  return Number.isInteger(parsed) && parsed > 1 ? parsed : null;
}

function inferSurfaceMatrixShape(points) {
  const uniqueX = uniqueAxisValues(points.map((point) => point.x));
  const uniqueY = uniqueAxisValues(points.map((point) => point.y));
  if (uniqueX.length > 1 && uniqueY.length > 1 && uniqueX.length * uniqueY.length === points.length) {
    return { rows: uniqueY.length, cols: uniqueX.length };
  }
  const firstY = points[0].y;
  let firstRowLength = 1;
  while (firstRowLength < points.length && sameAxisValue(points[firstRowLength].y, firstY)) firstRowLength += 1;
  if (firstRowLength > 1 && points.length % firstRowLength === 0) {
    return { rows: points.length / firstRowLength, cols: firstRowLength };
  }
  const side = Math.round(Math.sqrt(points.length));
  if (side > 1 && side * side === points.length) return { rows: side, cols: side };
  return null;
}

function sameAxisValue(left, right) {
  return Math.abs(Number(left) - Number(right)) < 1e-9;
}

function clipDomainToRange(domain, min, max) {
  const start = Math.max(domain.start, min);
  const end = Math.min(domain.end, max);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}

function surfaceColorRanges(ranges, grid, axisOptions = {}, plotOptions = {}) {
  if (!usesPerPlotPointMeta(axisOptions, plotOptions)) return ranges;
  const values = [];
  for (const row of grid || []) {
    for (const point of row || []) {
      const value = surfacePointColorValue(point);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  if (!values.length) return ranges;
  let zMin = Math.min(...values);
  let zMax = Math.max(...values);
  if (Math.abs(zMax - zMin) < 1e-12) {
    zMin -= 1;
    zMax += 1;
  }
  return {
    ...ranges,
    zMin,
    zMax
  };
}

function usesPerPlotPointMeta(axisOptions = {}, plotOptions = {}) {
  const raw = plotOptions["point meta rel"] ?? axisOptions["point meta rel"];
  return Boolean(plotOptions["point meta"]) || String(raw || "").trim().toLowerCase() === "per plot";
}

function evaluateSurfacePointMeta(rawPointMeta, x, y, axisOptions = {}) {
  if (rawPointMeta === undefined || rawPointMeta === null || rawPointMeta === true) return NaN;
  return evaluateAxisExpression(String(rawPointMeta), x, axisOptions, { y });
}

function surfacePointColorValue(point) {
  if (!point) return NaN;
  return Number.isFinite(point.meta) ? point.meta : point.z;
}

function surfacePatchMetaMean(corners, fallback) {
  const values = corners.map(surfacePointColorValue).filter(Number.isFinite);
  return values.length === corners.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function surfacePatchColorValue(patch) {
  return Number.isFinite(patch?.metaMean) ? patch.metaMean : patch?.zMean;
}

function surfaceDepth(x, y, z, ranges, axisOptions = {}) {
  const xSpan = ranges.xMax - ranges.xMin || 1;
  const ySpan = ranges.yMax - ranges.yMin || 1;
  const zSpan = ranges.zMax - ranges.zMin || 1;
  const nx = (x - ranges.xMin) / xSpan;
  const ny = (y - ranges.yMin) / ySpan;
  const nz = (z - ranges.zMin) / zSpan;
  const view = pgfplotsViewDirection(axisOptions);
  return nx * view.x + ny * view.y + nz * view.z;
}

function pgfplotsSurfacePatchColor(options = {}, z, ranges, plotIndex = 0, axisOptions = {}) {
  if (options.fill && options.fill !== true) return plotColorValue(options.fill);
  const explicit = explicitPlotColor(options);
  if (explicit) return plotColorValue(explicit);
  return pgfplotsSurfaceColor(z, ranges, plotIndex, surfaceColorContext(options, axisOptions));
}

function surfaceColorContext(options = {}, axisOptions = {}) {
  const plotColormaps = parsePgfplotsColormaps(options.colormap);
  const plotColormapName = Object.keys(plotColormaps)[0] || "";
  const colormapName = firstNonempty(options["colormap name"], plotColormapName, axisOptions["colormap name"]);
  return {
    ...axisOptions,
    "colormap name": colormapName,
    "pgfplots colormaps": {
      ...pgfplotsBuiltinColormaps(colormapName),
      ...(axisOptions["pgfplots colormaps"] || {}),
      ...plotColormaps
    }
  };
}

function pgfplotsBuiltinColormaps(name) {
  const normalizedName = String(name || "").trim().toLowerCase();
  if (normalizedName === "hot") {
    return {
      hot: [
        { position: 0, color: "blue" },
        { position: 1, color: "yellow" },
        { position: 2, color: "orange" },
        { position: 3, color: "red" }
      ]
    };
  }
  if (normalizedName !== "viridis") return {};
  const colors = [
    [0.267, 0.00487, 0.32942], [0.28192, 0.08966, 0.41241], [0.28026, 0.1657, 0.4765],
    [0.26366, 0.23763, 0.51877], [0.23744, 0.3052, 0.54192], [0.20862, 0.36775, 0.55267],
    [0.18225, 0.42618, 0.55711], [0.1592, 0.48224, 0.55807], [0.13777, 0.53749, 0.5549],
    [0.12115, 0.59274, 0.54465], [0.12808, 0.64775, 0.5235], [0.18065, 0.7014, 0.48819],
    [0.27415, 0.75198, 0.4366], [0.39517, 0.79747, 0.36775], [0.53561, 0.83578, 0.2819],
    [0.68895, 0.86545, 0.18272], [0.84557, 0.88733, 0.0997], [0.99324, 0.90616, 0.14394]
  ];
  return {
    viridis: colors.map((rgb, index) => ({
      position: index,
      color: `rgb(${rgb.map((channel) => Math.round(channel * 255)).join(",")})`
    }))
  };
}

function firstNonempty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function pgfplotsSurfacePatchStrokeColor(options = {}, fill) {
  if (String(options.shader || "").trim().toLowerCase() === "interp") return "none";
  if (options["faceted color"] && options["faceted color"] !== true && String(options["faceted color"]).trim() !== "none") {
    return plotColorValue(options["faceted color"]);
  }
  // `surf` installs its own faceted color (`mapped color!80!black`). A
  // generic draw color does not override that PGFPlots key; callers that
  // need a fixed surface mesh color use `faceted color=...` explicitly.
  if (options.surf) return pgfplotsFacetedStrokeColor(fill);
  if (options.draw && options.draw !== true) return plotColorValue(options.draw);
  if (options.mesh) return pgfplotsFacetedStrokeColor(fill);
  return fill;
}

function pgfplotsSurfacePatchLineWidth(options = {}, { ignoreShader = false } = {}) {
  if (!ignoreShader && String(options.shader || "").trim().toLowerCase() === "interp") return "0pt";
  if (options["line width"] && options["line width"] !== true) return String(options["line width"]);
  if (options["ultra thin"]) return "0.1pt";
  if (options["very thin"]) return "0.2pt";
  if (options.thin) return "0.4pt";
  if (options.semithick) return "0.6pt";
  if (options.thick) return "0.8pt";
  if (options["very thick"]) return "1.2pt";
  if (options["ultra thick"]) return "1.6pt";
  return "0.4pt";
}

function pgfplotsLinearPatchMappedColor(z, ranges, options, axisOptions, plotIndex) {
  const context = surfaceColorContext(options, axisOptions);
  if (!context["colormap name"]) {
    context["colormap name"] = "hot";
    context["pgfplots colormaps"] = {
      ...pgfplotsBuiltinColormaps("hot"),
      ...(context["pgfplots colormaps"] || {})
    };
  }
  return pgfplotsSurfaceColor(z, ranges, plotIndex, context);
}

function pgfplotsFacetedStrokeColor(fill) {
  const rgb = parseRgbColor(fill);
  if (!rgb) return "black!20";
  const mixed = rgb.map((channel) => Math.round(channel * 0.8));
  return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
}

export function pgfplotsSurfaceColor(z, ranges, plotIndex = 0, axisOptions = {}) {
  const custom = pgfplotsCustomSurfaceColor(axisOptions, z, ranges);
  if (custom) return custom;
  const zSpan = ranges.zMax - ranges.zMin || 1;
  const t = Math.max(0, Math.min(1, (z - ranges.zMin) / zSpan));
  const stops = [
    { t: 0, color: [38, 64, 190] },
    { t: 0.42, color: [70, 120, 255] },
    { t: 0.68, color: [255, 218, 60] },
    { t: 1, color: [240, 45, 20] }
  ];
  for (let index = 1; index < stops.length; index += 1) {
    if (t <= stops[index].t) {
      const previous = stops[index - 1];
      const next = stops[index];
      const local = (t - previous.t) / (next.t - previous.t || 1);
      const rgb = previous.color.map((channel, channelIndex) => Math.round(channel + (next.color[channelIndex] - channel) * local));
      return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
  }
  return selectPlotColor({}, plotIndex);
}

function pgfplotsCustomSurfaceColor(axisOptions = {}, z, ranges) {
  const colormapName = String(axisOptions["colormap name"] || "").trim();
  const colormap = axisOptions["pgfplots colormaps"]?.[colormapName];
  if (!Array.isArray(colormap) || colormap.length < 2) return "";
  const zSpan = ranges.zMax - ranges.zMin || 1;
  const t = Math.max(0, Math.min(1, (z - ranges.zMin) / zSpan));
  const stops = normalizeColormapStops(colormap);
  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1];
    const right = stops[index];
    if (t <= right.position) {
      const local = (t - left.position) / (right.position - left.position || 1);
      return interpolateColor(left.color, right.color, local);
    }
  }
  return stops.at(-1)?.color || "";
}

function normalizeColormapStops(stops) {
  const positions = stops.map((stop) => Number(stop.position)).filter(Number.isFinite);
  const min = Math.min(...positions);
  const max = Math.max(...positions);
  const span = max - min || 1;
  return stops
    .filter((stop) => Number.isFinite(Number(stop.position)) && stop.color)
    .map((stop) => ({
      position: (Number(stop.position) - min) / span,
      color: normalizeColor(stop.color)
    }))
    .sort((a, b) => a.position - b.position);
}

function interpolateColor(left, right, t) {
  if (t <= 0) return left;
  if (t >= 1) return right;
  const leftRgb = parseRgbColor(left);
  const rightRgb = parseRgbColor(right);
  if (!leftRgb || !rightRgb) return t < 0.5 ? left : right;
  const rgb = leftRgb.map((channel, index) => channel + (rightRgb[index] - channel) * Math.max(0, Math.min(1, t)));
  return formatRgbNumberColor(rgb);
}

function parseRgbColor(color) {
  const text = normalizeColor(color);
  const shared = colorToRgb(text);
  if (shared) return shared;
  const rgbPercent = text.match(/^rgb\(([-0-9.]+)%\s*(?:,|\s)\s*([-0-9.]+)%\s*(?:,|\s)\s*([-0-9.]+)%\)$/);
  if (rgbPercent) return rgbPercent.slice(1).map((channel) => (Number(channel) / 100) * 255);
  const rgbSpace = text.match(/^rgb\(([-0-9.]+)\s+([-0-9.]+)\s+([-0-9.]+)\)$/);
  if (rgbSpace) return [Number(rgbSpace[1]), Number(rgbSpace[2]), Number(rgbSpace[3])];
  const rgbComma = text.match(/^rgb\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)$/);
  if (rgbComma) return [Number(rgbComma[1]), Number(rgbComma[2]), Number(rgbComma[3])];
  const named = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [255, 0, 0],
    orange: [255, 128, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0]
  };
  return named[text.toLowerCase()] || null;
}

function formatRgbNumberColor(rgb) {
  return `rgb(${rgb.map(formatRgbChannel).join(" ")})`;
}

function formatRgbChannel(value) {
  return Number(Math.max(0, Math.min(255, value)).toFixed(6)).toString();
}

function explicitPlotColor(options) {
  for (const [key, value] of Object.entries(options || {})) {
    if (key.startsWith("pgfplots ")) continue;
    if (value === true && isPlotColorToken(key)) return key;
    // PGFPlots keeps the surface mapped color and the faceted stroke
    // independent: `surf,draw=black` means colormap-filled faces with a
    // black mesh, not black-filled faces.
    if (key === "color") return `${key}=${value}`;
  }
  return "";
}

function axisOpacity(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function clipDomainToAxisRange(domain, ranges) {
  return clipDomainToRange(domain, ranges.xMin, ranges.xMax);
}

function uniqueAxisValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const key = formatAxisNumber(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}
