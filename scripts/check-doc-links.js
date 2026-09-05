#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

export function findBrokenDocLinks(root = REPO_ROOT) {
  const available = listAvailableFiles(root);
  const markdownFiles = [...available]
    .filter((file) => file === "README.md" || (file.startsWith("docs/") && file.endsWith(".md")))
    .sort();
  const broken = [];

  for (const file of markdownFiles) {
    const source = readFileSync(path.join(root, file), "utf8");
    const searchable = maskCode(source);
    const targets = [
      ...matchTargets(searchable, /!?\[[^\]\n]*\]\(([^)\n]+)\)/g),
      ...matchTargets(searchable, /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)
    ];

    for (const { target, index } of targets) {
      const cleanTarget = normalizeTarget(target);
      if (!cleanTarget) continue;

      const repositoryTarget = repositoryPathFromPublicUrl(cleanTarget);
      if (repositoryTarget) {
        const resolved = normalizeRepoPath(repositoryTarget);
        if (!isAvailable(resolved, available)) {
          broken.push({ file, line: lineAt(source, index), target: cleanTarget, resolved });
        }
        continue;
      }

      if (isExternalTarget(cleanTarget)) continue;

      const resolved = normalizeRepoPath(path.join(path.dirname(file), cleanTarget));
      if (resolved.startsWith("../") || !isAvailable(resolved, available)) {
        broken.push({ file, line: lineAt(source, index), target: cleanTarget, resolved });
      }
    }
  }

  return broken;
}

export function repositoryPathFromPublicUrl(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (
    url.hostname === "github.com" &&
    segments[0] === "gezhi-io" &&
    segments[1] === "tikzkit" &&
    segments[2] === "blob" &&
    segments[3] === "main"
  ) {
    return segments.slice(4).join("/");
  }

  if (
    url.hostname === "raw.githubusercontent.com" &&
    segments[0] === "gezhi-io" &&
    segments[1] === "tikzkit" &&
    segments[2] === "main"
  ) {
    return segments.slice(3).join("/");
  }

  return null;
}

function listAvailableFiles(root) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  );
  return new Set(output.split(/\r?\n/).filter(Boolean).map(normalizeRepoPath));
}

function maskCode(source) {
  return source
    .replace(/```[\s\S]*?```/g, preserveLines)
    .replace(/~~~[\s\S]*?~~~/g, preserveLines)
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
}

function preserveLines(match) {
  return match.replace(/[^\n]/g, " ");
}

function matchTargets(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => ({ target: match[1], index: match.index }));
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.includes(">")) {
    target = target.slice(1, target.indexOf(">"));
  } else {
    target = target.replace(/\s+["'][^"']*["']\s*$/, "");
  }
  target = target.split("#", 1)[0].split("?", 1)[0];
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function isExternalTarget(target) {
  return !target || target.startsWith("#") || /^(?:[a-z]+:|\/\/)/i.test(target);
}

function normalizeRepoPath(value) {
  return path.normalize(value).split(path.sep).join("/").replace(/^\.\//, "");
}

function isAvailable(target, available) {
  if (available.has(target)) return true;
  const directory = target.replace(/\/$/, "") + "/";
  return [...available].some((file) => file.startsWith(directory));
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function run() {
  const broken = findBrokenDocLinks();
  if (!broken.length) {
    console.log("Documentation links are valid.");
    return;
  }

  console.error("Broken or untracked documentation links:");
  for (const item of broken) {
    console.error(`- ${item.file}:${item.line} ${item.target} -> ${item.resolved}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) run();
