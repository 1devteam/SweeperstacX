"use strict";

// plugins/python-unused-imports/index.cjs
// Minimal, fast Python unused import detector (pure JS, no deps).
// Heuristic approach: parses import lines, strips strings/comments/imports,
// then checks for identifier presence elsewhere in the file.

const RULE_ID = "python-unused-import";

function splitImportsList(list) {
  // split on commas but ignore those inside parentheses
  const out = [];
  let buf = "";
  let depth = 0;
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseImports(lines) {
  // Returns { aliases: Map<alias, {line, raw, kind, original}>, importLineIdx:Set<number> }
  const aliases = new Map();
  const importLineIdx = new Set();

  const importRe = /^\s*import\s+(.+)$/;                       // e.g. import os, sys as system
  const fromImportRe = /^\s*from\s+([.\w]+)\s+import\s+(.+)$/; // e.g. from math import sqrt as s

  lines.forEach((line, i) => {
    let m;
    if ((m = line.match(importRe))) {
      importLineIdx.add(i);
      const list = splitImportsList(m[1]);
      for (const tok of list) {
        const mm = tok.match(/^([\w.]+)(?:\s+as\s+(\w+))?$/);
        if (!mm) continue;
        const original = mm[1];
        const alias = mm[2] || original.split(".")[0]; // 'os.path' → 'os'
        aliases.set(alias, {
          line: i + 1,
          raw: line,
          kind: "import",
          original,
        });
      }
    } else if ((m = line.match(fromImportRe))) {
      importLineIdx.add(i);
      const module = m[1];
      const list = splitImportsList(m[2]);
      if (list.length === 1 && list[0] === "*") {
        // can't decide usage safely; skip star-import
        return;
      }
      for (const tok of list) {
        const mm = tok.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
        if (!mm) continue;
        const name = mm[1];
        const alias = mm[2] || name;
        aliases.set(alias, {
          line: i + 1,
          raw: line,
          kind: "from",
          original: `${module}.${name}`,
        });
      }
    }
  });

  return { aliases, importLineIdx };
}

function stripStringsAndComments(text) {
  // Remove triple-quoted strings, single/double quoted strings, and # comments
  let s = text
    .replace(/'''[\s\S]*?'''/g, " ")
    .replace(/"""[\s\S]*?"""/g, " ")
    .replace(/#.*$/gm, " ")
    .replace(/'(?:\\.|[^'\\])*'/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, " ");
  return s;
}

function buildIdentifierRegex(name) {
  // \bNAME\b matches NAME boundaries; good enough for usage checks
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
}

function scanFile({ path, content }) {
  const lines = content.split(/\r?\n/);
  const { aliases, importLineIdx } = parseImports(lines);

  if (aliases.size === 0) return [];

  // Remove import lines from the search domain
  const bodyWithoutImports = lines
    .filter((_, idx) => !importLineIdx.has(idx))
    .join("\n");

  const searchSpace = stripStringsAndComments(bodyWithoutImports);

  const issues = [];
  for (const [alias, meta] of aliases.entries()) {
    const re = buildIdentifierRegex(alias);
    if (!re.test(searchSpace)) {
      // Unused import detected
      const message = `Unused import '${alias}' from '${meta.original}'`;
      issues.push({
        ruleId: RULE_ID,
        message,
        severity: "warn",
        filePath: path,
        line: meta.line,
        suggestion:
          meta.kind === "import"
            ? `Remove '${alias}' from: ${meta.raw.trim()}`
            : `Remove '${alias}' from: ${meta.raw.trim()}`,
      });
    }
  }
  return issues;
}

module.exports = {
  id: "python-unused-imports",
  meta: {
    description: "Detects unused Python imports",
    version: "0.1.0",
  },
  supportsFile(filePath) {
    return /\.py$/i.test(filePath);
  },
  scanFile,
};
