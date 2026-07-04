export function createEngineContext(overrides = {}) {
  return {
    variables: {},
    styles: {},
    coordinates: {},
    nodes: {},
    namedPaths: {},
    transform: identityTransform(),
    currentPoint: null,
    diagnostics: [],
    ...overrides
  };
}

export function identityTransform() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}
