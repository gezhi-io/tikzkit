const TEX_SCALED_POINT = 65536;

export function samplePgfplotsSurfaceDomain(domain, samples, plotOptions = {}, axisOptions = {}) {
  const count = Math.max(2, Math.round(Number(samples) || 2));
  const start = pgfFixedNumber(domain.start);
  const end = pgfFixedNumber(domain.end);
  const stepScaledPoints = Math.trunc((toScaledPoints(end) - toScaledPoints(start)) / (count - 1));
  const second = fromScaledPoints(toScaledPoints(start) + stepScaledPoints);
  const step = pgfFloat(second - start);
  if (pgfplotsUsesCorrectSampling(plotOptions, axisOptions)) {
    return Array.from({ length: count }, (_, index) => pgfFloat(pgfFloat(index * step) + start));
  }

  const values = [start];
  for (let index = 1; index < count; index += 1) {
    values.push(pgfFloat(values[index - 1] + step));
  }
  return values;
}

export function pgfplotsUsesCorrectSampling(plotOptions = {}, axisOptions = {}) {
  const explicit = plotOptions["correct sampling"] ?? axisOptions["correct sampling"];
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return !/^(?:false|0|off|no)$/i.test(String(explicit).trim());
  }
  const compat = String(
    plotOptions["pgfplots compat"] ??
      axisOptions["pgfplots compat"] ??
      plotOptions.compat ??
      axisOptions.compat ??
      ""
  ).trim().toLowerCase();
  if (compat === "newest") return true;
  const version = Number.parseFloat(compat);
  return Number.isFinite(version) && version >= 1.13;
}

function pgfFixedNumber(value) {
  return fromScaledPoints(toScaledPoints(value));
}

function toScaledPoints(value) {
  return Math.round(Number(value) * TEX_SCALED_POINT);
}

function fromScaledPoints(value) {
  return Number((value / TEX_SCALED_POINT).toFixed(5));
}

function pgfFloat(value) {
  return Number(Number(value).toPrecision(8));
}
