export class TikzKitError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "TikzKitError";
    this.code = options.code || "TIKZKIT_ERROR";
    this.diagnostics = options.diagnostics || [];
  }
}

export function diagnosticToError(diagnostic) {
  return new TikzKitError(diagnostic?.message || "TikZKit diagnostic error", {
    code: diagnostic?.code || "TIKZKIT_DIAGNOSTIC",
    diagnostics: diagnostic ? [diagnostic] : []
  });
}
