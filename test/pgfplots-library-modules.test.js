import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  dateplotLibrary,
  fillbetweenLibrary,
  groupplotsLibrary,
  patchplotsLibrary,
  knownPgfplotsLibraries,
  pgfplotsLibraryCatalog
} from "../src/pgfplots/index.js";

const OBSERVED_PGFPLOTS_LIBRARIES = ["dateplot", "fillbetween", "groupplots", "patchplots"];

test("keeps observed PGFPlots libraries in one module per library name", () => {
  assert.deepEqual(knownPgfplotsLibraries, OBSERVED_PGFPLOTS_LIBRARIES);
  for (const library of OBSERVED_PGFPLOTS_LIBRARIES) {
    assert.equal(
      existsSync(path.resolve("src", "pgfplots", "libraries", `${library}.js`)),
      true,
      `missing src/pgfplots/libraries/${library}.js`
    );
  }
  assert.equal(dateplotLibrary.name, "dateplot");
  assert.equal(fillbetweenLibrary.status, "partial");
  assert.equal(groupplotsLibrary.name, "groupplots");
  assert.equal(patchplotsLibrary.name, "patchplots");
  assert.equal(pgfplotsLibraryCatalog.dateplot.implementationStatus, "partial");
  assert.equal(pgfplotsLibraryCatalog.patchplots.implementationStatus, "partial");
});
