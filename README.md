# SweepstacX

[![npm version](https://img.shields.io/npm/v/sweepstacx.svg)](https://www.npmjs.com/package/sweepstacx)
[![CI](https://github.com/ObvexBlackvault/SweepstacX/actions/workflows/sweepstacx.yml/badge.svg)](https://github.com/ObvexBlackvault/SweepstacX/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Consulting](https://img.shields.io/badge/Consulting-Available-blue.svg)](docs/consulting.md)

**Repo sweeper for modern dev stacks.**  
Find and patch dead code, unused imports, duplicates, and stale configs.  
Keep your repos lean, auditable, and CI-ready.

---

## 🚀 Quick Start

```bash
# Install globally
npm i -g sweepstacx

# CI-friendly one-liner
sweepstacx check --path . | jq .stats

# Or step by step
sweepstacx scan
sweepstacx report
sweepstacx patch --apply
