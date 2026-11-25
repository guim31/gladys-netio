// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and fake Netio devices:
// discovery, states (the devices added only, switches at once, measures once
// a minute, everything when a device is added), the scene events when a
// Netio is lost and back, the transport badges, the connection status, the
// container's own timer, quiet logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeNetio, fixture } from './helpers/fakeNetio.js';
import { HOST_1, HOST_2, READ, WRITE, createClock, createWorld, slot1 } from './helpers/world.js';

const SERIAL = '24a42c390001';

test('discovery: the Netio and one device per output, should_poll false', async (t) => {
  const world = await createWorld({
    netios: {
      [HOST_1]: createFakeNetio(fixture('netio-4all'), { read: READ, write: WRITE }),
      [HOST_2]: createFakeNetio(fixture('netio-4')),
    },
    config: slot1({ netio_2_host: HOST_2 }),
  });
  t.after(() => world.app.stop());
  const devices = world.gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => [device.external_id.split(':').slice(2).join(':'), device.name]),
    [
      [`netio:${SERIAL}`, 'Rack'],
      [`netio-output:${SERIAL}-1`, 'Rack Server'],
      [`netio-output:${SERIAL}-2`, 'Rack Router'],
      [`netio-output:${SERIAL}-3`, 'Rack sortie 3'],
      [`netio-output:${SERIAL}-4`, 'Rack sortie 4'],
      // No metering: no device for the NETIO 4 itself, a switch per output.
      ['netio-output:24a42c390002-1', 'Office Printer'],
      ['netio-output:24a42c390002-2', 'Office Lamp'],
      ['netio-output:24a42c390002-3', 'Office sortie 3'],
      ['netio-output:24a42c390002-4', 'Office sortie 4'],
    ],
  );
  assert.ok(devices.every((device) => device.should_poll === false));
  assert.deepEqual(
    world.device('24a42c390002-1').features.map((feature) => feature.external_id.split(':').at(-1)),
    ['state'],
  );
  assert.deepEqual(world.device(`${SERIAL}-1`).params, [
    { name: 'Serial number', value: '24A42C390001' },
    { name: 'Firmware', value: '3.4.2' },
  ]);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('states: nothing before a device is added, everything when it is, in Gladys units', async (t) => {
  const world = await createWorld({ create: false });
  t.after(() => world.app.stop());
  assert.equal(world.gladys.fake.states.length, 0, 'no device added yet');
  await world.gladys.fake.deviceCreated(world.device(`${SERIAL}-1`));
  assert.equal(world.state(`${SERIAL}-1`, 'state'), 1);
  assert.equal(world.state(`${SERIAL}-1`, 'power'), 52);
  assert.equal(world.state(`${SERIAL}-1`, 'current'), 0.287);
  assert.equal(world.state(`${SERIAL}-1`, 'energy'), 120.41);
  assert.equal(world.gladys.fake.states.length, 4, 'only the device added');
  await world.gladys.fake.deviceCreated(world.device(SERIAL));
  assert.equal(world.state(SERIAL, 'voltage'), 231.4);
  assert.equal(world.state(SERIAL, 'total_current'), 0.412);
  assert.equal(world.state(SERIAL, 'total_energy'), 152.884);
  assert.ok(world.gladys.fake.widgetRefreshes.length > 0, 'the widget is refreshed');
});

test('cycle: a switch goes out at once, the measures once a minute, unchanged values not again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const count = () => world.gladys.fake.states.length;
  const before = count();
  world.clock.advance(10_000);
  await world.app.cycle();
  assert.equal(count(), before, 'nothing changed');

  world.netio.output(2).State = 0; // switched off with the Netio button
  world.netio.output(1).Load = 60;
  world.clock.advance(10_000);
  await world.app.cycle();
  assert.equal(world.state(`${SERIAL}-2`, 'state'), 0, 'the switch at once');
  assert.equal(world.state(`${SERIAL}-1`, 'power'), 52, 'the power waits');

  world.clock.advance(60_000);
  await world.app.cycle();
  assert.equal(world.state(`${SERIAL}-1`, 'power'), 60);
  assert.equal(world.state(`${SERIAL}-2`, 'power'), 0);
});

test('a Netio lost and back: one event each, badges, status, one log line each', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const events = () => world.gladys.fake.sceneEvents.map((event) => event.key);
  world.netio.down = true;
  await world.app.cycle();
  await world.app.cycle();
  assert.deepEqual(events(), ['netio_unreachable']);
  assert.deepEqual(world.gladys.fake.sceneEvents[0].data, { netio: 'Rack' });
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /^Rack : ne répond pas/);
  assert.ok(
    world.gladys.fake.transports.some((entry) => entry.transport === 'unreachable'),
    'the devices show unreachable',
  );
  assert.equal(world.logs.at('warn').length, 1, 'one warning, not one per cycle');

  world.netio.down = false;
  await world.app.cycle();
  assert.deepEqual(events(), ['netio_unreachable', 'netio_reachable_again']);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.gladys.fake.transports.at(-1).transport, 'local');
  assert.match(world.logs.at('info').at(-1).text, /answers again/);
});

test('a Netio down at start fires nothing; a wrong account is said in the status', async (t) => {
  const fake = createFakeNetio(fixture('netio-4all'), { read: READ, write: WRITE });
  const world = await createWorld({
    netios: { [HOST_1]: fake },
    config: slot1({ netio_1_password: 'bad-pass-123' }),
  });
  t.after(() => world.app.stop());
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
  assert.equal(world.gladys.fake.discoveredDevices.length, 0);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /wrong user name or password/);
  for (const line of world.logs.lines) {
    assert.doesNotMatch(line.text, /bad-pass-123|write-secret/, 'no password in the logs');
  }
});

test('configuration: nothing, an invalid address, then a Netio', async (t) => {
  const world = await createWorld({ config: {} });
  t.after(() => world.app.stop());
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /Enter the address/);
  await world.gladys.fake.configUpdated({ netio_1_host: 'bad host' });
  assert.match(world.gladys.fake.connectionStatus.message.en, /not valid/);
  await world.gladys.fake.configUpdated(slot1({ language: 'en' }));
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.device(`${SERIAL}-3`).name, 'Rack output 3');
});

test('the container reads the Netio on its own timer, without onPoll', async (t) => {
  const world = await createWorld({ config: slot1({ poll_interval: '5' }), timers: true });
  t.after(() => world.app.stop());
  world.netio.output(2).State = 0;
  await new Promise((resolve) => setTimeout(resolve, 5300));
  assert.equal(world.state(`${SERIAL}-2`, 'state'), 0);
});

test('a normal cycle writes nothing at the info level', async (t) => {
  const world = await createWorld({ clock: createClock() });
  t.after(() => world.app.stop());
  const before = world.logs.at('info').length;
  for (let i = 0; i < 3; i += 1) {
    world.clock.advance(70_000);
    world.netio.output(1).Load += 3;
    await world.app.cycle();
  }
  assert.equal(world.logs.at('info').length, before);
  assert.equal(world.logs.at('warn').length, 0);
});

test('a reconnection of Gladys publishes everything again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const before = world.gladys.fake.states.length;
  await world.gladys.disconnect();
  await world.gladys.connect();
  assert.ok(world.gladys.fake.states.length > before, 'states sent again');
});
