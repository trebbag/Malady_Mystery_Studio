import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { findRepoRoot } from './repo-paths.mjs';

/**
 * @param {string} value
 * @returns {string}
 */
function unquoteEnvValue(value) {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return trimmed;
  }

  const quote = trimmed[0];
  const closingQuote = trimmed[trimmed.length - 1];

  if ((quote !== '"' && quote !== "'") || closingQuote !== quote) {
    return trimmed;
  }

  const innerValue = trimmed.slice(1, -1);

  if (quote === "'") {
    return innerValue;
  }

  return innerValue
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\r')
    .replaceAll('\\t', '\t')
    .replaceAll('\\"', '"')
    .replaceAll('\\\\', '\\');
}

/**
 * Load a simple KEY=VALUE .env file into process.env without overriding existing
 * environment variables by default. Values are never logged or returned.
 *
 * @param {{ moduleUrl?: string, envFilePath?: string, override?: boolean }} [options]
 * @returns {{ loaded: boolean, path: string, loadedKeys: string[] }}
 */
export function loadDotEnv(options = {}) {
  const rootDir = options.moduleUrl ? findRepoRoot(options.moduleUrl) : process.cwd();
  const envFilePath = options.envFilePath ?? path.join(rootDir, '.env');

  if (!existsSync(envFilePath)) {
    return {
      loaded: false,
      path: envFilePath,
      loadedKeys: [],
    };
  }

  const loadedKeys = [];

  for (const line of readFileSync(envFilePath, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const assignment = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const separatorIndex = assignment.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = assignment.slice(0, separatorIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue;
    }

    if (!options.override && process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(assignment.slice(separatorIndex + 1));
    loadedKeys.push(key);
  }

  return {
    loaded: true,
    path: envFilePath,
    loadedKeys,
  };
}

