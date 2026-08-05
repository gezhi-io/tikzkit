import assert from "node:assert/strict";
import test from "node:test";

import { diagnosticGroups, parseEditorLocation } from "../web/tikzEditor.js";

test("parseEditorLocation accepts one-based diagnostic locations", () => {
  assert.deepEqual(parseEditorLocation("8:17"), { line: 8, column: 17 });
  assert.deepEqual(parseEditorLocation("5"), { line: 5, column: 1 });
  assert.equal(parseEditorLocation("0:3"), null);
  assert.equal(parseEditorLocation("line 4"), null);
});

test("diagnosticGroups combines messages by line and keeps the strongest severity", () => {
  const groups = diagnosticGroups([
    { location: "4:3", severity: "warning", code: "unknown-option", message: "option ignored" },
    { location: "4:9", severity: "error", code: "parse-error", message: "expected coordinate" },
    { location: "9", severity: "info", code: "note", message: "using fallback" },
    { location: "bad", severity: "error", code: "ignored", message: "no location" },
  ]);

  assert.deepEqual([...groups.entries()], [
    [4, {
      severity: "error",
      messages: [
        "unknown-option: option ignored",
        "parse-error: expected coordinate",
      ],
    }],
    [9, {
      severity: "info",
      messages: ["note: using fallback"],
    }],
  ]);
});
