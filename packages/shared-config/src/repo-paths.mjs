import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk upward from the current module until the starter-pack root is found.
 *
 * @param {string} moduleUrl
 * @returns {string}
 */
export function findRepoRoot(moduleUrl) {
  let currentPath = path.dirname(fileURLToPath(moduleUrl));

  while (true) {
    const workspacePath = path.join(currentPath, 'pnpm-workspace.yaml');
    const agentsPath = path.join(currentPath, 'AGENTS.md');

    if (existsSync(workspacePath) && existsSync(agentsPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      throw new Error('Unable to locate the repository root from the current module.');
    }

    currentPath = parentPath;
  }
}
