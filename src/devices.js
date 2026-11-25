// -----------------------------------------------------------------------------
// The Gladys devices of a Netio, and their states.
//
// - One device per output: its switch (switch/binary, writable), and on the
//   metering models its power (W), current (A) and energy (kWh), the
//   couples Gladys uses for its own smart plugs.
// - One device for the Netio itself, on the metering models only: voltage,
//   total power, total current, total energy. A model without metering has
//   nothing to show there.
//
// External ids (forever): the serial number of the Netio (its MAC address
// when it has none), and the output number: `netio:<serial>` and
// `netio-output:<serial>-<id>`. Feature keys (forever): FEATURES below.
//
// No frequency nor power factor feature: Gladys has no unit for hertz and no
// type for a power factor. Both are in the widget and the scene outputs.
//
// Published with should_poll: false: the container reads the Netio on its
// own timer (src/app.js), at the interval chosen in the configuration.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { DEVICE_NAMES, FEATURE_NAMES, pick } from './i18n.js';

export const NETIO_TYPE = 'netio';
export const OUTPUT_TYPE = 'netio-output';

export const FEATURES = Object.freeze({
  state: 'state',
  power: 'power',
  current: 'current',
  energy: 'energy',
  voltage: 'voltage',
  totalPower: 'total_power',
  totalCurrent: 'total_current',
  totalEnergy: 'total_energy',
});

// Display bounds (the core never applies them on write). A Netio output is
// rated 16 A at most (PowerPDU, 230 V).
const KIND = {
  binary: { min: 0, max: 1 },
  power: { unit: U.WATT, min: 0, max: 4000 },
  current: { unit: U.AMPERE, min: 0, max: 16 },
  energy: { unit: U.KILOWATT_HOUR, min: 0, max: 1000000 },
  voltage: { unit: U.VOLT, min: 0, max: 300 },
};

const OUTPUT_FEATURES = [
  { key: FEATURES.state, couple: [C.SWITCH, T.SWITCH.BINARY], kind: KIND.binary, writable: true },
  { key: FEATURES.power, couple: [C.SWITCH, T.SWITCH.POWER], kind: KIND.power, metered: true },
  {
    key: FEATURES.current,
    couple: [C.SWITCH, T.SWITCH.CURRENT],
    kind: KIND.current,
    metered: true,
  },
  { key: FEATURES.energy, couple: [C.SWITCH, T.SWITCH.ENERGY], kind: KIND.energy, metered: true },
];

const NETIO_FEATURES = [
  { key: FEATURES.voltage, couple: [C.ENERGY_SENSOR, T.ENERGY_SENSOR.VOLTAGE], kind: KIND.voltage },
  {
    key: FEATURES.totalPower,
    couple: [C.ENERGY_SENSOR, T.ENERGY_SENSOR.POWER],
    kind: { ...KIND.power, max: 16000 },
  },
  {
    key: FEATURES.totalCurrent,
    couple: [C.ENERGY_SENSOR, T.ENERGY_SENSOR.CURRENT],
    kind: { ...KIND.current, max: 64 },
  },
  {
    key: FEATURES.totalEnergy,
    couple: [C.ENERGY_SENSOR, T.ENERGY_SENSOR.ENERGY],
    kind: KIND.energy,
  },
];

export const netioIds = (gladys, platformId) => gladys.externalIds(NETIO_TYPE, platformId);
export const outputIds = (gladys, platformId, id) =>
  gladys.externalIds(OUTPUT_TYPE, `${platformId}-${id}`);

/**
 * What a device external id names: `{ kind: 'netio', platformId }` or
 * `{ kind: 'output', platformId, id }`; null when not ours.
 */
