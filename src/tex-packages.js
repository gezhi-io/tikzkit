import { parseOptions, splitTopLevel } from "./options.js";
import { texPackageCatalog } from "./packages/index.js";

export const TEX_PACKAGE_SUPPORT = texPackageCatalog;

export function resolveTexPackage(name, options = {}) {
  const support = texPackageCatalog[name];
  return {
    name,
    options,
    status: support?.status || "unsupported",
    implementedBy: support?.implementedBy || null,
    features: support ? [...(support.features || [])] : [],
    requires: support ? [...(support.requires || [])] : [],
    localSource: support?.localSource || null,
    localDoc: support?.localDoc || null,
    notes: support?.notes || ""
  };
}

export function resolveTexPackages(packages = []) {
  return packages.map((pkg) => (typeof pkg === "string" ? resolveTexPackage(pkg) : resolveTexPackage(pkg.name, pkg.options || {})));
}

export function collectTexPackages(source) {
  const packages = [];
  const pattern = /\\usepackage(?:\[([^\]]*)\])?\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(String(source)))) {
    for (const rawName of splitTopLevel(match[2], ",")) {
      const name = rawName.trim();
      if (!name || packages.some((pkg) => pkg.name === name)) continue;
      packages.push(resolveTexPackage(name, match[1] ? parseOptions(match[1]) : {}));
    }
  }
  return packages;
}
