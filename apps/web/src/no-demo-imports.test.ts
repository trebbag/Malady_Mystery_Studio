import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = pathToFileURL(path.resolve(process.cwd(), 'src') + path.sep);

async function listSourceFiles(directoryUrl: URL): Promise<URL[]> {
  const entries = await readdir(path.resolve(directoryUrl.pathname), { withFileTypes: true });
  const files: URL[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    const entryUrl = new URL(entry.name, directoryUrl);

    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(new URL(`${entry.name}/`, directoryUrl)));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push(entryUrl);
    }
  }

  return files;
}

describe('web source guard', () => {
  it('does not import placeholder or demo data modules in production source', async () => {
    const sourceFiles = await listSourceFiles(sourceRoot);
    const failures: string[] = [];

    for (const fileUrl of sourceFiles) {
      const contents = await readFile(fileUrl, 'utf8');

      if (/components\/data(\.ts|['"])/.test(contents) || /pages\/.*demo/i.test(contents)) {
        failures.push(path.basename(fileUrl.pathname));
      }
    }

    expect(failures).toEqual([]);
  });
});
