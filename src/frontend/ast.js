export function createDocumentAst(overrides = {}) {
  return {
    type: "document",
    pictures: [],
    packages: [],
    libraries: [],
    ...overrides
  };
}

export function createPictureAst(overrides = {}) {
  return {
    type: "tikzpicture",
    options: {},
    statements: [],
    ...overrides
  };
}
