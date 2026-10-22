import assert from "node:assert/strict";
import test from "node:test";
import { fontManifest } from "../src/fonts/manifest.js";
import { fontAuditGate } from "../scripts/audit-font-rendering.js";

const selection = fontManifest.map(font => ({ query: font.family, selected: font.file, matches: true }));
const entry = { id: "probe", diagnostics: [], fallbackDiagnostics: [], fontErrors: [], browserErrors: [] };
const generation = { accepted: true, blockers: [] };

test("font audit never claims visual parity from successful artifact generation", () => {
  const gate = fontAuditGate(selection, [entry], generation);
  assert.equal(gate.accepted, true);
  assert.equal(gate.scope, "font-selection-and-artifact-generation");
  assert.equal(gate.visualAccepted, undefined);
});

test("font audit fails on missing probes, substituted fonts, or missing references", () => {
  assert.equal(fontAuditGate([], [entry], generation).accepted, false);
  assert.equal(fontAuditGate(selection, [], generation).accepted, false);
  assert.equal(fontAuditGate(selection, [entry], { accepted: false, blockers: ["missing native PNG"] }).accepted, false);
  const wrong = selection.map((font, index) => index ? font : { ...font, matches: false });
  assert.match(fontAuditGate(wrong, [entry], generation).blockers.join(";"), /Wrong font/);
});

test("font audit checks diagnostics in both renderers and browser/font failures", () => {
  for (const field of ["diagnostics", "fallbackDiagnostics", "fontErrors", "browserErrors"]) {
    const gate = fontAuditGate(selection, [{ ...entry, [field]: ["failure"] }], generation);
    assert.equal(gate.accepted, false, field);
  }
});

test("font audit rejects a browser glyph-position mismatch even when fonts load", () => {
  assert.equal(fontAuditGate(selection, [{ ...entry, mathPositionDiff: { accepted: false } }], generation).accepted, false);
});
