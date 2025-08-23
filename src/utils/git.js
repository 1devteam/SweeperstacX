import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

export async function applyPatch(patchPath) {
  try {
    await exec(`git apply "${patchPath}"`);
  } catch (e) {
    // Non-fatal in v0.1 — patches are illustrative. Log and continue.
    console.warn(`[warn] git apply failed for ${patchPath}: ${e?.stderr || e?.message || e}`);
  }
}
