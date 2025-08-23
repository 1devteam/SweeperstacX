"use strict";

// scripts/run-python-unused-imports.cjs
const fs = require("fs");
const path = require("path");
const plugin = require("../plugins/python-unused-imports/index.cjs");

function* walk(dir) {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if ([".git", "node_modules", "__pycache__"].includes(e.name)) continue;
        stack.push(p);
      } else if (plugin.supportsFile(p)) {
        yield p;
      }
    }
  }
}

function scan(root) {
  const results = [];
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, "utf8");
    const issues = plugin.scanFile({ path: file, content });
    if (issues.length) results.push(...issues);
  }
  return results;
}

const root = process.argv[2] || process.cwd();
const issues = scan(root);
if (!issues.length) {
  console.log("✅ No unused imports found.");
  process.exit(0);
}
for (const i of issues) {
  console.log(
    `${i.filePath}:${i.line}  [${i.ruleId}] ${i.message}\n   → ${i.suggestion}`
  );
}
process.exit(issues.length ? 1 : 0);
