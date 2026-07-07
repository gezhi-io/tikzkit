import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { capabilityMatrix, featureIds, featureRegistries, SUPPORT_STATUS } from "../src/capabilities/index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("capability matrix has exact coverage for every feature id", () => {
  assert.deepEqual(Object.keys(capabilityMatrix).sort(), [...featureIds].sort());

  for (const featureId of featureIds) {
    const row = capabilityMatrix[featureId];
    assert.equal(row.id, featureId);
    assert.ok(SUPPORT_STATUS.includes(row.parser), `${featureId} has invalid parser status`);
    assert.ok(SUPPORT_STATUS.includes(row.semantic), `${featureId} has invalid semantic status`);
    assert.ok(SUPPORT_STATUS.includes(row.svg), `${featureId} has invalid svg status`);
  }
});

test("capability registries only reference known matrix rows", () => {
  const known = new Set(featureIds);
  const registered = new Set();

  for (const [registryName, registryFeatureIds] of Object.entries(featureRegistries)) {
    assert.ok(Array.isArray(registryFeatureIds), `${registryName} registry must be an array`);
    for (const featureId of registryFeatureIds) {
      assert.ok(known.has(featureId), `${registryName} registry references unknown feature ${featureId}`);
      registered.add(featureId);
    }
  }

  for (const featureId of featureIds) {
    const row = capabilityMatrix[featureId];
    const implementedSomewhere = row.parser !== "none" || row.semantic !== "none" || row.svg !== "none";
    if (implementedSomewhere) {
      assert.ok(registered.has(featureId), `${featureId} has implementation status but is missing from registries`);
    }
  }
});

test("capability rows reference existing owner modules and fixtures", () => {
  for (const featureId of featureIds) {
    const row = capabilityMatrix[featureId];
    assert.ok(Array.isArray(row.modules), `${featureId} modules must be an array`);
    assert.ok(row.modules.length > 0, `${featureId} must list owner modules`);
    assert.ok(Array.isArray(row.fixtures), `${featureId} fixtures must be an array`);
    assert.ok(row.fixtures.length > 0, `${featureId} must list fixtures`);

    for (const modulePath of row.modules) {
      const absolutePath = resolve(repoRoot, modulePath);
      assert.ok(existsSync(absolutePath), `${featureId} owner module does not exist: ${modulePath}`);
      assert.ok(statSync(absolutePath).isFile(), `${featureId} owner module is not a file: ${modulePath}`);
    }

    for (const fixturePath of row.fixtures) {
      const absolutePath = resolve(repoRoot, fixturePath);
      assert.ok(existsSync(absolutePath), `${featureId} fixture does not exist: ${fixturePath}`);
    }
  }
});
