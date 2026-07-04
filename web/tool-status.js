export function generatedArtifactStatus(rawStatus, artifactExists, options = {}) {
  const fresh = options.fresh ?? artifactExists;
  if (artifactExists && fresh) return 0;
  return typeof rawStatus === "number" ? rawStatus : 1;
}
