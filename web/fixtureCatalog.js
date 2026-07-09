import { access, readFile } from "node:fs/promises";
import path from "node:path";

export async function loadMilestoneCatalog(options = {}) {
  const fixtureRoot = path.resolve(options.fixtureRoot || "test/fixtures/examples");
  const outputRoot = path.resolve(options.outputRoot || path.join(fixtureRoot, "output"));
  const milestone = JSON.parse(await readFile(path.join(fixtureRoot, "milestone-1.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(fixtureRoot, milestone.sourceManifest), "utf8"));
  const byId = new Map(manifest.cases.map((entry) => [entry.id, entry]));
  const missing = milestone.caseIds.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`Milestone fixture IDs missing from manifest: ${missing.join(", ")}`);
  if (new Set(milestone.caseIds).size !== milestone.caseIds.length) {
    throw new Error("Milestone fixture IDs must be unique");
  }

  return Promise.all(milestone.caseIds.map(async (id) => {
    const entry = byId.get(id);
    const tikztosvgSvgUrl = await artifactUrlIfPresent(outputRoot, "tikztosvg-svg", id, "svg");
    const tikztosvgGridSvgUrl = await artifactUrlIfPresent(outputRoot, "tikztosvg-grid-svg", id, "svg");
    return {
      id,
      title: entry.title,
      sourcePath: path.join(fixtureRoot, entry.source),
      sourceUrl: `/api/fixtures/${encodeURIComponent(id)}/source`,
      activeFigureId: entry.activeFigureId || null,
      features: entry.features || [],
      tikztosvgSvgUrl,
      tikztosvgGridSvgUrl,
      outputRoot
    };
  }));
}

async function artifactUrlIfPresent(outputRoot, directory, id, extension) {
  try {
    await access(path.join(outputRoot, directory, `${id}.${extension}`));
    return `/artifacts/${directory}/${encodeURIComponent(id)}.${extension}`;
  } catch {
    return null;
  }
}
