# SweepstacX

[![npm version](https://img.shields.io/npm/v/sweepstacx.svg)](https://www.npmjs.com/package/sweepstacx)
[![CI](https://github.com/5647383z-collab/SweeperstacX/actions/workflows/sweepstacx.yml/badge.svg)](https://github.com/5647383z-collab/SweeperstacX/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Consulting](https://img.shields.io/badge/Consulting-Available-blue.svg)](docs/consulting.md)

**Repo sweeper for modern dev stacks.**  
Scan, report, and patch dead code, unused imports, duplicate logic, and stale configs — keep your repos lean and production-ready.

---

## ​ Quick Start

```bash
npm i -g sweepstacx
sweepstacx check --path . | jq .stats
sweepstacx scan
sweepstacx report
sweepstacx patch --apply
