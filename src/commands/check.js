import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig } from '../utils/config.js';

const exec = promisify(_exec);

export default async function runCheck(opts = {}) {
  const path = opts.path || '.';
  const outBase = '.sweepstacx-ci';
  const jsonPath = resolve(process.cwd(), `${outBase}.json`);
  const cfg = await loadConfig(path, opts.config);

  try {
    // Run your existing CLI flow to guarantee consistency
    await exec(`node bin/sweepstacx scan --path ${shellArg(path)}`);
    await exec(`node bin/sweepstacx report --out ${shellArg(outBase)}`);

    const raw = await readFile(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    const stats = data.stats || {};

    // Print stats-only JSON for CI consumption
    process.stdout.write(JSON.stringify({ stats }, null, 2) + '\n');

    // Threshold gate (simple first pass)
    let fail = false;
    if (typeof stats.unused_imports === 'number' && stats.unused_imports > cfg.deps.unused) fail = true;
    if (typeof stats.dead_files === 'number' && stats.dead_files > 0) fail = true;
    if (typeof stats.duplicate_blocks === 'number' && stats.duplicate_blocks > 0) fail = true;
    if (typeof stats.max_complexity === 'number' && stats.max_complexity > cfg.complexity.maxFunction) fail = true;

    // Clean up temp artifacts (keep if you want)
    try { await rm(jsonPath); } catch {}

    process.exit(fail ? 1 : 0);
  } catch (err) {
    console.error('check failed:', err?.message || err);
    process.exit(2);
  }
}

function shellArg(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}
