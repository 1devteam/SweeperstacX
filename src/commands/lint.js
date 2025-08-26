import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(_exec);

export default async function runLint(opts = {}) {
  const path = opts.path || '.';
  const fix = opts.fix ? '--fix' : '';
  try {
    await exec(`npx --yes eslint ${path} ${fix}`);
    console.log('ESLint: ok');
  } catch (e) {
    process.exitCode = 1;
    console.error(e.stdout || e.message || e);
  }
}
