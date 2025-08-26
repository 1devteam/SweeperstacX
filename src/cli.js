import { Command } from 'commander';
import runScan from './commands/scan.js';
import runReport from './commands/report.js';
import runPatch from './commands/patch.js';

import runCheck from './commands/check.js';
import runLint from './commands/lint.js';
import runDeps from './commands/deps.js';
import runDupes from './commands/dupes.js';
import runComplexity from './commands/complexity.js';
import runFuzz from './commands/fuzz.js';

const program = new Command();
program
  .name('sweepstacx')
  .description('Repo sweeper for modern dev stacks: scan, report, patch.')
  .version('0.1.7');

program
  .command('scan')
  .option('--path <path>', 'path to scan', '.')
  .option('--lang <lang>', 'language hint (js, ts)', 'js')
  .option('--config <file>', 'config file (.sweeperc.json)')
  .action(async (opts) => { await runScan(opts); });

program
  .command('report')
  .option('--out <base>', 'basename for outputs (json/md)', 'sweepstacx-report')
  .action(async (opts) => { await runReport(opts); });

program
  .command('patch')
  .option('--apply', 'apply generated patches with git apply', false)
  .action(async (opts) => { await runPatch(opts); });

program
  .command('check')
  .description('stats-only CI mode')
  .option('--path <path>', 'path to scan', '.')
  .option('--config <file>', 'config file (.sweeperc.json)')
  .action(async (opts) => { await runCheck(opts); });

program
  .command('lint')
  .option('--path <path>', 'path to lint', '.')
  .option('--fix', 'apply eslint --fix', false)
  .action(async (opts) => { await runLint(opts); });

program
  .command('deps')
  .option('--path <path>', 'path to analyze', '.')
  .action(async (opts) => { await runDeps(opts); });

program
  .command('dupes')
  .option('--path <path>', 'path to analyze', '.')
  .option('--min-lines <n>', 'minimum duplicate block lines', '5')
  .action(async (opts) => { await runDupes(opts); });

program
  .command('complexity')
  .option('--path <path>', 'path to analyze', '.')
  .action(async (opts) => { await runComplexity(opts); });

program
  .command('fuzz')
  .argument('<file>', 'target JS file to fuzz')
  .option('--timeout <ms>', 'timeout per case (ms)', '5000')
  .action(async (file, opts) => { await runFuzz(file, opts); });

program.parseAsync(process.argv);
