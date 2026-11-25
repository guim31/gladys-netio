import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseHost } from '../src/config.js';

test('parseHost: addresses, ports, https, a path dropped, the rest refused', () => {
  assert.deepEqual(parseHost('192.0.2.10'), { baseUrl: 'http://192.0.2.10', valid: true });
  assert.deepEqual(parseHost(' 192.0.2.10:8080 '), {
    baseUrl: 'http://192.0.2.10:8080',
    valid: true,
  });
  assert.deepEqual(parseHost('https://netio.lan/netio.json'), {
    baseUrl: 'https://netio.lan',
    valid: true,
  });
  // Credentials typed in the URL never reach the base URL (nor the logs).
  assert.deepEqual(parseHost('http://admin:secret@192.0.2.10'), {
    baseUrl: 'http://192.0.2.10',
    valid: true,
  });
  assert.deepEqual(parseHost(''), { baseUrl: '', valid: true });
  assert.equal(parseHost('ftp://192.0.2.10').valid, false);
  assert.equal(parseHost('192.0.2.10 extra').valid, false);
});

test('normalizeConfig: slots, invalid addresses, defaults', () => {
  const config = normalizeConfig({
    netio_1_host: '192.0.2.10',
    netio_1_username: ' admin ',
    netio_1_password: 'pass word\n',
    netio_2_host: 'not a host',
    netio_3_host: '',
    poll_interval: '30',
    allow_power_off: 'true',
    language: 'de',
  });
  assert.deepEqual(config.netios, [
    { slot: 1, baseUrl: 'http://192.0.2.10', username: 'admin', password: 'pass word' },
  ]);
  assert.deepEqual(config.invalidSlots, [2]);
  assert.equal(config.pollIntervalMs, 30000);
  assert.equal(config.allowPowerOff, true);
  assert.equal(config.language, 'de');

  const defaults = normalizeConfig({ poll_interval: '7', language: 'it' });
  assert.equal(defaults.pollIntervalMs, 10000);
  assert.equal(defaults.allowPowerOff, false);
  assert.equal(defaults.language, 'fr');
  assert.deepEqual(normalizeConfig(null).netios, []);
});
