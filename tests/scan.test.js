import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SweepstacX scan', () => {
  it('generates a JSON report', () => {
    // Run against the sample project to produce a report
    execSync('node bin/sweepstacx scan --path examples/sample-project', { stdio: 'inherit' });
    expect(existsSync('sweepstacx-report.json')).toBe(true);

    const report = JSON.parse(readFileSync('sweepstacx-report.json', 'utf8'));
    expect(report?.meta?.tool).toBe('SweepstacX');
  });

  it('detects unused import in bad.js', () => {
    // Ensure a deterministic fixture exists for this test
    const fixtures = resolve(process.cwd(), 'tests/fixtures');
    mkdirSync(fixtures, { recursive: true });

    const badFile = resolve(fixtures, 'bad.js');
    writeFileSync(
      badFile,
      [
        "// bad.js — intentionally unused import for the test",
        "import { join } from 'node:path'",
        "export const ok = 1"
      ].join('\n'),
      'utf8'
    );

    // Scan JUST the tests folder to keep things focused / fast
    execSync('node bin/sweepstacx scan --path tests', { stdio: 'inherit' });

    const report = JSON.parse(readFileSync('sweepstacx-report.json', 'utf8'));

    // Find any unused import reported for a file named bad.js (abs or rel path)
    const unused = report.issues.find(
      (i) => i.type === 'unused_import' && /(^|[\\\/])bad\.js$/.test(i.file)
    );

    expect(unused).toBeDefined();
  });
});
