import fg from 'fast-glob';
import pc from 'picocolors';
import { writeJSON, ensureDir, writeText, exists } from '../utils/fs.js';
import { relative, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const CACHE_DIR = '.sweepstacx';
const CACHE_FILE = `${CACHE_DIR}/scan.json`;

export default async function scanCmd({ path = '.', lang = 'auto', verbose = false, quiet = false }) {
  const root = resolve(process.cwd(), path);

  // Load optional ignore config
  const cfg = await loadConfig(root);
  const userIgnores = Array.isArray(cfg.ignore) ? cfg.ignore : [];
  const baseIgnore = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/.git/**', '**/.venv/**', '**/venv/**', '**/__pycache__/**'];
  const ignore = [...baseIgnore, ...userIgnores];

  // Decide which extensions to scan
  const { exts, label } = await decideExtensions(root, lang, ignore);

  if (verbose) {
    console.log(pc.dim(`Scanning ${root} (lang=${label}, exts=${exts.join(',')})`));
    if (userIgnores.length) console.log(pc.dim(`Ignoring: ${userIgnores.join(', ')}`));
  }

  // Discover files
  const patterns = exts.map((e) => `**/*.${e}`);
  const files = await fg(patterns, { cwd: root, ignore, dot: false, absolute: true });

  // Stats bucket
  const stats = {
    files_scanned: files.length,
    dead_files: 0,
    unused_imports: 0,
    duplicate_blocks: 0,
    stale_configs: 0,
    loc_removed: 0
  };

  const issues = [];
  const tinyFileFingerprints = new Map();

  // Per-file analysis
  for (const f of files) {
    const rel = relative(root, f);
    let text = '';
    try { text = await readFile(f, 'utf8'); } catch { continue; }

    if (isJsTs(rel)) {
      // --- JS/TS: Improved unused-import detection ---
      const importRegex = /^import\s+(.+?)\s+from\s+['"][^'"]+['"];?/gm;
      const importMatches = [...text.matchAll(importRegex)];
      for (const m of importMatches) {
        const full = m[0];
        const spec = m[1].trim();
        const idents = extractJsTsLocalIdents(spec);
        if (!idents.length) continue;

        const body = text.replace(full, ''); // exclude this import line
        for (const ident of idents) {
          const used = new RegExp(`\\b${escapeRegex(ident)}\\b`).test(body);
          if (!used) {
            stats.unused_imports++;
            issues.push({ type: 'unused_import', file: rel, token: ident });
          }
        }
      }
    }

    if (isPy(rel)) {
      // --- Python: basic unused-import detection ---
      const { locals, body } = extractPythonLocalsAndBody(text);
      for (const name of locals) {
        // Skip the common convention "_" wildcard for throwaway
        if (name === '_') continue;
        const used = new RegExp(`\\b${escapeRegex(name)}\\b`).test(body);
        if (!used) {
          stats.unused_imports++;
          issues.push({ type: 'unused_import', file: rel, token: name });
        }
      }
    }

    // --- Tiny duplicate heuristic (language-agnostic) ---
    if (text.length > 0 && text.length <= 200) {
      const key = `${rel}:${hashStr(text)}`;
      if (tinyFileFingerprints.has(key)) {
        stats.duplicate_blocks++;
        issues.push({ type: 'duplicate_block', file: rel, duplicate_of: tinyFileFingerprints.get(key) });
      } else {
        tinyFileFingerprints.set(key, rel);
      }
    }
  }

  // Cache payload
  const payload = {
    repo: root.split('/').pop(),
    root,
    scanned_at: new Date().toISOString(),
    stats,
    issues,
    patches: []
  };

  await ensureDir(CACHE_DIR);
  await writeJSON(CACHE_FILE, payload);
  await writeText(`${CACHE_DIR}/.last`, String(Date.now()));

  if (!quiet) {
    console.log(
      pc.green(`✓ Scan complete.`),
      pc.dim(`files=${stats.files_scanned}, unused_imports=${stats.unused_imports}, duplicates=${stats.duplicate_blocks}`)
    );
  }
  if (!(await exists(CACHE_FILE))) throw new Error('Failed to write scan cache.');
}

/* ---------------- helpers ---------------- */

async function loadConfig(root) {
  try {
    const raw = await readFile(resolve(root, '.sweepstacx.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return {}; }
}

async function decideExtensions(root, lang, ignore) {
  const jsTs = ['js', 'jsx', 'ts', 'tsx'];
  const py = ['py'];

  if (lang && lang !== 'auto') {
    if (lang === 'py') return { exts: py, label: 'py' };
    if (lang === 'js' || lang === 'ts') return { exts: jsTs, label: 'js/ts' };
  }

  const [jsHits, pyHits] = await Promise.all([
    fg(jsTs.map(e => `**/*.${e}`), { cwd: root, ignore, dot: false, onlyFiles: true }),
    fg(py.map(e => `**/*.${e}`),   { cwd: root, ignore, dot: false, onlyFiles: true })
  ]);

  const hasJs = jsHits.length > 0;
  const hasPy = pyHits.length > 0;

  if (hasJs && hasPy) return { exts: [...jsTs, ...py], label: 'js/ts+py' };
  if (hasJs) return { exts: jsTs, label: 'js/ts' };
  if (hasPy) return { exts: py, label: 'py' };

  return { exts: jsTs, label: 'js/ts (fallback)' };
}

function isJsTs(path) { return /\.(m?js|jsx|ts|tsx)$/.test(path); }
function isPy(path)   { return /\.py$/.test(path); }

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0; return (h >>> 0).toString(16); }

/* ---------- JS/TS import parsing ---------- */

function extractJsTsLocalIdents(spec) {
  let s = spec.trim();
  const idents = [];

  // Default import
  if (!s.startsWith('{') && !s.startsWith('*')) {
    const parts = s.split(',');
    const def = parts.shift()?.trim();
    if (def) idents.push(def);
    s = parts.join(',').trim();
  }

  // Namespace import: * as ns
  const nsMatch = s.match(/\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (nsMatch) idents.push(nsMatch[1]);

  // Named imports: { a, b as bb }
  const namedMatch = s.match(/\{([\s\S]*?)\}/);
  if (namedMatch) {
    const inner = namedMatch[1].split(',').map(p => p.trim()).filter(Boolean);
    for (const seg of inner) {
      const m = seg.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/)
            || seg.match(/^([A-Za-z_$][A-Za-z0-9_$]*)$/);
      if (!m) continue;
      const local = m[2] || m[1];
      idents.push(local);
    }
  }
  return idents;
}

/* ---------- Python import parsing ---------- */
/**
 * Very lightweight parser to extract local names introduced by imports:
 *  - import a
 *  - import a as b
 *  - import a, b as bb
 *  - from pkg.mod import a, b as bb
 *  - from pkg.mod import (
 *        a,
 *        b as bb,
 *    )
 * Returns { locals: Set<string>, body: string-without-import-lines }
 * Note: heuristic (regex-based); good for 80–90% of real-world cases.
 */
function extractPythonLocalsAndBody(text) {
  const locals = new Set();
  const lines = text.split('\n');
  const keep = [];
  let inMultiFrom = false; // inside "from X import ( ... )" block

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Strip comments to reduce false matches
    const stripped = line.replace(/#.*/, '');

    // Multi-line "from ... import (" handling
    if (inMultiFrom) {
      // collect names until a closing ')'
      const end = stripped.includes(')');
      collectPythonImportedNames(stripped.replace(')', ''), locals);
      if (end) inMultiFrom = false;
      // do NOT push import lines to body
      continue;
    }

    // Single-line: import a, b as bb
    const imp = stripped.match(/^\s*import\s+(.+)\s*$/);
    if (imp) {
      collectPythonImportClause(imp[1], locals);
      continue; // skip import line from body
    }

    // Single-line: from pkg import a, b as bb
    const fromImp = stripped.match(/^\s*from\s+[A-Za-z0-9_\.]+\s+import\s+(.+)\s*$/);
    if (fromImp) {
      const clause = fromImp[1].trim();
      if (clause.startsWith('(') && !clause.includes(')')) {
        inMultiFrom = true;
        const inner = clause.replace('(', '');
        collectPythonImportedNames(inner, locals);
        continue;
      }
      collectPythonImportedNames(clause, locals);
      continue;
    }

    // keep non-import lines for usage checks
    keep.push(line);
  }

  const body = keep.join('\n');
  return { locals: Array.from(locals), body };
}

// Parses "a, b as bb, c" from either "import" or "from ... import ..."
function collectPythonImportedNames(clause, outSet) {
  const parts = clause.split(',').map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    // handle trailing comments removed earlier
    const seg = p.replace(/\s+#.*/, '').trim();
    if (!seg) continue;

    // a as b
    const asMatch = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
    if (asMatch) {
      const local = asMatch[3] || asMatch[1];
      outSet.add(local);
      continue;
    }

    // fallback: bare identifier
    const bare = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
    if (bare) {
      outSet.add(bare[1]);
    }
  }
}

// Parses the clause of "import a, b as bb"
function collectPythonImportClause(clause, outSet) {
  collectPythonImportedNames(clause, outSet);
}

