// -----------------------------------------------------------------------------
// Commands: the switch of Gladys, the action of the integration page, the
// scene action and the widget button. Switching on is always allowed;
// switching off and restarting only with the option of the configuration.
// Every failure is thrown (red in Gladys, `success: false` with the
// multi-language message), only real successes are returned (green).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeNetio, fixture } from './helpers/fakeNetio.js';
import { HOST_1, READ, WRITE, createWorld, slot1 } from './helpers/world.js';

const SERIAL = '24a42c390001';
const allowed = () => slot1({ allow_power_off: true });

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const failure = (ack, pattern) => {
  assert.equal(ack.success, false);
  assert.equal(typeof ack.error.fr, 'string');
  assert.ok(ack.error.en && ack.error.de && ack.error.es);
  if (pattern) assert.match(ack.error.en, pattern);
};

test('switch on: always allowed, from the switch, the action and the scene', async (t) => {
  const w = await world(t);
  const output3 = w.device(`${SERIAL}-3`);
  const state = output3.features.find((feature) => feature.external_id.endsWith(':state'));
  assert.deepEqual(await w.gladys.fake.setValue(output3, state, 1), { success: true });
  assert.equal(w.netio.output(3).State, 1);
  assert.equal(w.state(`${SERIAL}-3`, 'state'), 1, 'the new state published at once');

  w.netio.output(3).State = 0;
  const ack = await w.gladys.fake.action('control_output', {
    output: output3.external_id,
    command: 'on',
  });
  assert.equal(ack.success, true);
  assert.equal(ack.data.message.fr, 'Rack sortie 3 allumée.');

  w.netio.output(3).State = 0;
  const scene = await w.gladys.fake.sceneAction('control_output', {
    output: output3.external_id,
    command: 'on',
  });
  assert.equal(scene.success, true);
  assert.equal(w.netio.output(3).State, 1);
});

test('switch off and restart: refused by default, in red, nothing sent', async (t) => {
  const w = await world(t);
  const output1 = w.device(`${SERIAL}-1`);
  const state = output1.features.find((feature) => feature.external_id.endsWith(':state'));
  const ack = await w.gladys.fake.setValue(output1, state, 0);
  assert.equal(ack.success, false);
  for (const command of ['off', 'restart']) {
    failure(
      await w.gladys.fake.sceneAction('control_output', { output: output1.external_id, command }),
      /disabled/,
    );
    failure(
      await w.gladys.fake.action('control_output', { output: output1.external_id, command }),
      /disabled/,
    );
  }
  assert.equal(w.netio.output(1).State, 1);
  assert.ok(!w.netio.requests.some((request) => request.method === 'POST'));
});

test('switch off and restart when allowed; restart of an output that is off refused', async (t) => {
  const w = await world(t, { config: allowed() });
  const output1 = w.device(`${SERIAL}-1`).external_id;
  const restart = await w.gladys.fake.action('control_output', {
    output: output1,
    command: 'restart',
  });
  assert.equal(restart.success, true);
  assert.deepEqual(JSON.parse(w.netio.requests.at(-1).body), { Outputs: [{ ID: 1, Action: 2 }] });
  assert.equal(w.netio.output(1).State, 0, 'short off in progress');
  w.netio.flush();
  assert.equal(w.netio.output(1).State, 1, 'on again after the delay');

  const off = await w.gladys.fake.sceneAction('control_output', {
    output: output1,
    command: 'off',
  });
  assert.equal(off.success, true);
  assert.equal(w.netio.output(1).State, 0);
  assert.equal(w.state(`${SERIAL}-1`, 'state'), 0);

  failure(
    await w.gladys.fake.action('control_output', { output: output1, command: 'restart' }),
    /is off/,
  );
});

test('failures: unknown command, the Netio itself, a read-only account, a Netio down', async (t) => {
  const w = await world(t, { config: allowed() });
  const output1 = w.device(`${SERIAL}-1`).external_id;
  failure(
    await w.gladys.fake.action('control_output', { output: output1, command: 'explode' }),
    /Unknown command/,
  );
  failure(
    await w.gladys.fake.action('control_output', {
      output: w.device(SERIAL).external_id,
      command: 'on',
    }),
    /Choose an output/,
  );
  failure(await w.gladys.fake.action('control_output', {}), /Unknown command/);

  w.netio.down = true;
  failure(
    await w.gladys.fake.action('control_output', { output: output1, command: 'on' }),
    /does not answer/,
  );
});

test('a read-only account: the measures, but a clear message on a command', async (t) => {
  const w = await world(t, {
    netios: { [HOST_1]: createFakeNetio(fixture('netio-4all'), { read: READ, write: WRITE }) },
    config: slot1({ netio_1_username: READ[0], netio_1_password: READ[1] }),
  });
  assert.equal(w.gladys.fake.connectionStatus.connected, true);
  failure(
    await w.gladys.fake.action('control_output', {
      output: w.device(`${SERIAL}-3`).external_id,
      command: 'on',
    }),
    /may only read/,
  );
});

test('test the connection: green with every Netio answering, red otherwise', async (t) => {
  const w = await world(t);
  const ok = await w.gladys.fake.action('test_connection', {});
  assert.equal(ok.success, true);
  assert.equal(ok.data.message.fr, 'Rack : OK, NETIO 4All, 4 sortie(s), avec mesure');
  w.netio.down = true;
  failure(await w.gladys.fake.action('test_connection', {}), /does not answer/);
  await w.gladys.fake.configUpdated({});
  failure(await w.gladys.fake.action('test_connection', {}), /Enter the address/);
});

test('widget button: switch an output through the form', async (t) => {
  const w = await world(t, { config: allowed() });
  const ack = await w.gladys.fake.widgetAction(
    'outputs',
    'control',
    { netio: SERIAL },
    { settings: {}, values: { output: '2', command: 'off' } },
  );
  assert.equal(ack.success, true);
  assert.equal(w.netio.output(2).State, 0);
  failure(
    await w.gladys.fake.widgetAction(
      'outputs',
      'control',
      { netio: 'unknown' },
      { settings: {}, values: { output: '2', command: 'on' } },
    ),
  );
});
