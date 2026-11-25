// -----------------------------------------------------------------------------
// The answer of `GET /netio.json`, turned into plain values with Gladys units.
//
// Netio units (M2M API protocol JSON): Voltage V, Frequency Hz, currents mA
// (TotalCurrent, Current), loads W (TotalLoad, Load), energies Wh
// (TotalEnergy, Energy), power factors as a ratio. Converted here: amperes,
// kilowatt-hours. A model without metering (NETIO 4, PowerBOX 3Px,
// PowerCable 101x) has no `GlobalMeasure` and outputs with only ID, Name,
// State, Action and Delay: its values are null.
// -----------------------------------------------------------------------------

// Output actions of the JSON protocol.
export const NETIO_ACTIONS = Object.freeze({
  OFF: 0,
  ON: 1,
  SHORT_OFF: 2,
  SHORT_ON: 3,
  TOGGLE: 4,
  NO_CHANGE: 5,
  IGNORED: 6,
});

const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const string = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const scaled = (value, factor) => (number(value) === null ? null : value / factor);

/**
 * A platform id for the external ids: the serial number, else the MAC
 * address, lower case, letters and digits only. null when the Netio gives
 * neither (the caller falls back to the configuration slot).
 */
export function platformId(agent) {
  for (const raw of [agent?.SerialNumber, agent?.MAC]) {
    const id = typeof raw === 'string' ? raw.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    if (id) {
      return id;
    }
  }
  return null;
}

/**
 * @param {object} json the answer of GET /netio.json
 */
export function parseStatus(json) {
  const agent = json.Agent && typeof json.Agent === 'object' ? json.Agent : {};
  const global =
    json.GlobalMeasure && typeof json.GlobalMeasure === 'object' ? json.GlobalMeasure : null;
  const outputs = [];
  const seen = new Set();
  for (const raw of json.Outputs) {
    const id = raw?.ID;
    if (!Number.isInteger(id) || id < 1 || id > 99 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const metered = number(raw.Load) !== null || number(raw.Current) !== null;
    outputs.push({
      id,
      // "output_3" is the factory name: no name.
      name: /^output_?\d+$/i.test(string(raw.Name) ?? '') ? null : string(raw.Name),
      on: raw.State === 1 ? true : raw.State === 0 ? false : null,
      delayMs: number(raw.Delay),
      metered,
      power: number(raw.Load),
      current: scaled(raw.Current, 1000),
      powerFactor: number(raw.PowerFactor),
      energy: scaled(raw.Energy, 1000),
    });
  }
  outputs.sort((a, b) => a.id - b.id);
  return {
    model: string(agent.Model),
    name: string(agent.DeviceName),
    serial: string(agent.SerialNumber),
    firmware: string(agent.Version),
    jsonVersion: string(agent.JSONVer),
    platformId: platformId(agent),
    metered: global !== null,
    global: global && {
      voltage: number(global.Voltage),
      frequency: number(global.Frequency),
      current: scaled(global.TotalCurrent, 1000),
      powerFactor: number(global.OverallPowerFactor),
      power: number(global.TotalLoad),
      energy: scaled(global.TotalEnergy, 1000),
    },
    outputs,
  };
}
