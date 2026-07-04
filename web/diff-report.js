import { generatedArtifactStatus } from "./tool-status.js";

export function diffReportFields({ rawStatus, stdout = "", stderr = "", diffExists = false, diffPath = null } = {}) {
  return prefixedDiffReportFields("imageDiff", { rawStatus, stdout, stderr, diffExists, diffPath });
}

export function prefixedDiffReportFields(prefix, { rawStatus, stdout = "", stderr = "", diffExists = false, diffPath = null } = {}) {
  return {
    [`${prefix}Png`]: diffExists ? diffPath : null,
    [`${prefix}Status`]: generatedArtifactStatus(rawStatus, diffExists),
    [`${prefix}RawStatus`]: typeof rawStatus === "number" ? rawStatus : null,
    [`${prefix}Stderr`]: String(stderr || "").trim(),
    [`${prefix}Metrics`]: parseDiffMetrics(stdout)
  };
}

function parseDiffMetrics(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
