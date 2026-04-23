import { loadDotEnv } from '../../../packages/shared-config/src/env.mjs';
import { createApp } from './app.mjs';

loadDotEnv({ moduleUrl: import.meta.url });

const port = Number(process.env.PORT ?? 3000);
const { server, store } = await createApp();

server.listen(port, () => {
  console.log(`Starter intake API listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });

  const closeAsync = /** @type {any} */ (store).closeAsync;

  if (typeof closeAsync === 'function') {
    await closeAsync.call(store);
  } else {
    store.close();
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}
