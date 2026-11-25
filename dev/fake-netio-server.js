// -----------------------------------------------------------------------------
// The fake Netio over real HTTP, for the end-to-end checks in a
// `gladys-test-*` container (see CLAUDE.md, "Tests in Docker"). Not part of
// the image: started with `node dev/fake-netio-server.js` from the repository.
//
// NETIO_PORT (80 by default), NETIO_MODEL=4all|4 (metering or not),
// NETIO_READ=user:password, NETIO_WRITE=user:password (none: open API).
// The short offs switch back on after the Delay of the output.
// -----------------------------------------------------------------------------

import http from 'node:http';
import { createFakeNetio, fixture } from '../test/helpers/fakeNetio.js';

const account = (value) =>
  value ? [value.split(':')[0], value.split(':').slice(1).join(':')] : undefined;
const fake = createFakeNetio(fixture(process.env.NETIO_MODEL === '4' ? 'netio-4' : 'netio-4all'), {
  read: account(process.env.NETIO_READ),
  write: account(process.env.NETIO_WRITE),
});

const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const { pathname } = new URL(request.url, 'http://netio');
    const answer = fake.handle(request.method, pathname, request.headers, body);
    if (fake.pending.length > 0) {
      const delay = Math.max(...fake.pending.map((output) => output.Delay ?? 2000));
      setTimeout(() => fake.flush(), delay);
    }
    response.writeHead(answer.status, { 'content-type': 'application/json' });
    response.end(answer.body);
    console.log(`${request.method} ${pathname} ${answer.status} ${body}`);
  });
});
server.listen(Number(process.env.NETIO_PORT ?? 80), () => console.log('fake Netio ready'));
