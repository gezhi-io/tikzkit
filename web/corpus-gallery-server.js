import {
  F0NZIE_EXPECTED_TEX_COUNT,
  F0NZIE_REPOSITORY_URL,
  F0NZIE_ROOT,
  hasF0nzieCorpus,
  loadF0nzieCases
} from "../scripts/f0nzie-real-cases.js";
import {
  JANOSH_EXPECTED_TEX_COUNT,
  JANOSH_REPOSITORY_URL,
  JANOSH_ROOT,
  hasJanoshCorpus,
  loadJanoshCases
} from "../scripts/janosh-real-cases.js";
import {
  WALMES_EXPECTED_PGF_COUNT,
  WALMES_REPOSITORY_URL,
  WALMES_ROOT,
  hasWalmesCorpus,
  loadWalmesCases
} from "../scripts/walmes-real-cases.js";
import {
  CIRCUITIKZ_EXPECTED_SNIPPET_COUNT,
  CIRCUITIKZ_REPOSITORY_URL,
  CIRCUITIKZ_ROOT,
  hasCircuitikzCorpus,
  loadCircuitikzCases
} from "../scripts/circuitikz-real-cases.js";
import {
  STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT,
  STRUCTURAL_ANALYSIS_REPOSITORY_URL,
  STRUCTURAL_ANALYSIS_ROOT,
  hasStructuralAnalysisCorpus,
  loadStructuralAnalysisCases
} from "../scripts/structural-analysis-real-cases.js";
import { REAL_GALLERY_CASES, REAL_GALLERY_SUMMARY } from "./real-gallery-data.js";

const SOURCE_CORPORA = [
  {
    id: "janosh",
    label: "janosh/diagrams",
    origin: "janosh/diagrams",
    root: JANOSH_ROOT,
    expectedCount: JANOSH_EXPECTED_TEX_COUNT,
    repositoryUrl: JANOSH_REPOSITORY_URL,
    hasCorpus: hasJanoshCorpus,
    loadCases: loadJanoshCases
  },
  {
    id: "f0nzie",
    label: "f0nzie/tikz_favorites",
    origin: "f0nzie/tikz_favorites",
    root: F0NZIE_ROOT,
    expectedCount: F0NZIE_EXPECTED_TEX_COUNT,
    repositoryUrl: F0NZIE_REPOSITORY_URL,
    hasCorpus: hasF0nzieCorpus,
    loadCases: loadF0nzieCases
  },
  {
    id: "walmes",
    label: "walmes/Tikz",
    origin: "walmes/Tikz",
    root: WALMES_ROOT,
    expectedCount: WALMES_EXPECTED_PGF_COUNT,
    repositoryUrl: WALMES_REPOSITORY_URL,
    hasCorpus: hasWalmesCorpus,
    loadCases: loadWalmesCases
  },
  {
    id: "circuitikz",
    label: "circuitikz/circuitikz",
    origin: "circuitikz/circuitikz",
    root: CIRCUITIKZ_ROOT,
    expectedCount: CIRCUITIKZ_EXPECTED_SNIPPET_COUNT,
    repositoryUrl: CIRCUITIKZ_REPOSITORY_URL,
    hasCorpus: hasCircuitikzCorpus,
    loadCases: loadCircuitikzCases
  },
  {
    id: "structural-analysis",
    label: "hackl/TikZ-StructuralAnalysis",
    origin: "hackl/TikZ-StructuralAnalysis",
    root: STRUCTURAL_ANALYSIS_ROOT,
    expectedCount: STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT,
    repositoryUrl: STRUCTURAL_ANALYSIS_REPOSITORY_URL,
    hasCorpus: hasStructuralAnalysisCorpus,
    loadCases: loadStructuralAnalysisCases
  }
];

export function listWebCorpora() {
  return [
    {
      id: "core",
      label: "Core gallery",
      origin: "merged core gallery",
      root: "web/real-gallery-data.js + work/* corpora",
      expectedCount: expectedMergedCoreCount(),
      repositoryUrl: "",
      available: true,
      merged: true,
      dedupe: "source"
    }
  ];
}

export async function loadWebCorpus(id) {
  if (id === "core") return loadMergedCoreGallery();
  const corpus = SOURCE_CORPORA.find((item) => item.id === id);
  if (!corpus) return null;
  if (!corpus.hasCorpus()) {
    return {
      id: corpus.id,
      label: corpus.label,
      origin: corpus.origin,
      root: corpus.root,
      expectedCount: corpus.expectedCount,
      repositoryUrl: corpus.repositoryUrl,
      available: false,
      cases: []
    };
  }
  const cases = await corpus.loadCases();
  return {
    id: corpus.id,
    label: corpus.label,
    origin: corpus.origin,
    root: corpus.root,
    expectedCount: corpus.expectedCount,
    repositoryUrl: corpus.repositoryUrl,
    available: true,
    cases
  };
}

export function normalizedGallerySourceKey(source = "") {
  return String(source)
    .replace(/\r\n?/g, "\n")
    .replace(/%[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function expectedMergedCoreCount() {
  return (
    REAL_GALLERY_CASES.length +
    SOURCE_CORPORA.reduce((sum, corpus) => sum + (corpus.hasCorpus() ? corpus.expectedCount : 0), 0)
  );
}

async function loadMergedCoreGallery() {
  const sources = [
    {
      id: "core-static",
      label: "Generated core gallery",
      origin: "core gallery",
      available: true,
      caseCount: REAL_GALLERY_CASES.length
    }
  ];
  const rawCases = [...REAL_GALLERY_CASES];

  for (const corpus of SOURCE_CORPORA) {
    if (!corpus.hasCorpus()) {
      sources.push({
        id: corpus.id,
        label: corpus.label,
        origin: corpus.origin,
        available: false,
        caseCount: 0
      });
      continue;
    }
    const cases = await corpus.loadCases();
    sources.push({
      id: corpus.id,
      label: corpus.label,
      origin: corpus.origin,
      available: true,
      caseCount: cases.length
    });
    rawCases.push(...cases);
  }

  const cases = dedupeGalleryCases(rawCases);
  const origins = [...new Set(cases.map((item) => item.origin))];
  return {
    id: "core",
    label: "Core gallery",
    origin: "merged core gallery",
    root: "web/real-gallery-data.js + work/* corpora",
    expectedCount: expectedMergedCoreCount(),
    repositoryUrl: "",
    available: true,
    merged: true,
    dedupe: "source",
    summary: {
      ...REAL_GALLERY_SUMMARY,
      caseCount: cases.length,
      rawCaseCount: rawCases.length,
      duplicatesRemoved: rawCases.length - cases.length,
      origins,
      sources
    },
    cases
  };
}

function dedupeGalleryCases(cases) {
  const seen = new Set();
  const unique = [];
  for (const item of cases) {
    const key = normalizedGallerySourceKey(item.source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
