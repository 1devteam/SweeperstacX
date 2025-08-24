// src/commands/patch.js
import { readJSON, ensureDir, writeText } from '../utils/fs.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_FILE = '.sweepstacx/scan.json';

export default async function patchCmd({ apply = false, dryRun = false }) {
  const scan = await readJSON(CACHE_FILE);
  if (!scan) throw new Error('No scan cache found. Run `sweepstacx scan` first.');
  await ensureDir('patches');

  // group tokens by file
  const byFile = new Map();
  for (const issue of scan.issues || []) {
    if (issue.type !== 'unused_import') continue;
    if (!byFile.has(issue.file)) byFile.set(issue.file, new Set());
    byFile.get(issue.file).add(issue.token);
  }

  const changes = [];
  let counter = 1;

  for (const [relPath, tokenSet] of byFile.entries()) {
    const absPath = join(scan.root, relPath);
    let src;
    try { src = await readFile(absPath, 'utf8'); } catch { continue; }

    const ext = relPath.split('.').pop()?.toLowerCase();
    let result;
    if (ext === 'py') {
      result = removeUnusedImportsPython(src, [...tokenSet]);
    } else if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
      result = removeUnusedImportsES(src, [...tokenSet]);
    } else {
      continue; // unsupported for patching
    }

    const { modified, edits } = result;
    if (!edits.length || modified === src) continue;

    const diffName = `patches/patch-${String(counter).padStart(3, '0')}.diff`;
    await writeText(diffName, makePseudoDiff(relPath, src, modified, edits));
    counter++;

    if (apply && !dryRun) await writeFile(absPath, modified, 'utf8');
    changes.push({ file: relPath, edits, diff: diffName });
  }

  if (!changes.length) {
    console.log('No patchable issues detected in this pass (v0.1).');
    return;
  }

  console.log(`Generated ${changes.length} patch file(s) in ./patches`);
  if (apply) console.log('Applied edits directly to files (revert with git checkout or git reset --hard).');
}

/* ---------------- JS/TS (ES imports) ---------------- */

function removeUnusedImportsES(source, tokensToRemove) {
  const edits = [];
  // multi-line tolerant import ... from 'x'; with optional "type" and trailing comments
  const re = /(^|\n)(?<indent>[ \t]*)import(?:\s+type)?\s+(?<spec>[\s\S]*?)\s+from\s+(?<from>['"][^'"]+['"])\s*;?[ \t]*(?:(?<comment>\/\/[^\n]*)|\/\*[\s\S]*?\*\/)?[ \t]*$/gm;

  let out = source, m;
  const replacements = [];

  while ((m = re.exec(out)) !== null) {
    const start = m.index + (m[1] ? m[1].length : 0);
    const end = re.lastIndex;
    const indent = m.groups.indent ?? '';
    const specRaw = m.groups.spec;
    const fromPart = m.groups.from;
    const trailing = m.groups.comment ? ` ${m.groups.comment}` : '';

    const spec = specRaw.replace(/\s+/g, ' ').trim();
    const parts = parseESImportSpec(spec);
    if (!parts) continue;

    const removed = new Set();
    for (const t of tokensToRemove) {
      if (parts.default === t) { parts.default = null; removed.add(t); }
      if (parts.namespace === t) { parts.namespace = null; removed.add(t); }
      const lenBefore = parts.named.length;
      parts.named = parts.named.filter(n => n.local !== t);
      if (parts.named.length !== lenBefore) removed.add(t);
    }
    if (!removed.size) continue;

    const rebuilt = buildESImport(indent, parts, fromPart, trailing);
    const replacement = rebuilt === null ? '' : rebuilt;
    replacements.push({ start, end, replacement, tokens: [...removed] });
  }

  if (!replacements.length) return { modified: source, edits };

  replacements.sort((a, b) => b.start - a.start);
  let text = out;
  for (const r of replacements) {
    text = text.slice(0, r.start) + r.replacement + text.slice(r.end);
    const line = text.slice(0, r.start).split('\n').length;
    edits.push({ line, action: r.replacement ? 'edit-line' : 'remove-line', tokens: r.tokens });
  }
  return { modified: text, edits };
}

function parseESImportSpec(spec) {
  let s = spec.trim(), def = null, ns = null, named = [];
  if (!s.startsWith('{') && !s.startsWith('*')) {
    const parts = s.split(',');
    def = (parts.shift() || '').trim() || null;
    s = parts.join(',').trim();
  }
  { const m = s.match(/\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/); if (m) ns = m[1]; }
  { const m = s.match(/\{([\s\S]*?)\}/);
    if (m) {
      const inner = m[1].split(',').map(x => x.trim()).filter(Boolean);
      for (const seg of inner) {
        const mm =
          seg.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/) ||
          seg.match(/^([A-Za-z_$][A-Za-z0-9_$]*)$/);
        if (!mm) continue;
        const imported = mm[2] ? mm[1] : mm[1];
        const local    = mm[2] ? mm[2] : mm[1];
        named.push({ imported, local });
      }
    }
  }
  if (!def && !ns && named.length === 0) return null;
  return { default: def, namespace: ns, named };
}

