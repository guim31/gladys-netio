// -----------------------------------------------------------------------------
// The "Netio outputs" widget: valid for the core (vocabulary and budget),
// tiles bound to features that exist, the names given in Gladys, the
// optional blocks that can be hidden, switching off offered only when
// allowed, the messages without configuration or reading.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeNetio, fixture } from './helpers/fakeNetio.js';
import { HOST_1, HOST_2, createWorld, slot1 } from './helpers/world.js';

const SERIAL = '24a42c390001';

async function content(world, settings = {}, language = 'en') {
  const ack = await world.gladys.fake.widgetGet('outputs', { settings, language });
  assert.equal(ack.success, true);
  const value = ack.data.content;
  assert.deepEqual(validateWidgetContent(value), [], 'rendered exactly as sent');
  return value;
}

test('metering Netio: tiles bound to its features, one line per output, the form', async (t) => {
  const w = await createWorld();
  t.after(() => w.app.stop());
  // A name given in Gladys wins over the proposed one.
  const renamed = { ...w.device(`${SERIAL}-1`), name: 'NAS' };
  await w.gladys.fake.deviceUpdated(renamed);
  const widget = await content(w);
  const features = new Set(
    w.gladys.fake.discoveredDevices.flatMap((d) => d.features.map((f) => f.external_id)),
  );
  const tiles = widget.components.filter((c) => c.type === 'value');
  assert.equal(tiles.length, 3);
  for (const bound of tiles.filter((c) => c.device_feature)) {
    assert.ok(features.has(bound.device_feature), `${bound.device_feature} exists`);
  }
  const status = widget.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['NAS', 'On · 52 W'],
      ['Rack Router', 'On · 16 W'],
      ['Rack sortie 3', 'Off'], // the name the device was added with
      ['Rack sortie 4', 'Off'],
    ],
  );
  const button = widget.components.find((c) => c.type === 'button');
  assert.deepEqual(
    button.action.fields[1].options.map((o) => o.value),
    ['on'],
    'switching off not offered',
  );
  assert.equal(button.action.fields[0].options[0].label.en, 'NAS');
});

test('settings: hide measures and button, pick the Netio, off and restart when allowed', async (t) => {
  const w = await createWorld({
    netios: {
      [HOST_1]: createFakeNetio(fixture('netio-4all')),
      [HOST_2]: createFakeNetio(fixture('netio-4')),
    },
    config: slot1({ netio_2_host: HOST_2, allow_power_off: true }),
  });
  t.after(() => w.app.stop());
  const hidden = await content(w, { show_measures: false, show_control: false });
  assert.deepEqual(
    hidden.components.map((c) => c.type),
    ['status'],
  );
  assert.equal(hidden.components[0].items[0].value, 'On');

  const office = await content(w, { device: w.device('24a42c390002-2').external_id }, 'fr');
  assert.deepEqual(
    office.components.map((c) => c.type),
    ['status', 'button'],
    'no measures on a NETIO 4',
  );
  assert.equal(office.components[0].items[0].label, 'Office Printer');
  assert.deepEqual(
    office.components[1].action.fields[1].options.map((o) => o.value),
    ['on', 'off', 'restart'],
  );
  assert.deepEqual(office.components[1].action.params, { netio: '24a42c390002' });
});

test('messages: not configured, Netio not answering', async (t) => {
  const empty = await createWorld({ config: {} });
  t.after(() => empty.app.stop());
  assert.match((await content(empty)).components[0].text, /Enter the address/);

  const w = await createWorld();
  t.after(() => w.app.stop());
  w.netio.down = true;
  await w.app.cycle();
  const widget = await content(w);
  const status = widget.components.find((c) => c.type === 'status');
  assert.deepEqual(status.items[0], {
    label: 'Rack',
    value: 'Not answering',
    icon: 'alert-triangle',
    color: 'danger',
  });
  assert.ok(!widget.components.some((c) => c.type === 'button'), 'no command to a lost Netio');
});
