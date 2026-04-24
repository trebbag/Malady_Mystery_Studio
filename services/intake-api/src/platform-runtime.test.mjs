import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlatformRuntime } from './platform-runtime.mjs';

test('LOCAL_STORAGE_ONLY keeps active runtime on SQLite, filesystem, and in-process queue', () => {
  const previous = {
    LOCAL_STORAGE_ONLY: process.env.LOCAL_STORAGE_ONLY,
    METADATA_STORE_BACKEND: process.env.METADATA_STORE_BACKEND,
    OBJECT_STORE_BACKEND: process.env.OBJECT_STORE_BACKEND,
    ASYNC_QUEUE_BACKEND: process.env.ASYNC_QUEUE_BACKEND,
  };

  process.env.LOCAL_STORAGE_ONLY = '1';
  process.env.METADATA_STORE_BACKEND = 'postgres';
  process.env.OBJECT_STORE_BACKEND = 'azure-blob';
  process.env.ASYNC_QUEUE_BACKEND = 'azure-service-bus';

  try {
    const runtime = createPlatformRuntime();

    assert.equal(runtime.runtimeMode, 'local');
    assert.equal(runtime.metadataStoreKind, 'sqlite');
    assert.equal(runtime.objectStorageKind, 'filesystem');
    assert.equal(runtime.queueBackend, 'in-process');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test('local storage is the default runtime unless explicitly disabled', () => {
  const previous = {
    LOCAL_STORAGE_ONLY: process.env.LOCAL_STORAGE_ONLY,
    METADATA_STORE_BACKEND: process.env.METADATA_STORE_BACKEND,
    OBJECT_STORE_BACKEND: process.env.OBJECT_STORE_BACKEND,
    ASYNC_QUEUE_BACKEND: process.env.ASYNC_QUEUE_BACKEND,
  };

  delete process.env.LOCAL_STORAGE_ONLY;
  process.env.METADATA_STORE_BACKEND = 'postgres';
  process.env.OBJECT_STORE_BACKEND = 'azure-blob';
  process.env.ASYNC_QUEUE_BACKEND = 'azure-service-bus';

  try {
    const runtime = createPlatformRuntime();

    assert.equal(runtime.runtimeMode, 'local');
    assert.equal(runtime.metadataStoreKind, 'sqlite');
    assert.equal(runtime.objectStorageKind, 'filesystem');
    assert.equal(runtime.queueBackend, 'in-process');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test('managed adapter env vars are ignored during the local-only product phase', () => {
  const previous = {
    LOCAL_STORAGE_ONLY: process.env.LOCAL_STORAGE_ONLY,
    METADATA_STORE_BACKEND: process.env.METADATA_STORE_BACKEND,
    ASYNC_QUEUE_BACKEND: process.env.ASYNC_QUEUE_BACKEND,
  };

  process.env.LOCAL_STORAGE_ONLY = '0';
  process.env.METADATA_STORE_BACKEND = 'postgres';
  process.env.ASYNC_QUEUE_BACKEND = 'in-process';

  try {
    const runtime = createPlatformRuntime({
      objectStorage: {
        kind: 'filesystem',
        client: {},
      },
    });

    assert.equal(runtime.runtimeMode, 'local');
    assert.equal(runtime.metadataStoreKind, 'sqlite');
    assert.equal(runtime.objectStorageKind, 'filesystem');
    assert.equal(runtime.queueBackend, 'in-process');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});
