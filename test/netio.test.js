// -----------------------------------------------------------------------------
// The JSON API client and parser, against the fake Netio served over a real
// HTTP socket on localhost: Basic authentication, the read-only account that
// may not write (403), the wrong account (401), a page that is not a Netio,
// a closed port, and the units of the parsed values.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ERROR_KINDS, createClient, httpRequest } from '../src/netio/client.js';
import { parseStatus, platformId } from '../src/netio/parse.js';
import { createFakeNetio, fixture } from './helpers/fakeNetio.js';
import { READ, WRITE } from './helpers/world.js';

async function serve(t, fake) {
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const answer = fake.handle(
        request.method,
        new URL(request.url, 'http://netio').pathname,
        request.headers,
        Buffer.concat(chunks).toString('utf8'),
      );
      response.writeHead(answer.status, { 'content-type': 'application/json' });
      response.end(answer.body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test('client over HTTP: read with either account, write with the read-write one only', async (t) => {
  const fake = createFakeNetio(fixture('netio-4all'), { read: READ, write: WRITE });
  const baseUrl = await serve(t, fake);

  const reader = createClient({ baseUrl, username: READ[0], password: READ[1] });
  const json = await reader.read();
  assert.equal(json.Agent.Model, 'NETIO 4All');
  await assert.rejects(reader.control([{ ID: 1, Action: 0 }]), { kind: ERROR_KINDS.FORBIDDEN });
  assert.equal(fake.output(1).State, 1, 'nothing switched');

  const writer = createClient({ baseUrl, username: WRITE[0], password: WRITE[1] });
  const after = await writer.control([{ ID: 1, Action: 0 }]);
  assert.equal(after.Outputs[0].State, 0, 'the answer carries the new state');
  assert.equal(fake.output(1).State, 0);

  const wrong = createClient({ baseUrl, username: 'admin', password: 'nope' });
  await assert.rejects(wrong.read(), (err) => {
    assert.equal(err.kind, ERROR_KINDS.AUTH);
    assert.doesNotMatch(err.message, /nope/);
    return true;
  });
  await assert.rejects(createClient({ baseUrl }).read(), { kind: ERROR_KINDS.AUTH });
});

test('client: not a Netio, closed port, timeout, lenient POST answer', async (t) => {
  const server = http.createServer((request, response) => {
    if (request.url === '/slow/netio.json') return; // never answers
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html>router</html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await assert.rejects(createClient({ baseUrl }).read(), { kind: ERROR_KINDS.NOT_NETIO });
  assert.equal(await createClient({ baseUrl }).control([{ ID: 1, Action: 1 }]), null);
  await assert.rejects(createClient({ baseUrl: `${baseUrl}/slow`, timeoutMs: 200 }).read(), {
    kind: ERROR_KINDS.UNREACHABLE,
  });

  const closed = http.createServer();
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
  const port = closed.address().port;
  await new Promise((resolve) => closed.close(resolve));
  await assert.rejects(createClient({ baseUrl: `http://127.0.0.1:${port}` }).read(), {
    kind: ERROR_KINDS.UNREACHABLE,
  });
});

test('client: HTTP statuses of the Netio documentation', async () => {
  for (const [status, kind] of [
    [401, ERROR_KINDS.AUTH],
    [403, ERROR_KINDS.FORBIDDEN],
    [404, ERROR_KINDS.NOT_NETIO],
    [400, ERROR_KINDS.HTTP],
    [500, ERROR_KINDS.HTTP],
  ]) {
    const client = createClient({
      baseUrl: 'http://192.0.2.10',
      request: async () => ({ status, body: '' }),
    });
    await assert.rejects(client.read(), { kind, status });
  }
  assert.equal(typeof httpRequest, 'function');
});

test('parse: units of Gladys, a metering model and one without', () => {
  const metered = parseStatus(fixture('netio-4all'));
  assert.equal(metered.platformId, '24a42c390001');
  assert.equal(metered.metered, true);
  assert.deepEqual(metered.global, {
    voltage: 231.4,
    frequency: 50,
    current: 0.412,
    powerFactor: 0.71,
    power: 68,
    energy: 152.884,
  });
  assert.deepEqual(metered.outputs[0], {
    id: 1,
    name: 'Server',
    on: true,
    delayMs: 5000,
    metered: true,
    power: 52,
    current: 0.287,
    powerFactor: 0.78,
    energy: 120.41,
  });
  // Factory and empty names are no names.
  assert.equal(metered.outputs[2].name, null);
  assert.equal(metered.outputs[3].name, null);

  const plain = parseStatus(fixture('netio-4'));
  assert.equal(plain.metered, false);
  assert.equal(plain.global, null);
  assert.equal(plain.outputs[1].on, false);
  assert.equal(plain.outputs[1].metered, false);
  assert.equal(plain.outputs[1].power, null);

  // Duplicated or invalid outputs are skipped, the rest sorted.
  const odd = parseStatus({
    Agent: { MAC: '24:A4:2C:00:00:01' },
    Outputs: [{ ID: 2, State: 1 }, { ID: 2 }, { ID: 'x' }, { ID: 1, State: 7 }],
  });
  assert.deepEqual(
    odd.outputs.map((output) => [output.id, output.on]),
    [
      [1, null],
      [2, true],
    ],
  );
  assert.equal(odd.platformId, '24a42c000001');
  assert.equal(platformId({}), null);
});
