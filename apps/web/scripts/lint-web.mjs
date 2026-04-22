import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const rootDir = new URL('..', import.meta.url);
const srcDir = new URL('../src/', import.meta.url);

/**
 * @param {URL} directoryUrl
 * @returns {Promise<URL[]>}
 */
async function listSourceFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  /** @type {URL[]} */
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(entry.name, directoryUrl);

    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

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

const files = await listSourceFiles(srcDir);
const failures = [];

for (const fileUrl of files) {
  const contents = await readFile(fileUrl, 'utf8');
  const relativePath = path.relative(new URL('.', rootDir).pathname, fileUrl.pathname);

  if (/components\/data(\.ts|['"])/.test(contents) || /pages\/.*demo/i.test(contents)) {
    failures.push(`${relativePath} imports or references a Figma Make demo data module.`);
  }
}

if (failures.length > 0) {
  console.error('WEB LINT FAILED');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Linted ${files.length} web source files.`);
