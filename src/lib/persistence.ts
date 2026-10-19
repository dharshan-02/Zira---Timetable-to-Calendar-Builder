import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dataDirectory = resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || join(process.cwd(), '.data'));

export function loadRecords<T>(name: string): T[] {
  try {
    const contents = readFileSync(/* turbopackIgnore: true */ recordPath(name), 'utf8');
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function saveRecords<T>(name: string, records: Iterable<T>) {
  mkdirSync(dataDirectory, { recursive: true });
  const target = recordPath(name);
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(Array.from(records)), 'utf8');
  renameSync(temporary, target);
}

function recordPath(name: string) {
  if (!/^[a-z-]+\.json$/.test(name)) throw new Error('Invalid persistence record name.');
  return join(/* turbopackIgnore: true */ dataDirectory, name);
}