function buildESImport(indent, parts, fromPart, trailing) {
  const segs = [];
  if (parts.default) segs.push(parts.default);
  if (parts.namespace) segs.push(`* as ${parts.namespace}`);
  if (parts.named.length) {
    const inner = parts.named
      .map(n => (n.imported === n.local ? n.local : `${n.imported} as ${n.local}`))
      .join(', ');
    segs.push(`{ ${inner} }`);
  }
  if (!segs.length) return null;
  return `${indent}import ${segs.join(', ')} from ${fromPart};${trailing}\n`;
}

/* ---------------- Python imports ---------------- */

function removeUnusedImportsPython(source, tokensToRemove) {
  const edits = [];
  let out = source;

  // 1) from module import a, b as c, (multi-line allowed)
  const reFrom = /(^|\n)(?<indent>[ \t]*)from[ \t]+(?<mod>[A-Za-z0-9_\.]+)[ \t]+import[ \t]+(?<list>\([^\)]*\)|[^\n#]+)(?<trail>[^\n]*)/gm;
  out = replaceAll(out, reFrom, (match, prefix, indent, mod, list, trail, start, end) => {
    const { items, hadParens } = parsePyFromList(list);
    const beforeLen = items.length;
    const kept = items.filter(it => !tokensToRemove.includes(it.local));
    if (kept.length === beforeLen) return null; // no change
    if (!kept.length) {
      edits.push({ line: lineAt(out, start), action: 'remove-line', tokens: items.map(i => i.local) });
      return { text: '', start, end };
    }
    const rebuiltList = kept.map(it => (it.alias ? `${it.name} as ${it.alias}` : it.name)).join(', ');
    const listOut = hadParens ? `(${rebuiltList})` : rebuiltList;
    const text = `${prefix}${indent}from ${mod} import ${listOut}${trail}\n`;
    edits.push({ line: lineAt(out, start), action: 'edit-line', tokens: diffLocals(items, kept) });
    return { text, start, end };
  });

  // 2) import pkg[, pkg2 as alias] (single line; common case)
  const reImport = /(^|\n)(?<indent>[ \t]*)import[ \t]+(?<list>\([^\)]*\)|[^\n#]+)(?<trail>[^\n]*)/gm;
  out = replaceAll(out, reImport, (match, prefix, indent, list, trail, start, end) => {
    const { mods } = parsePyImportList(list);
    const beforeLen = mods.length;
    const kept = mods.filter(m => !tokensToRemove.includes(m.local));
    if (kept.length === beforeLen) return null;
    if (!kept.length) {
      edits.push({ line: lineAt(out, start), action: 'remove-line', tokens: mods.map(m => m.local) });
      return { text: '', start, end };
    }
    const rebuilt = kept.map(m => (m.alias ? `${m.module} as ${m.alias}` : m.module)).join(', ');
    const text = `${prefix}${indent}import ${rebuilt}${trail}\n`;
    edits.push({ line: lineAt(out, start), action: 'edit-line', tokens: diffLocals(mods, kept) });
    return { text, start, end };
  });

  return { modified: out, edits };
}

// helpers for Python
function parsePyFromList(listRaw) {
  const hadParens = /^\s*\(/.test(listRaw);
  const inner = listRaw.replace(/^\s*\(|\)\s*$/g, '');
  const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const seg of parts) {
    const m = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
    if (!m) continue;
    const name = m[1]; const alias = m[2] || null;
    items.push({ name, alias, local: alias || name });
  }
  return { items, hadParens };
}

function parsePyImportList(listRaw) {
  const inner = listRaw.replace(/^\s*\(|\)\s*$/g, '');
  const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
  const mods = [];
  for (const seg of parts) {
    const m = seg.match(/^([A-Za-z_][A-Za-z0-9_\.]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
    if (!m) continue;
    const module = m[1];
    const alias = m[2] || null;
    const local = alias || module.split('.')[0];
    mods.push({ module, alias, local });
  }
  return { mods };
}

// generic replacer for the two Python patterns (passes correct groups)
function replaceAll(text, regex, replacer) {
  let m; const changes = [];
  while ((m = regex.exec(text)) !== null) {
    const start = m.index;
    const end = regex.lastIndex;
    const prefix = m[1] || '';
    const indent = m.groups?.indent ?? '';
    const trail = m.groups?.trail ?? '';
    let out;

    if (Object.prototype.hasOwnProperty.call(m.groups || {}, 'mod')) {
      // from ... import ...
      out = replacer(m[0], prefix, indent, m.groups.mod, m.groups.list, trail, start, end);
    } else {
      // import ...
      out = replacer(m[0], prefix, indent, m.groups.list, trail, start, end);
    }

    if (!out) continue;
    changes.push(out);
  }
  if (!changes.length) return text;
  changes.sort((a, b) => b.start - a.start);
  let outText = text;
  for (const c of changes) outText = outText.slice(0, c.start) + c.text + outText.slice(c.end);
  return outText;
}

function lineAt(text, index) { return text.slice(0, index).split('\n').length; }
function diffLocals(beforeArr, afterArr) {
  const afterSet = new Set(afterArr.map(x => x.local));
  return beforeArr.map(x => x.local).filter(x => !afterSet.has(x));
}

/* ---------------- Diff preview ---------------- */

function makePseudoDiff(relPath, before, after, edits) {
  const header = [
    `diff -- (preview) ${relPath}`,
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    `# Edits: ${edits.map(e => `${e.action}@${e.line}[${e.tokens.join('|')}]`).join(', ')}`
  ].join('\n');
  return [header, `@@ ORIGINAL @@`, before, `@@ MODIFIED @@`, after, ``].join('\n');
}
