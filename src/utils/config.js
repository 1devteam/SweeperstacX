import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const defaultConfig = {
  complexity: { maxFunction: 10, maxAverage: 8, minMaintainability: 70 },
  duplication: { maxLines: 5, maxPercent: 5 },
  lint: { maxErrors: 0, maxWarningsPerKLOC: 5 },
  deps: { unused: 0, missing: 0 },
  fuzz: { timeout: 5000, crashes: 0 },
  ignore: ['node_modules/**', 'dist/**', 'coverage/**', '.git/**']
};

export async function loadConfig(cliPath = '.', configPath = '') {
  try {
    const target = configPath
      ? resolve(process.cwd(), configPath)
      : resolve(process.cwd(), '.sweeperc.json');

    if (existsSync(target)) {
      const raw = await readFile(target, 'utf8');
      const user = JSON.parse(raw);
      return deepMerge(defaultConfig, user);
    }
  } catch {
    // fall back to defaults
  }
  return structuredClone(defaultConfig);
}

function deepMerge(base, add) {
  if (Array.isArray(base) && Array.isArray(add)) return Array.from(new Set([...base, ...add]));
  if (isObj(base) && isObj(add)) {
    const out = { ...base };
    for (const k of Object.keys(add)) out[k] = k in base ? deepMerge(base[k], add[k]) : add[k];
    return out;
  }
  return add ?? base;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
