import fg from 'fast-glob';

export default async function runComplexity(opts = {}) {
  let escomplex;
  try {
    escomplex = await import('typhonjs-escomplex');
  } catch {
    console.error('typhonjs-escomplex not installed. Install with: npm i typhonjs-escomplex -D');
    process.exit(2);
  }

  const path = opts.path || '.';
  const patterns = [`${path}/**/*.js`, `${path}/**/*.mjs`, `${path}/**/*.cjs`];
  const files = await fg(patterns, { ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] });

  let maxFn = 0, sumAvg = 0, count = 0;
  for (const file of files) {
    // escomplex expects source text; import fs dynamically to avoid ESM warnings
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(file, 'utf8');
    const result = escomplex.analyzeModule(src);
    if (result?.aggregate?.cyclomatic) {
      maxFn = Math.max(maxFn, result.aggregate.cyclomatic);
      sumAvg += result.aggregate.cyclomatic;
      count++;
    }
  }
  const avg = count ? +(sumAvg / count).toFixed(2) : 0;
  console.log(JSON.stringify({ maxFunction: maxFn, avgFunction: avg, files: count }, null, 2));
}
