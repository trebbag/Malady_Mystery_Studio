/**
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<string>}
 */
export async function readTextBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return '';
  }

  return Buffer.concat(chunks).toString('utf8');
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<unknown>}
 */
export async function readJsonBody(request) {
  const bodyText = await readTextBody(request);

  if (!bodyText) {
    return {};
  }

  return JSON.parse(bodyText);
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<Record<string, string>>}
 */
export async function readFormBody(request) {
  const bodyText = await readTextBody(request);

  if (!bodyText) {
    return {};
  }

  return Object.fromEntries(new URLSearchParams(bodyText).entries());
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {unknown} payload
 * @returns {void}
 */
export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload, null, 2));
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {string} html
 * @returns {void}
 */
export function sendHtml(response, statusCode, html) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(html);
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {string} location
 * @param {number} [statusCode]
 * @returns {void}
 */
export function redirect(response, location, statusCode = 303) {
  response.statusCode = statusCode;
  response.setHeader('location', location);
  response.end();
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {string} message
 * @param {unknown} [details]
 * @returns {void}
 */
export function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, {
    details,
    error: message,
  });
}
