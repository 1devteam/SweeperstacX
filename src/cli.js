import { Command } from 'commander';
import pc from 'picocolors';
import scanCmd from './commands/scan.js';
import reportCmd from './commands/report.js';
import patchCmd from './commands/patch.js';

const program = new Command();

program
  .name('sweepstacx')
  .description('Repo sweeper for modern dev stacks: scan, report, patch.')
  .version('0.1.4');

// scan
program
  .command('scan')
  .description('Scan the repository for obvious issues and cache results')
  .option('--path <dir>', 'target directory', '.')
  .option('--lang <auto|js|ts|py>', 'language focus (default: auto)', 'auto')
  .option('--verbose', 'verbose logging', false)
  .option('--quiet', 'suppress summary log line', false)
  .action(async (opts) => {
    try { await scanCmd(opts); }
    catch (e) { console.error(pc.red(`Scan failed: ${e?.message || e}`)); process.exitCode = 1; }
  });

// report
program
  .command('report')
  .description('Generate Markdown + JSON report from last scan')
  .option('--out <base>', 'output base filename (no extension)', 'sweepstacx-report')
  .option('--json', 'print JSON to stdout (no files written)', false)
  .action(async (opts) => {
    try { await reportCmd(opts); }
    catch (e) { console.error(pc.red(`Report failed: ${e?.message || e}`)); process.exitCode = 1; }
  });

// patch
program
  .command('patch')
  .description('Generate patch files from last scan; optionally apply')
  .option('--apply', 'apply edits directly to files', false)
  .option('--dry-run', 'show what would be applied', false)
  .action(async (opts) => {
    try { await patchCmd(opts); }
    catch (e) { console.error(pc.red(`Patch failed: ${e?.message || e}`)); process.exitCode = 1; }
  });

// check (scan + JSON to stdout)
program
  .command('check')
  .description('Scan + print JSON report to stdout (CI shortcut)')
  .option('--path <dir>', 'target directory', '.')
  .option('--lang <auto|js|ts|py>', 'language focus (default: auto)', 'auto')
  .option('--verbose', 'verbose logging', false)
  .action(async (opts) => {
    try {
      await scanCmd({ ...opts, quiet: true });
      await reportCmd({ json: true });
    } catch (e) {
      console.error(pc.red(`Check failed: ${e?.message || e}`));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
