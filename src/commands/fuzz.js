import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(_exec);

export default async function runFuzz(target, opts = {}) {
  if (!target) {
    console.error('Usage: sweepstacx fuzz <file.js>');
    process.exit(2);
  }
  const timeout = Number(opts.timeout || 5000);
  try {
    await exec(`npx --yes jsfuzz ${target} --timeout ${timeout}`);
    console.log('Fuzz: completed');
  } catch (e) {
    process.exitCode = 1;
    console.error(e.stdout || e.message || e);
  }
}
