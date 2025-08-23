import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJSON(path, obj) {
  await ensureDir(dirname(path));
  await fs.writeFile(path, JSON.stringify(obj, null, 2), 'utf8');
}

export async function readJSON(path) {
  try {
    const data = await fs.readFile(path, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeText(path, text) {
  await ensureDir(dirname(path));
  await fs.writeFile(path, text, 'utf8');
}

export async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
