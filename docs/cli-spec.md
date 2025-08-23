# ⚙️ SweepstacX CLI v0.1 Spec

This document describes the CLI command surface and options for SweepstacX v0.1.

```yaml
Commands:
  sweepstacx scan
    - Scans current repo for issues
    - Outputs JSON + temp data cache

  sweepstacx report
    - Reads last scan results
    - Outputs `sweepstacx-report.md` + `sweepstacx-report.json`

  sweepstacx patch [--apply]
    - Generates `.patch` files from scan results
    - If --apply flag present, auto-applies patches via git

Options:
  --path <dir>       # target directory (default: .)
  --lang <js|ts|py>  # language focus (default: js/ts)
  --out <file>       # custom output path
  --dry-run          # show patch diff without applying
  --verbose          # detailed logs
