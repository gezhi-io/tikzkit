export function jsCompareScale(diffRow = {}) {
  const direct = finitePositive(diffRow?.jsScale);
  if (direct && direct >= 0.2 && direct <= 2) return direct;

  const unit = diffRow?.unit || {};
  const jsX = finitePositive(unit.jsSvgPxPerXUnit);
  const nativeX = finitePositive(unit.nativeRasterPxPerXUnit);
  if (jsX && nativeX) {
    const scale = nativeX / jsX;
    if (scale >= 0.2 && scale <= 2) return scale;
  }

  const jsY = finitePositive(unit.jsSvgPxPerYUnit);
  const nativeY = finitePositive(unit.nativeRasterPxPerYUnit);
  if (jsY && nativeY) {
    const scale = nativeY / jsY;
    if (scale >= 0.2 && scale <= 2) return scale;
  }

  return null;
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
