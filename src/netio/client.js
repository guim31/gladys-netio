// -----------------------------------------------------------------------------
// HTTP client of the Netio M2M API, JSON protocol (NETIO "M2M API Protocol
// JSON", JSONVer 2.x), served by every current Netio device (PowerPDU,
// PowerCable, PowerBOX, NETIO 4 / 4All / 4C, PowerDIN):
//
// - `GET /netio.json` returns the whole state: `Agent` (model, serial…),
//   `GlobalMeasure` (on the metering models) and `Outputs`.
// - `POST /netio.json` with `{ "Outputs": [{ "ID": 1, "Action": 0 }] }`
//   commands outputs, and answers the new state.
// - HTTP Basic authentication. The read-only and the read-write accounts are
//   separate in the Netio settings: the read-write one also reads. 401 is a
//   wrong account, 403 a write with an account that may only read, 400 a
//   malformed command, 404 an API not enabled.
// - HTTPS when the user typed https://: Netio uses a self-signed certificate,
//   so it is not verified (the address is on the local network).
// -----------------------------------------------------------------------------

import http from 'node:http';
import https from 'node:https';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable',
  AUTH: 'auth',
  FORBIDDEN: 'forbidden',
  NOT_NETIO: 'not_netio',
  HTTP: 'http',
});

export class NetioError extends Error {
  /**
   * @param {string} message never carries the password
   * @param {{ kind: string, status?: number }} details
   */
  constructor(message, { kind, status }) {
    super(message);
    this.name = 'NetioError';
    this.kind = kind;
    this.status = status;
  }
}

const MAX_BODY_BYTES = 256 * 1024;

/**
 * One HTTP request: `{ status, body }`. Injected in the tests (the fake Netio
 * answers without any socket).
 * @param {string} url
 * @param {{ method?: string, body?: string, headers?: object, timeoutMs: number }} options
 */
export function httpRequest(url, { method = 'GET', body, headers = {}, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const secure = url.startsWith('https:');
    const allHeaders = { accept: 'application/json', ...headers };
    if (body !== undefined) {
      allHeaders['content-type'] = 'application/json';
      allHeaders['content-length'] = Buffer.byteLength(body);
    }
    const options = { method, timeout: timeoutMs, headers: allHeaders };
    if (secure) {
      options.rejectUnauthorized = false; // self-signed certificate of the Netio
    }
    const request = (secure ? https : http).request(url, options, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          request.destroy(new NetioError('response too large', { kind: ERROR_KINDS.NOT_NETIO }));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () =>
        resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }),
      );
      response.on('error', reject);
    });
    request.on('timeout', () =>
      request.destroy(
        new NetioError(`no answer within ${timeoutMs} ms`, { kind: ERROR_KINDS.UNREACHABLE }),
      ),
    );
    request.on('error', reject);
    if (body !== undefined) {
      request.write(body);
    }
    request.end();
  });
}

/**
 * @param {object} options
 * @param {string} options.baseUrl e.g. http://192.0.2.20 (no trailing slash)
 * @param {string} [options.username]
 * @param {string} [options.password]
 * @param {number} [options.timeoutMs]
 * @param {typeof httpRequest} [options.request] the transport
 */
export function createClient({
  baseUrl,
  username = '',
  password = '',
  timeoutMs = 5000,
  request = httpRequest,
}) {
  const headers =
    username || password
      ? { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
      : {};

  async function send(method, body, { lenient = false } = {}) {
    let response;
    try {
      response = await request(`${baseUrl}/netio.json`, { method, body, headers, timeoutMs });
    } catch (err) {
      if (err instanceof NetioError) {
        throw err;
      }
      throw new NetioError(err.code || err.message, { kind: ERROR_KINDS.UNREACHABLE });
    }
    const { status } = response;
    if (status === 401) {
      throw new NetioError('HTTP 401: wrong user name or password', {
        kind: ERROR_KINDS.AUTH,
        status,
      });
    }
    if (status === 403) {
      throw new NetioError('HTTP 403: this account may not do that', {
        kind: ERROR_KINDS.FORBIDDEN,
        status,
      });
    }
    if (status === 404) {
      throw new NetioError('HTTP 404: no JSON API at this address', {
        kind: ERROR_KINDS.NOT_NETIO,
        status,
      });
    }
    if (status !== 200) {
      throw new NetioError(`HTTP ${status}`, { kind: ERROR_KINDS.HTTP, status });
    }
    let json;
    try {
      json = JSON.parse(response.body);
    } catch {
      if (lenient) {
        return null;
      }
      throw new NetioError('the answer is not JSON: is this a Netio?', {
        kind: ERROR_KINDS.NOT_NETIO,
      });
    }
    if (!json || typeof json !== 'object' || !Array.isArray(json.Outputs)) {
      if (lenient) {
        return null;
      }
      throw new NetioError('unexpected answer: is this a Netio?', { kind: ERROR_KINDS.NOT_NETIO });
    }
    return json;
  }

  return {
    baseUrl,
    /** The whole state (`GET /netio.json`). */
    read: () => send('GET'),
    /**
     * Command outputs; resolves the new state the Netio answers, or null
     * when its answer to the POST carries none (the caller reads again).
     * @param {Array<{ ID: number, Action: number }>} outputs
     */
    control: (outputs) => send('POST', JSON.stringify({ Outputs: outputs }), { lenient: true }),
  };
}
