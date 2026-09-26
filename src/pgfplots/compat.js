// `\pgfplotsset{compat=...}` levels are dotted versions, not decimals:
// 1.18 is newer than 1.3, so they must be compared component by component.

// Returns whether `raw` is at least `minimum` (a string such as "1.13").
// `unset` is the answer when no compat level was declared; PGFPlots' initial
// `compat=default` behaves as the oldest level, but some callers keep a
// different historical default.
export function pgfplotsCompatAtLeast(raw, minimum, { unset = false } = {}) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value || value === "default") return unset;
  if (value === "newest") return true;
  if (value.startsWith("pre")) return false;
  const actualParts = versionParts(value);
  const minimumParts = versionParts(String(minimum));
  if (!actualParts || !minimumParts) return unset;
  const length = Math.max(actualParts.length, minimumParts.length);
  for (let index = 0; index < length; index += 1) {
    const actual = actualParts[index] || 0;
    const required = minimumParts[index] || 0;
    if (actual !== required) return actual > required;
  }
  return true;
}

// The compat level an axis was declared with, from `\pgfplotsset` or the axis.
export function pgfplotsCompatLevel(axisOptions = {}, plotOptions = {}) {
  return plotOptions["pgfplots compat"] ??
    axisOptions["pgfplots compat"] ??
    plotOptions.compat ??
    axisOptions.compat;
}

function versionParts(value) {
  const match = String(value).trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return match.slice(1).filter((part) => part !== undefined).map(Number);
}
