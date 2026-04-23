import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadDotEnv } from '../packages/shared-config/src/env.mjs';

test('loadDotEnv loads local keys without exposing values or overriding existing env', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mms-env-'));
  const envFilePath = path.join(directory, '.env');
  const previousExistingValue = process.env.MMS_ENV_TEST_EXISTING;
  const previousSecretValue = process.env.MMS_ENV_TEST_SECRET;
  const previousQuotedValue = process.env.MMS_ENV_TEST_QUOTED;

  process.env.MMS_ENV_TEST_EXISTING = 'from-shell';

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(envFilePath, [
      '# local test values',
      'MMS_ENV_TEST_EXISTING=from-file',
      'MMS_ENV_TEST_SECRET=sk-test-never-log',
      'export MMS_ENV_TEST_QUOTED="hello\\nworld"',
    ].join('\n'));

    const result = loadDotEnv({ envFilePath });

    assert.equal(result.loaded, true);
    assert.deepEqual(result.loadedKeys, ['MMS_ENV_TEST_SECRET', 'MMS_ENV_TEST_QUOTED']);
    assert.equal(process.env.MMS_ENV_TEST_EXISTING, 'from-shell');
    assert.equal(process.env.MMS_ENV_TEST_SECRET, 'sk-test-never-log');
    assert.equal(process.env.MMS_ENV_TEST_QUOTED, 'hello\nworld');
  } finally {
    if (previousExistingValue === undefined) {
      delete process.env.MMS_ENV_TEST_EXISTING;
    } else {
      process.env.MMS_ENV_TEST_EXISTING = previousExistingValue;
    }

    if (previousSecretValue === undefined) {
      delete process.env.MMS_ENV_TEST_SECRET;
    } else {
      process.env.MMS_ENV_TEST_SECRET = previousSecretValue;
    }

    if (previousQuotedValue === undefined) {
      delete process.env.MMS_ENV_TEST_QUOTED;
    } else {
      process.env.MMS_ENV_TEST_QUOTED = previousQuotedValue;
    }

    await rm(directory, { force: true, recursive: true });
  }
});

