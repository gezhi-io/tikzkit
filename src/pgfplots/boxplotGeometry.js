// The first PGFPlots boxplot coordinate is the measured value; only the
// second coordinate moves across the category lane when changing anchors.
export function boxplotPoint(box, value, fraction = box.relativeAnchor, extent = box.boxExtend) {
  const category = box.position + (fraction - box.relativeAnchor) * extent;
  return box.direction === "y" ? { x: category, y: value } : { x: value, y: category };
}

export function boxplotSurveyPoints(box, outlierPoints) {
  const points = [...outlierPoints];
  for (const [field, extent] of [
    ["lowerWhisker", box.whiskerExtend], ["lowerQuartile", box.boxExtend],
    ["median", box.boxExtend], ["average", box.boxExtend],
    ["upperQuartile", box.boxExtend], ["upperWhisker", box.whiskerExtend]
  ]) {
    if (Number.isFinite(box[field])) {
      points.push(boxplotPoint(box, box[field], 0, extent), boxplotPoint(box, box[field], 1, extent));
    }
  }
  return points;
}
