#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { loadDotEnv } from '../packages/shared-config/src/env.mjs';

loadDotEnv({ moduleUrl: import.meta.url });

const apiPort = process.env.API_PORT ?? process.env.PORT ?? '3000';
const webPort = process.env.WEB_PORT ?? process.env.VITE_PORT ?? '5173';
const apiBaseUrl = process.env.VITE_API_PROXY_TARGET ?? process.env.VITE_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

/** @type {Array<import('node:child_process').ChildProcess>} */
const children = [];
let shuttingDown = false;

/**
 * @param {string} streamName
 * @returns {(line: string) => void}
 */
function makeLineLogger(streamName) {
  return (line) => {
    console.log(`[${streamName}] ${line}`);
  };
}

/**
 * @param {NodeJS.ReadableStream | null} stream
 * @param {(line: string) => void} onLine
 * @returns {void}
 */
function pipeLines(stream, onLine) {
  if (!stream) {
    return;
  }

  const reader = createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  reader.on('line', onLine);
}

/**
 * @param {{ name: string, args: string[], env?: Record<string, string> }} processConfig
 * @returns {import('node:child_process').ChildProcess}
 */
function startProcess(processConfig) {
  const child = spawn(pnpmExecutable, processConfig.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LOCAL_STORAGE_ONLY: process.env.LOCAL_STORAGE_ONLY ?? '1',
      METADATA_STORE_BACKEND: process.env.METADATA_STORE_BACKEND ?? 'sqlite',
      OBJECT_STORE_BACKEND: process.env.OBJECT_STORE_BACKEND ?? 'filesystem',
      ASYNC_QUEUE_BACKEND: process.env.ASYNC_QUEUE_BACKEND ?? 'in-process',
      TELEMETRY_BACKEND: process.env.TELEMETRY_BACKEND ?? 'stdout',
      RENDER_PROVIDER: process.env.RENDER_PROVIDER ?? 'stub-image',
      ...processConfig.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.push(child);
  pipeLines(child.stdout, makeLineLogger(processConfig.name));
  pipeLines(child.stderr, makeLineLogger(`${processConfig.name}:err`));

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0 && processConfig.name === 'worker') {
      console.log('[dev] worker exited cleanly; local in-process queues do not require a separate worker.');
      return;
    }

    console.log(`[dev] ${processConfig.name} exited with ${signal ?? `code ${code ?? 'unknown'}`}. Shutting down remaining processes.`);
    shutdown(code === null ? 1 : code);
  });

  return child;
}

/**
 * @param {number} [exitCode]
 * @returns {void}
 */
function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed && child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }

    process.exit(exitCode);
  }, 1500).unref();
}

console.log('[dev] Starting local Malady Mystery Studio.');
console.log(`[dev] API: ${apiBaseUrl}`);
console.log(`[dev] Web: http://127.0.0.1:${webPort}/review`);
console.log('[dev] Press Ctrl-C to stop all local processes.');

startProcess({
  name: 'api',
  args: ['dev:api'],
  env: {
    PORT: apiPort,
  },
});

startProcess({
  name: 'worker',
  args: ['dev:worker'],
  env: {
    PORT: apiPort,
  },
});

startProcess({
  name: 'web',
  args: ['--filter', '@dcp/web', 'dev', '--host', '127.0.0.1', '--port', webPort],
  env: {
    VITE_API_PROXY_TARGET: apiBaseUrl,
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!shuttingDown) {
      console.log(`[dev] Received ${signal}. Stopping local processes.`);
    }
    shutdown(0);
  });
}
