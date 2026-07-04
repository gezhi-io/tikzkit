export function createDiagnostic(message, options = {}) {
  return {
    severity: options.severity || "warning",
    message,
    code: options.code,
    span: options.span
  };
}

export function hasErrors(diagnostics = []) {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
