"use strict";

// tests/python-unused-imports.test.cjs
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const plugin = require("../plugins/python-unused-imports/index.cjs");

test("detects unused imports in fixture", () => {
  const p = path.join(__dirname, "python-unused-imports.fixture.py");
  const content = fs.readFileSync(p, "utf8");
  const issues = plugin.scanFile({ path: p, content });
  const names = issues.map((i) => i.message.match(/'(.+?)'/)[1]).sort();
  assert.deepStrictEqual(names, ["c", "defaultdict", "floor", "system"].sort());
});
