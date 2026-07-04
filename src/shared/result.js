export function conversionOk(diagnostics = []) {
  return diagnostics.every((diagnostic) => diagnostic.severity !== "error");
}

export function createConversionResult({ svg = "", diagnostics = [], ir = null, ast = null } = {}) {
  return {
    ok: conversionOk(diagnostics),
    svg,
    diagnostics,
    ir,
    ast
  };
}

export function mergeDiagnostics(...groups) {
  return groups.flat().filter(Boolean);
}
