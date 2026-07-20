const DAY_MS = 24 * 60 * 60 * 1000;

export function createPgfplotsDateContext(axisOptions = {}) {
  const axes = new Set(
    String(axisOptions["date coordinates in"] || "")
      .replace(/[{}]/g, "")
      .split(/[\s,]+/)
      .map((axis) => axis.trim().toLowerCase())
      .filter((axis) => axis === "x" || axis === "y" || axis === "z")
  );
  const zeroLiteral = stripDateBraces(axisOptions["date ZERO"] ?? axisOptions["date zero"] ?? "");
  return {
    axes,
    zeroDay: zeroLiteral ? pgfplotsDateDay(zeroLiteral) : null
  };
}

export function parsePgfplotsDateCoordinate(raw, axis, context) {
  if (!context?.axes?.has(axis)) return null;
  const literal = stripDateBraces(raw);
  const day = pgfplotsDateDay(literal);
  if (!Number.isFinite(day)) return NaN;
  if (!Number.isFinite(context.zeroDay)) context.zeroDay = day;
  return day - context.zeroDay + pgfplotsDateTimeFraction(literal);
}

export function normalizePgfplotsDateAxisOptions(axisOptions = {}, addplots = [], context = null) {
  if (!context?.axes?.size) return axisOptions;
  const normalized = { ...axisOptions };
  for (const axis of context.axes) {
    const scaledTickKey = `scaled ${axis} ticks`;
    if (
      normalized[scaledTickKey] === undefined &&
      normalized["scaled ticks"] === undefined
    ) {
      // pgfplots.dateplot disables numeric scaling for transformed Julian-day
      // coordinates; labels are produced by the inverse date transform instead.
      normalized[scaledTickKey] = false;
    }
    for (const suffix of ["min", "max"]) {
      const key = `${axis}${suffix}`;
      if (normalized[key] === undefined) continue;
      const value = parsePgfplotsDateCoordinate(normalized[key], axis, context);
      if (Number.isFinite(value)) normalized[key] = value;
    }
    const tickKey = `${axis}tick`;
    const tickLabelKey = `${axis}ticklabel`;
    if (String(normalized[tickKey] || "").trim() !== "data") continue;
    const template = String(normalized[tickLabelKey] || "").trim();
    if (!template || !/\\(?:year|month|day|hour|minute)\b/.test(template)) continue;
    const dateTicks = uniqueDateTicks(addplots, axis);
    normalized[`${axis}ticklabels`] = `{${dateTicks.map((tick) => formatPgfplotsDateLabel(template, tick.raw)).join(",")}}`;
  }
  return normalized;
}

export function pgfplotsDateDay(raw) {
  const parts = pgfplotsDateParts(raw);
  if (!parts) return NaN;
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

function pgfplotsDateParts(raw) {
  const match = stripDateBraces(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0)
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }
  return parts;
}

function pgfplotsDateTimeFraction(raw) {
  const parts = pgfplotsDateParts(raw);
  if (!parts) return 0;
  return (parts.hour * 3600 + parts.minute * 60 + parts.second) / 86400;
}

function uniqueDateTicks(addplots, axis) {
  const byValue = new Map();
  for (const point of addplots.flatMap((plot) => plot.points || [])) {
    const value = Number(point?.[axis]);
    const raw = point?.dateCoordinates?.[axis];
    if (!Number.isFinite(value) || !raw) continue;
    const key = value.toFixed(12);
    if (!byValue.has(key)) byValue.set(key, { value, raw });
  }
  return [...byValue.values()];
}

function formatPgfplotsDateLabel(template, raw) {
  const parts = pgfplotsDateParts(raw);
  if (!parts) return raw;
  return String(template)
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .replace(/\\year\b/g, String(parts.year))
    .replace(/\\month\b/g, String(parts.month).padStart(2, "0"))
    .replace(/\\day\b/g, String(parts.day).padStart(2, "0"))
    .replace(/\\hour\b/gi, String(parts.hour).padStart(2, "0"))
    .replace(/\\minute\b/gi, String(parts.minute).padStart(2, "0"));
}

function stripDateBraces(value) {
  return String(value ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
}
