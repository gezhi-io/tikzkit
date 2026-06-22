export function createGalleryReportIndexes(diffRows = null, nativeRows = null) {
  return {
    diffRows: mapRowsById(diffRows),
    nativeRows: mapRowsById(nativeRows),
    diffRowsByPath: mapRowsByPath(diffRows),
    nativeRowsByPath: mapRowsByPath(nativeRows),
    loaded: Boolean(diffRows || nativeRows),
    error: ""
  };
}

export function createEmptyGalleryReportIndexes(error = "") {
  return {
    diffRows: new Map(),
    nativeRows: new Map(),
    diffRowsByPath: new Map(),
    nativeRowsByPath: new Map(),
    loaded: false,
    error
  };
}

export function reportForCase(index, galleryCase, reports) {
  const id = String(index).padStart(3, "0");
  return {
    diff: matchingRow(reports.diffRows.get(id), reports.diffRowsByPath, galleryCase),
    native: matchingRow(reports.nativeRows.get(id), reports.nativeRowsByPath, galleryCase)
  };
}

function mapRowsById(rows) {
  return new Map((rows || []).map((row) => [row.id, row]));
}

function mapRowsByPath(rows) {
  return new Map((rows || []).filter((row) => row.path).map((row) => [row.path, row]));
}

function matchingRow(rowById, rowsByPath, galleryCase) {
  if (!galleryCase?.path) return rowById;
  if (rowById?.path === galleryCase.path) return rowById;
  return rowsByPath.get(galleryCase.path) || null;
}
