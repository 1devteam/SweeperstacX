import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(_exec);

export default async function runDupes(opts = {}) {
  const path = opts.path || '.';
  const minLines = Number(opts.minLines || 5);
  try {
    const { stdout } = await exec(`npx --yes jscpd ${path} --min-lines ${minLines} --reporters json --silent`);
    console.log(stdout.trim());
  } catch (e) {
    process.exitCode = 1;
    console.error(e.stdout || e.message || e);
  }
}
