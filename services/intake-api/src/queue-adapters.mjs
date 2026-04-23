import { ServiceBusClient } from '@azure/service-bus';

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

export class InProcessQueueAdapter {
  constructor() {
    /** @type {Map<string, (message: any) => Promise<void>>} */
    this.handlers = new Map();
  }

  /**
   * @param {string} queueName
   * @param {(message: any) => Promise<void>} handler
   */
  registerHandler(queueName, handler) {
    this.handlers.set(queueName, handler);
  }

  /**
   * @param {string} queueName
   * @param {any} message
   */
  async enqueue(queueName, message) {
    const handler = this.handlers.get(queueName);

    if (handler) {
      await handler(clone(message));
    }
  }

  async close() {}
}

export class AzureServiceBusQueueAdapter {
  /**
   * @param {{ connectionString: string }} options
   */
  constructor(options) {
    this.client = new ServiceBusClient(options.connectionString);
  }

  /**
   * @param {string} _queueName
   * @param {(message: any) => Promise<void>} _handler
   */
  registerHandler(_queueName, _handler) {
    // Worker mode registers receivers explicitly.
  }

  /**
   * @param {string} queueName
   * @param {any} message
   */
  async enqueue(queueName, message) {
    const sender = this.client.createSender(queueName);

    try {
      await sender.sendMessages({
        body: clone(message),
      });
    } finally {
      await sender.close();
    }
  }

  /**
   * @param {string} queueName
   * @param {(message: any) => Promise<void>} handler
   * @returns {Promise<() => Promise<void>>}
   */
  async createReceiver(queueName, handler) {
    const receiver = this.client.createReceiver(queueName);
    const subscription = receiver.subscribe({
      processMessage: async (message) => {
        await handler(message.body);
        await receiver.completeMessage(message);
      },
      processError: async () => {},
    });

    return async () => {
      await subscription.close();
      await receiver.close();
    };
  }

  async close() {
    await this.client.close();
  }
}

/**
 * @param {{ backend?: string, connectionString?: string }} [options]
 */
export function createQueueAdapter(options = {}) {
  const backend = options.backend ?? process.env.ASYNC_QUEUE_BACKEND ?? 'in-process';

  if (backend === 'azure-service-bus') {
    const connectionString = options.connectionString ?? process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error('AZURE_SERVICE_BUS_CONNECTION_STRING is required when ASYNC_QUEUE_BACKEND=azure-service-bus.');
    }

    return new AzureServiceBusQueueAdapter({
      connectionString,
    });
  }

  return new InProcessQueueAdapter();
}
