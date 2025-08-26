import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(_exec);

export default async function runDeps(opts = {}) {
  const path = opts.path || '.';
  try {
    const { stdout } = await exec(`npx --yes depcheck ${path} --json`);
    console.log(stdout.trim());
  } catch (e) {
    process.exitCode = 1;
    console.error(e.stdout || e.message || e);
  }
}
