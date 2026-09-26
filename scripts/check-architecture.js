#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";

const SOURCE_ROOT = fileURLToPath(new URL("../src/", import.meta.url));
const DECORATION_MODULES = [
  "tikz/decorations/path.js",
  "tikz/decorations/pathGeometry.js",
  "tikz/libraries/decorations.pathmorphing.js",
  "tikz/libraries/decorations.pathreplacing.js",
  "tikz/libraries/decorations.fractals.js",
  "tikz/libraries/snakes.js"
];
const LEGACY_TEXT_EDGE = ["tikz/text.js", "frontend/latex-shell.js"];

export function readModuleGraph(root = SOURCE_ROOT) {
  if (!vm.SourceTextModule) throw new Error("Run with node --experimental-vm-modules.");
  const graph = new Map();
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith(".js")) {
        const file = path.relative(root, absolute).split(path.sep).join("/");
        // V8 parses imports and re-exports, including multiline declarations.
        // Modules are never linked or evaluated; comments and strings are not imports.
        const module = new vm.SourceTextModule(readFileSync(absolute, "utf8"), { identifier: file });
        graph.set(file, module.dependencySpecifiers.filter((specifier) => specifier.startsWith(".")).map(
          (specifier) => path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
        ));
      }
    }
  };
  visit(root);
  return graph;
}

export function findImportCycles(graph) {
  const visited = new Set();
  const active = [];
  const cycles = [];
  const visit = (file) => {
    const index = active.indexOf(file);
    if (index >= 0) {
      cycles.push([...active.slice(index), file]);
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.push(file);
    for (const dependency of graph.get(file) || []) visit(dependency);
    active.pop();
  };
  for (const file of graph.keys()) visit(file);
  return cycles;
}

export function checkModuleGraph(graph) {
  const errors = [];
  for (const [file, dependencies] of graph) {
    for (const dependency of dependencies) {
      if (!graph.has(dependency)) errors.push(`Missing module: ${file} -> ${dependency}`);
      if (/^(?:engine|frontend|scene|tikz|pgfplots|packages|extensions|tex)\//.test(file) && dependency.startsWith("renderers/")) {
        errors.push(`Semantic module imports a renderer: ${file} -> ${dependency}`);
      }
    }
  }

  const [legacyFrom, legacyTo] = LEGACY_TEXT_EDGE;
  const knownDebt = graph.get(legacyFrom)?.includes(legacyTo) ? [{
    from: legacyFrom, to: legacyTo,
    reason: "Legacy nested-axis text fallback re-enters the full frontend. Requires a separate lowering redesign."
  }] : [];
  const withoutLegacyEdge = new Map([...graph].map(([file, dependencies]) => [
    file, dependencies.filter((dependency) => file !== legacyFrom || dependency !== legacyTo)
  ]));
  for (const cycle of findImportCycles(withoutLegacyEdge)) errors.push(`Import cycle: ${cycle.join(" -> ")}`);

  for (const entry of DECORATION_MODULES) {
    if (!graph.has(entry)) {
      errors.push(`Missing decoration owner: ${entry}`);
      continue;
    }
    const visited = new Set();
    const visit = (file, route) => {
      if (visited.has(file)) return;
      visited.add(file);
      if (/^(?:frontend|renderers)\//.test(file) || file === "engine/evaluate.js") {
        errors.push(`Decoration geometry depends on orchestration: ${route.join(" -> ")}`);
        return;
      }
      for (const dependency of graph.get(file) || []) visit(dependency, [...route, dependency]);
    };
    visit(entry, [entry]);
  }
  return { ok: errors.length === 0, modules: graph.size, errors, knownDebt };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = checkModuleGraph(readModuleGraph());
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.ok) process.exitCode = 1;
}
