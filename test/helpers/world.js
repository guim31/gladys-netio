// -----------------------------------------------------------------------------
// A whole integration under test: the app wired to the SDK's fake Gladys and
// to fake Netio devices, a clock the test moves and a logger that records
// every line.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';
import { createFakeNetio, createNetwork, fixture } from './fakeNetio.js';

export const HOST_1 = '192.0.2.10';
export const HOST_2 = '192.0.2.11';
export const READ = ['monitor', 'read-secret'];
export const WRITE = ['admin', 'write-secret'];
export const START = Date.parse('2026-11-20T12:00:00Z');

/** A logger recording its lines: `{ level, text }`. */
export function createRecordingLogger() {
  const lines = [];
  const write =
    (level) =>
    (...args) =>
      lines.push({
        level,
        text: args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '),
      });
  const logger = {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: () => logger,
  };
  return { logger, lines, at: (level) => lines.filter((line) => line.level === level) };
}

export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/** The configuration of one Netio with the read-write account. */
export const slot1 = (overrides = {}) => ({
  netio_1_host: HOST_1,
  netio_1_username: WRITE[0],
  netio_1_password: WRITE[1],
  ...overrides,
});

/**
 * @param {object} [options]
 * @param {object} [options.config] config values (one metering Netio by default)
 * @param {object} [options.netios] fakes by host (a NETIO 4All at HOST_1 by default)
 * @param {boolean} [options.create] the user adds every discovered device
 * @param {object} [options.clock]
 */
export async function createWorld({
  config = slot1(),
  netios,
  create = true,
  clock = createClock(),
  timers = false,
} = {}) {
  const fakes = netios ?? {
    [HOST_1]: createFakeNetio(fixture('netio-4all'), { read: READ, write: WRITE }),
  };
  const logs = createRecordingLogger();
  const gladys = createFakeGladys({ config });
  const app = createApp({
    gladys,
    transport: createNetwork(fakes),
    logger: logs.logger,
    now: clock.now,
    timers,
  });
  app.register();
  await gladys.connect();
  if (create) {
    for (const device of gladys.fake.discoveredDevices) {
      await gladys.fake.deviceCreated(device);
    }
  }
  return {
    gladys,
    app,
    fakes,
    netio: fakes[HOST_1],
    logs,
    clock,
    /** The published device whose external id ends with `suffix`. */
    device(suffix) {
      return gladys.fake.discoveredDevices.find((device) => device.external_id.endsWith(suffix));
    },
    /** The last state of a feature: `<device suffix>`, `<feature key>`. */
    state(suffix, key) {
      return gladys.fake.lastState(`${this.device(suffix).external_id}:${key}`);
    },
  };
}
