# SweepstacX Demo

This demo shows how **SweepstacX** scans a messy repo, reports issues, and generates safe patches.

---

## 🔍 Example Project

We created a sample project with a few issues:
- An unused import (`clsx`) in `Button.js`
- A dead utility file (`oldUtils.js`)
- A duplicate function block in two utils

---

## 1. Run a Scan

```bash
sweepstacx scan --path examples/sample-project

