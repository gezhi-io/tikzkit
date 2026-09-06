export const SVG_ID_PREFIX = Symbol("svgIdPrefix");

export function svgDefinitionId(id, context = {}) {
  const prefix = context?.[SVG_ID_PREFIX];
  return prefix ? `${prefix}-${id}` : id;
}

export function createSvgIdPrefix(definitions, unit, explicitPrefix) {
  if (explicitPrefix !== undefined) {
    if (typeof explicitPrefix !== "string" || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(explicitPrefix)) {
      throw new TypeError("idPrefix must start with a letter or underscore and contain only letters, digits, underscores, dots, or hyphens.");
    }
    return explicitPrefix;
  }
  // Hash emitted definition content, including unit-dependent clip/filter data.
  // Equal definitions can share IDs; different renderings must not share them.
  let first = 2166136261;
  let second = 2246822507;
  for (const character of `${unit}\0${definitions.join("")}`) {
    const code = character.codePointAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489909);
  }
  const hex = (value) => (value >>> 0).toString(16).padStart(8, "0");
  return `tikzkit-${hex(first)}${hex(second)}`;
}