export function parseDeviceId(gladys, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  const outputPrefix = gladys.externalIds(OUTPUT_TYPE, '').device;
  const netioPrefix = gladys.externalIds(NETIO_TYPE, '').device;
  if (externalId.startsWith(outputPrefix)) {
    const match = externalId.slice(outputPrefix.length).match(/^([a-z0-9]+)-(\d{1,2})$/);
    return match ? { kind: 'output', platformId: match[1], id: Number(match[2]) } : null;
  }
  if (externalId.startsWith(netioPrefix)) {
    const match = externalId.slice(netioPrefix.length).match(/^([a-z0-9]+)$/);
    return match ? { kind: 'netio', platformId: match[1] } : null;
  }
  return null;
}

function feature(ids, spec, language) {
  return {
    name: pick(FEATURE_NAMES[keyName(spec.key)], language),
    external_id: ids.feature(spec.key),
    category: spec.couple[0],
    type: spec.couple[1],
    ...(spec.kind.unit ? { unit: spec.kind.unit } : {}),
    min: spec.kind.min,
    max: spec.kind.max,
    read_only: !spec.writable,
    has_feedback: Boolean(spec.writable),
    keep_history: true,
  };
}

const keyName = (key) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

/** The name of the Netio: given in the Netio, else its model. */
export const netioName = (status) => status.name ?? status.model ?? 'Netio';

/** The name of an output for a new device. */
export function outputName(status, output, language) {
  const netio = netioName(status);
  return output.name
    ? `${netio} ${output.name}`
    : pick(DEVICE_NAMES.output(netio, output.id), language);
}

/**
 * The devices of a Netio, ready for publishDiscoveredDevices.
 * @param {object} gladys
 * @param {string} platformId
 * @param {object} status parsed (src/netio/parse.js)
 * @param {string} language feature names language
 */
export function buildDevices(gladys, platformId, status, language) {
  const params = [
    ['Serial number', status.serial],
    ['Firmware', status.firmware],
  ]
    .filter(([, value]) => value)
    .map(([name, value]) => ({ name, value: String(value).slice(0, 255) }));
  const model = (status.model ?? 'Netio').slice(0, 255);
  const devices = [];
  if (status.metered) {
    const ids = netioIds(gladys, platformId);
    devices.push({
      name: netioName(status).slice(0, 255),
      external_id: ids.device,
      model,
      should_poll: false,
      params,
      features: NETIO_FEATURES.map((spec) => feature(ids, spec, language)),
    });
  }
  for (const output of status.outputs) {
    const ids = outputIds(gladys, platformId, output.id);
    devices.push({
      name: outputName(status, output, language).slice(0, 255),
      external_id: ids.device,
      model,
      should_poll: false,
      params,
      features: OUTPUT_FEATURES.filter((spec) => !spec.metered || output.metered).map((spec) =>
        feature(ids, spec, language),
      ),
    });
  }
  return devices;
}

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * The states of a Netio, as `{ device_feature_external_id, state, measure }`:
 * `measure` marks the values that move at every read (src/app.js publishes
 * them at most once a minute), the switches go out at once.
 */
export function buildStates(gladys, platformId, status) {
  const states = [];
  const push = (externalId, value, digits, measure = true) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      states.push({ device_feature_external_id: externalId, state: round(value, digits), measure });
    }
  };
  if (status.metered) {
    const ids = netioIds(gladys, platformId);
    push(ids.feature(FEATURES.voltage), status.global.voltage, 1);
    push(ids.feature(FEATURES.totalPower), status.global.power, 0);
    push(ids.feature(FEATURES.totalCurrent), status.global.current, 3);
    push(ids.feature(FEATURES.totalEnergy), status.global.energy, 3);
  }
  for (const output of status.outputs) {
    const ids = outputIds(gladys, platformId, output.id);
    if (output.on !== null) {
      push(ids.feature(FEATURES.state), output.on ? 1 : 0, 0, false);
    }
    if (output.metered) {
      push(ids.feature(FEATURES.power), output.power, 0);
      push(ids.feature(FEATURES.current), output.current, 3);
      push(ids.feature(FEATURES.energy), output.energy, 3);
    }
  }
  return states;
}
