import fs from 'node:fs';

export function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return [];
    const index = trimmed.indexOf('=');
    return [[trimmed.slice(0, index), trimmed.slice(index + 1)]];
  }));
}
