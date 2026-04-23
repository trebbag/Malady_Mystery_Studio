/**
 * @param {string} level
 * @param {string} message
 * @param {Record<string, unknown>} [attributes]
 */
function writeStructuredLog(level, message, attributes = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...attributes,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

/**
 * @param {{ backend?: string }} [options]
 */
export function createTelemetry(options = {}) {
  const backend = options.backend ?? process.env.TELEMETRY_BACKEND ?? 'structured-stdout';

  return {
    backend,
    /**
     * @param {string} message
     * @param {Record<string, unknown>} [attributes]
     */
    info(message, attributes = {}) {
      writeStructuredLog('info', message, attributes);
    },
    /**
     * @param {string} message
     * @param {Record<string, unknown>} [attributes]
     */
    warn(message, attributes = {}) {
      writeStructuredLog('warn', message, attributes);
    },
    /**
     * @param {string} message
     * @param {Record<string, unknown>} [attributes]
     */
    error(message, attributes = {}) {
      writeStructuredLog('error', message, attributes);
    },
  };
}
