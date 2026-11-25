// -----------------------------------------------------------------------------
// A fake Netio, faithful to the NETIO "M2M API Protocol JSON" documentation
// (JSONVer 2.x): `GET /netio.json` answers the whole state, `POST
// /netio.json` with `{ "Outputs": [{ "ID", "Action" | "State" }] }` commands
// the outputs and answers the new state; HTTP Basic with separate read-only
// and read-write accounts (401 wrong account, 403 a write with the read-only
// one), 400 on a malformed command, 404 elsewhere.
//
// No hardware was available: the states come from test/fixtures/netio/*.json
// (a NETIO 4All with metering, a NETIO 4 without), values invented.
//
// Used by the tests through `request` (no socket), and served for real by
// dev/fake-netio-server.js in a `gladys-test-*` container.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export function fixture(name) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/netio/${name}.json`, import.meta.url), 'utf8'),
  );
}

const json = (status, value) => ({ status, body: JSON.stringify(value) });

/**
 * @param {object} state a fixture, mutated by the commands and the tests
 * @param {object} [accounts] { read: [user, password], write: [user, password] }; none: open API
 */
export function createFakeNetio(state, accounts = {}) {
  const fake = {
    state,
    accounts,
    down: false,
    /** Short off: the outputs to switch on again when the delay is over. */
    pending: [],
    requests: [],

    /** Run the pending "switch on again" of the short offs. */
    flush() {
      const pending = fake.pending.splice(0);
      for (const output of pending) output.State = 1;
    },

    output(id) {
      return state.Outputs.find((output) => output.ID === id);
    },

    /** The measures follow the switches, like a real metering Netio. */
    refreshMeasures() {
      if (!state.GlobalMeasure) return;
      let load = 0;
      let current = 0;
      for (const output of state.Outputs) {
        if (output.State === 0 && 'Load' in output) {
          output.Load = 0;
          output.Current = 0;
          output.PowerFactor = 0;
        }
        load += output.Load ?? 0;
        current += output.Current ?? 0;
      }
      state.GlobalMeasure.TotalLoad = load;
      state.GlobalMeasure.TotalCurrent = current;
    },

    /** Who sent the request: 'write', 'read', 'none' (open API) or null. */
    whoIs(headers = {}) {
      if (!accounts.read && !accounts.write) return 'write';
      const match = /^Basic (.+)$/.exec(headers.authorization ?? '');
      if (!match) return null;
      const decoded = Buffer.from(match[1], 'base64').toString('utf8');
      const [user, ...rest] = decoded.split(':');
      const password = rest.join(':');
      const is = (account) => account && account[0] === user && account[1] === password;
      if (is(accounts.write)) return 'write';
      if (is(accounts.read)) return 'read';
      return null;
    },

    /**
     * @returns {{ status: number, body: string }}
     */
    handle(method, path, headers, body) {
      fake.requests.push({ method, path, body });
      if (path !== '/netio.json') return { status: 404, body: 'Not Found' };
      const who = fake.whoIs(headers);
      if (!who) return { status: 401, body: 'Unauthorized' };
      if (method === 'GET') {
        fake.refreshMeasures();
        return json(200, state);
      }
      if (method !== 'POST') return { status: 400, body: 'Bad Request' };
      if (who !== 'write') return { status: 403, body: 'Forbidden' };
      let command;
      try {
        command = JSON.parse(body);
      } catch {
        return { status: 400, body: 'Bad Request' };
      }
      if (!Array.isArray(command?.Outputs) || command.Outputs.length === 0) {
        return { status: 400, body: 'Bad Request' };
      }
      for (const item of command.Outputs) {
        const output = fake.output(item?.ID);
        if (!output) return { status: 400, body: 'Bad Request' };
        const action = item.Action ?? (item.State === 1 ? 1 : item.State === 0 ? 0 : undefined);
        if (![0, 1, 2, 3, 4, 5, 6].includes(action)) return { status: 400, body: 'Bad Request' };
        if (action === 0) output.State = 0;
        if (action === 1) output.State = 1;
        if (action === 2) {
          output.State = 0;
          fake.pending.push(output);
        }
        if (action === 4) output.State = output.State ? 0 : 1;
      }
      fake.refreshMeasures();
      return json(200, state);
    },

    /** The transport of src/netio/client.js, without any socket. */
    async request(url, { method = 'GET', body, headers } = {}) {
      if (fake.down) {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      }
      return fake.handle(method, new URL(url).pathname, headers, body);
    },
  };
  return fake;
}

/** One transport for several fakes, by host name. */
export function createNetwork(fakes) {
  return async (url, options) => {
    const fake = fakes[new URL(url).host];
    if (!fake) {
      throw Object.assign(new Error('connect EHOSTUNREACH'), { code: 'EHOSTUNREACH' });
    }
    return fake.request(url, options);
  };
}
