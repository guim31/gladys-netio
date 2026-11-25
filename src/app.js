// -----------------------------------------------------------------------------
// The integration, wired to a Gladys client (the SDK's GladysIntegration, or
// its fake Gladys in the tests).
//
// Life of the integration:
// 1. On connection and on every configuration change, each configured Netio
//    is read (GET /netio.json) and its devices are published to the
//    Discovery tab.
// 2. Every refresh interval (5 to 60 s), the container's own timer reads
//    every Netio again: the switches that changed are published at once,
//    the measures at most once a minute (the core takes 300 states a
//    minute), only for the devices the user added. Gladys never polls these
//    devices (should_poll: false); onPoll is only a fallback.
// 3. A Netio that stops answering, or answers again, fires a scene event.
// 4. Commands (the switch, the scene action, the action of the integration
//    page, the widget): switching on is always allowed; switching off and
//    restarting (Netio "short off") only when "Allow switching off and
//    restarting" is ticked, off by default: a Netio often powers a server or
//    an internet box.
//
// Logs: info for the life cycle only (start, Netio found, lost and back, one
// line per user command); a normal cycle writes debug lines only.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { DEFAULT_CONFIG, normalizeConfig } from './config.js';
import { createClient, httpRequest } from './netio/client.js';
import { NETIO_ACTIONS, parseStatus } from './netio/parse.js';
import {
  FEATURES,
  buildDevices,
  buildStates,
  netioIds,
  netioName,
  outputIds,
  outputName,
  parseDeviceId,
} from './devices.js';
import { createIssueLog } from './issues.js';
import { MESSAGES, errorOf, localize, pick } from './i18n.js';
import { WIDGET_KEY, buildWidgetContent, CONTROL_ACTION } from './widgets.js';

export const ACTIONS = { testConnection: 'test_connection', controlOutput: 'control_output' };
export const SCENE_ACTIONS = { controlOutput: 'control_output' };
export const SCENE_TRIGGERS = {
  unreachable: 'netio_unreachable',
  reachable: 'netio_reachable_again',
};
export const WIDGETS = [WIDGET_KEY];

// Command keys (scene action, action, widget): permanent once published.
export const COMMANDS = Object.freeze({ ON: 'on', OFF: 'off', RESTART: 'restart' });
const COMMAND_ACTIONS = {
  [COMMANDS.ON]: NETIO_ACTIONS.ON,
  [COMMANDS.OFF]: NETIO_ACTIONS.OFF,
  [COMMANDS.RESTART]: NETIO_ACTIONS.SHORT_OFF,
};

export const TIMINGS = {
  // The measures (power, current, energy, voltage) go out at most this often.
  measuresEveryMs: 60 * 1000,
  // An unchanged value is published again after this long (Gladys shows
  // "no recent value" past 48 hours).
  heartbeatMs: 6 * 60 * 60 * 1000,
  // After a restart, the output is read again once its off delay is over.
  afterRestartMarginMs: 1500,
  defaultRestartDelayMs: 5000,
};

/**
 * A failed action: Gladys shows the thrown message in red, the returned one
 * in green. The message is the multi-language object.
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

const signature = (netio) => JSON.stringify([netio.baseUrl, netio.username, netio.password]);

/**
 * @param {object} options
 * @param {object} options.gladys GladysIntegration or the SDK's fake Gladys
 * @param {Function} [options.transport] HTTP request (node:http by default)
 * @param {object} [options.logger]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the refresh timer (tests drive cycles by hand)
 * @param {object} [options.timings] TIMINGS overrides
 */
export function createApp({
  gladys,
  transport = httpRequest,
  logger = createLogger({ name: 'netio' }),
  now = () => Date.now(),
  timers = true,
  timings: timingOverrides,
}) {
  const timings = { ...TIMINGS, ...timingOverrides };
  const issues = createIssueLog(logger);
  let config = normalizeConfig(DEFAULT_CONFIG);
  /** @type {Map<number, object>} by slot */
  const records = new Map();
  let timer = null;
  let stopped = false;
  let running = null;
  let lastCycleAt = -Infinity;
  let discoveredKey = null;
  let connectionKey = null;
  const transports = new Map();
  const restartTimers = new Set();

  // --- Records ---------------------------------------------------------------------

  function newRecord(netio) {
    return {
      netio,
      signature: signature(netio),
      client: createClient({
        baseUrl: netio.baseUrl,
        username: netio.username,
        password: netio.password,
        request: transport,
      }),
      status: null,
      platformId: null,
      error: null,
      reachable: null, // null: not known yet
      measuresAt: -Infinity,
      // Bumped around every command: a read sent before a command and
      // answered after it carries the old state, and is dropped.
      commandSeq: 0,
      dropped: false,
    };
  }

  const sortedRecords = () => [...records.values()].sort((a, b) => a.netio.slot - b.netio.slot);

  /** A Netio in the logs: never its account. */
  const label = (record) => `Netio ${record.netio.slot} (${record.netio.baseUrl})`;

  const nameOf = (record) => (record.status ? netioName(record.status) : record.netio.baseUrl);

  function recordOf(platformId) {
    return sortedRecords().find((record) => record.platformId === platformId) ?? null;
  }

  /** Our devices the user added to Gladys, and their feature ids. */
  function created() {
    const devices = new Map();
    const features = new Set();
    for (const device of gladys.devices ?? []) {
      if (parseDeviceId(gladys, device.external_id)) {
        devices.set(device.external_id, device);
        for (const feature of device.features ?? []) {
          features.add(feature.external_id);
        }
      }
    }
    return { devices, features };
  }

  /** The name of an output: given in Gladys, else the one it was proposed with. */
  function outputDisplayName(record, output, language = config.language) {
    const id = outputIds(gladys, record.platformId, output.id).device;
    const device = (gladys.devices ?? []).find((entry) => entry.external_id === id);
    return device?.name || outputName(record.status, output, language);
  }

  /** The name of a Netio: its device in Gladys, else the one of the Netio. */
  function netioDisplayName(record) {
    if (record.platformId) {
      const id = netioIds(gladys, record.platformId).device;
      const device = (gladys.devices ?? []).find((entry) => entry.external_id === id);
      if (device?.name) return device.name;
    }
    return nameOf(record);
  }

  // --- Reading ----------------------------------------------------------------------

  async function fire(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Scene event ${key} refused by Gladys (${err.message})`);
    }
  }

  /** Apply a parsed answer of the Netio to its record. */
  async function applyStatus(record, json) {
    const status = parseStatus(json);
    const firstRead = record.status === null;
    record.status = status;
    record.platformId = status.platformId ?? `slot${record.netio.slot}`;
    record.error = null;
    issues.ok(`netio ${record.netio.slot}`, `${label(record)} answers again`);
    if (firstRead) {
      logger.info(
        `${label(record)}: ${status.model ?? 'Netio'} ${status.firmware ?? ''}, ` +
          `${status.outputs.length} output(s)${status.metered ? ', metering' : ''}`,
      );
    }
    if (record.reachable === false) {
      await fire(SCENE_TRIGGERS.reachable, { netio: nameOf(record) });
    }
    record.reachable = true;
  }

  /** Read one Netio. @returns {Promise<boolean>} whether it answered */
  async function read(record) {
    const seq = record.commandSeq;
    try {
      const json = await record.client.read();
      if (record.dropped) return false;
      if (record.commandSeq !== seq) {
        logger.debug(`${label(record)}: reading older than a command, dropped`);
        return record.error === null;
      }
      await applyStatus(record, json);
      return true;
    } catch (err) {
      if (record.dropped) return false;
      // A command went through meanwhile: this failure is older than it.
      if (record.commandSeq !== seq) return record.error === null;
      if (!err.kind) throw err;
      record.error = { kind: err.kind, message: err.message };
      issues.fail(`netio ${record.netio.slot}`, `${label(record)}: ${err.message}`);
      if (record.reachable === true) {
        await fire(SCENE_TRIGGERS.unreachable, { netio: nameOf(record) });
      }
      record.reachable = false;
      return false;
    }
  }

  // --- Publishing -------------------------------------------------------------------

  async function publishDevices({ force = false } = {}) {
    const devices = sortedRecords()
      .filter((record) => record.status)
      .flatMap((record) => buildDevices(gladys, record.platformId, record.status, config.language));
    const key = JSON.stringify(devices);
    if (!force && key === discoveredKey) {
      return;
    }
    try {
      await gladys.publishDiscoveredDevices(devices);
      discoveredKey = key;
      issues.ok('publish', 'Devices accepted by Gladys again');
    } catch (err) {
      issues.fail('publish', `Gladys refused the devices (${err.message})`);
    }
  }

  /** The states of a Netio, for the devices the user added. */
  async function publishStates(record, { force = false } = {}) {
    if (!record.status || record.error) {
      return;
    }
    const { features } = created();
    const measuresDue = force || now() - record.measuresAt >= timings.measuresEveryMs;
    const states = buildStates(gladys, record.platformId, record.status)
      .filter((state) => features.has(state.device_feature_external_id))
      .filter((state) => measuresDue || !state.measure)
      .map(({ device_feature_external_id, state }) => ({ device_feature_external_id, state }));
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(states, {
        heartbeat: timings.heartbeatMs,
      });
      if (measuresDue) record.measuresAt = now();
      issues.ok('states', 'States accepted by Gladys again');
      logger.debug(`${label(record)}: ${count} state(s) published out of ${states.length}`);
    } catch (err) {
      issues.fail('states', `States not published (${err.message})`);
    }
  }

  /** The badge of the added devices: local, or unreachable with their Netio. */
  async function publishTransports() {
    const { devices } = created();
    const entries = [];
    for (const record of records.values()) {
      if (!record.platformId || record.reachable === null) continue;
      const transport = record.error ? DEVICE_TRANSPORTS.UNREACHABLE : DEVICE_TRANSPORTS.LOCAL;
      for (const externalId of devices.keys()) {
        const target = parseDeviceId(gladys, externalId);
        if (target.platformId === record.platformId && transports.get(externalId) !== transport) {
          entries.push({ external_id: externalId, transport });
        }
      }
    }
    if (entries.length === 0) return;
    try {
      await gladys.publishTransports(entries);
      for (const entry of entries) transports.set(entry.external_id, entry.transport);
    } catch (err) {
      logger.debug(`Transport badges not sent (${err.message})`);
    }
  }

  /** The status under the integration name: connected while one Netio answers. */
  function connectionStatus() {
    const { netios, invalidSlots } = config;
    if (netios.length === 0) {
      return {
        connected: false,
        message: invalidSlots.length ? MESSAGES.invalidHost : MESSAGES.notConfigured,
      };
    }
    const failing = sortedRecords().filter((record) => record.error);
    if (failing.length === 0 && invalidSlots.length === 0) {
      return { connected: true };
    }
    const message = localize((language) =>
      [
        ...failing.map((record) => pick(errorOf(nameOf(record), record.error.kind), language)),
        ...(invalidSlots.length ? [pick(MESSAGES.invalidHost, language)] : []),
      ]
        .join(' · ')
        .slice(0, 300),
    );
    return { connected: failing.length < records.size, message };
  }

  async function publishConnectionStatus() {
    const status = connectionStatus();
    const key = JSON.stringify(status);
    if (key === connectionKey) return;
    try {
      await gladys.setConnectionStatus(status.connected, status.message);
      connectionKey = key;
    } catch (err) {
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  function nudgeWidget() {
    try {
      gladys.requestWidgetRefresh(WIDGET_KEY);
    } catch (err) {
      logger.debug(`Widget nudge not sent (${err.message})`);
    }
  }

  /** Signature of what the widget shows: switches and reachability. */
  const widgetKey = () =>
    JSON.stringify(
      sortedRecords().map((record) => [
        record.error?.kind ?? null,
        record.status?.outputs.map((output) => output.on) ?? null,
      ]),
    );

  // --- The cycle --------------------------------------------------------------------

  async function runCycle({ forceDevices = false } = {}) {
    const before = widgetKey();
    await Promise.all(sortedRecords().map((record) => read(record)));
    lastCycleAt = now();
    await publishDevices({ force: forceDevices });
    for (const record of sortedRecords()) {
      await publishStates(record);
    }
    await publishTransports();
    await publishConnectionStatus();
    if (widgetKey() !== before) nudgeWidget();
  }

  function cycle(options) {
    if (!running) {
      running = runCycle(options)
        .catch((err) => logger.error(`Refresh cycle failed (${err.message})`))
        .finally(() => {
          running = null;
        });
    }
    return running;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped || records.size === 0) return;
    timer = setTimeout(async () => {
      timer = null;
      await cycle();
      schedule();
    }, config.pollIntervalMs);
  }

  // --- Configuration ----------------------------------------------------------------

  async function applyConfig(raw) {
    // The cycle in progress finishes on the records it started with.
    await running;
    const previous = config;
    config = normalizeConfig(raw ?? {});
    const wanted = new Map(config.netios.map((netio) => [netio.slot, netio]));
    for (const [slot, record] of records) {
      const netio = wanted.get(slot);
      if (!netio || record.signature !== signature(netio)) {
        record.dropped = true;
        records.delete(slot);
      }
    }
    for (const netio of config.netios) {
      if (!records.has(netio.slot)) records.set(netio.slot, newRecord(netio));
    }
    if (config.netios.length === 0) {
      logger.info(
        config.invalidSlots.length ? 'Invalid Netio address' : 'Waiting for a Netio address',
      );
    }
    // The widget form follows the option and the language.
    if (previous.allowPowerOff !== config.allowPowerOff || previous.language !== config.language) {
      nudgeWidget();
    }
    // The feature names follow the language: publish the list again.
    await running;
    await cycle({ forceDevices: previous.language !== config.language || discoveredKey === null });
    schedule();
  }

  // --- Commands ---------------------------------------------------------------------

  /** The record and output of an output device external id. */
  function outputOf(externalId) {
    const target = parseDeviceId(gladys, externalId);
    if (!target || target.kind !== 'output') return null;
    const record = recordOf(target.platformId);
    const output = record?.status?.outputs.find((entry) => entry.id === target.id);
    return output ? { record, output } : null;
  }

  function scheduleRead(record, delayMs) {
    if (!timers || stopped) return;
    const handle = setTimeout(() => {
      restartTimers.delete(handle);
      if (!record.dropped) {
        read(record)
          .then(() => publishStates(record))
          .then(nudgeWidget)
          .catch((err) => logger.debug(`Read after a restart failed (${err.message})`));
      }
    }, delayMs);
    handle.unref?.();
    restartTimers.add(handle);
  }

  /**
   * Send a command to an output. Throws an ActionFailure.
   * @returns {Promise<object>} the success message
   */
  async function command(externalId, commandKey, origin) {
    if (!Object.values(COMMANDS).includes(commandKey)) {
      throw new ActionFailure(MESSAGES.unknownCommand);
    }
    if (commandKey !== COMMANDS.ON && !config.allowPowerOff) {
      throw new ActionFailure(MESSAGES.offDisabled);
    }
    const found = outputOf(externalId);
    if (!found) {
      throw new ActionFailure(
        config.netios.length ? MESSAGES.unknownOutput : MESSAGES.notConfigured,
      );
    }
    const { record } = found;
    const name = outputDisplayName(record, found.output).slice(0, 60);
    let output = found.output;
    // The state of now, not of the last read: a restart is never blind.
    if (commandKey === COMMANDS.RESTART) {
      if (!(await read(record))) {
        throw new ActionFailure(MESSAGES.commandFailed(name, record.error?.kind ?? 'unreachable'));
      }
      output = record.status.outputs.find((entry) => entry.id === output.id) ?? output;
      if (output.on === false) {
        throw new ActionFailure(MESSAGES.restartWhileOff(name));
      }
    }
    logger.info(`${origin}: ${commandKey} ${name}`);
    let json;
    record.commandSeq += 1;
    try {
      json = await record.client.control([{ ID: output.id, Action: COMMAND_ACTIONS[commandKey] }]);
    } catch (err) {
      logger.warn(
        `${label(record)}: ${commandKey} output ${output.id} not applied (${err.message})`,
      );
      throw new ActionFailure(MESSAGES.commandFailed(name, err.kind ?? 'http'));
    }
    record.commandSeq += 1;
    // The answer of the POST is used only when it is the whole state of the
    // same Netio; otherwise (or unknown on real hardware) read it again.
    const answer = json ? parseStatus(json) : null;
    if (
      answer &&
      answer.platformId === record.platformId &&
      answer.metered === record.status.metered &&
      answer.outputs.length === record.status.outputs.length
    ) {
      await applyStatus(record, json);
    } else {
      await read(record);
    }
    await publishStates(record);
    if (commandKey === COMMANDS.RESTART) {
      scheduleRead(
        record,
        (output.delayMs ?? timings.defaultRestartDelayMs) + timings.afterRestartMarginMs,
      );
    }
    nudgeWidget();
    return MESSAGES.done(name, commandKey);
  }

  // --- Handlers ---------------------------------------------------------------------

  const handlers = {
    async scanRequest() {
      await cycle({ forceDevices: true });
    },

    /** The core's onPoll: a fallback, skipped while the timer is on time. */
    async poll() {
      if (now() - lastCycleAt >= config.pollIntervalMs * 0.5) await cycle();
    },

    async setValue(device, feature, value) {
      if (!feature?.external_id?.endsWith(`:${FEATURES.state}`)) {
        throw new Error(pick(MESSAGES.unknownOutput, config.language));
      }
      const wanted = Number(value);
      if (wanted !== 0 && wanted !== 1) {
        throw new Error(pick(MESSAGES.unknownCommand, config.language));
      }
      try {
        await command(device.external_id, wanted === 1 ? COMMANDS.ON : COMMANDS.OFF, 'Switch');
      } catch (err) {
        // The dashboard flipped its toggle already: send the real state again.
        const found = outputOf(device.external_id);
        if (found) {
          gladys.forgetPublishedStates?.(feature.external_id);
          await publishStates(found.record, { force: true });
        }
        throw err instanceof ActionFailure ? new Error(pick(err.message, config.language)) : err;
      }
    },

    /** A device was just added or updated: Gladys needs all its states now. */
    async deviceChanged(device) {
      const target = parseDeviceId(gladys, device?.external_id);
      const record = target && recordOf(target.platformId);
      if (!record) return;
      transports.delete(device.external_id);
      await publishStates(record, { force: true });
      await publishTransports();
      nudgeWidget();
    },

    deviceDeleted(device) {
      transports.delete(device?.external_id);
      nudgeWidget();
    },

    async testConnection() {
      logger.info('Action: test the connection');
      if (config.netios.length === 0) {
        throw new ActionFailure(connectionStatus().message);
      }
      await cycle({ forceDevices: true });
      const message = localize((language) => {
        const lines = sortedRecords().map((record) =>
          record.error || !record.status
            ? pick(errorOf(nameOf(record), record.error?.kind ?? 'unreachable'), language)
            : pick(
                MESSAGES.found({
                  name: nameOf(record),
                  model: record.status.model ?? 'Netio',
                  outputs: record.status.outputs.length,
                  metered: record.status.metered,
                }),
                language,
              ),
        );
        if (config.invalidSlots.length) lines.push(pick(MESSAGES.invalidHost, language));
        return lines.join('\n').slice(0, 1000);
      });
      if (
        sortedRecords().some((record) => record.error || !record.status) ||
        config.invalidSlots.length
      ) {
        throw new ActionFailure(message);
      }
      return message;
    },

    controlOutputAction: (fields) => command(fields?.output, fields?.command, 'Action'),

    async controlOutputScene(fields) {
      await command(fields?.output, fields?.command, 'Scene');
    },

    async widgetGet({ settings, language } = {}) {
      const lang = ['en', 'fr', 'de', 'es'].includes(language) ? language : config.language;
      const target = parseDeviceId(gladys, settings?.device);
      const record =
        (target && recordOf(target.platformId)) ??
        sortedRecords().find((entry) => entry.status) ??
        sortedRecords()[0] ??
        null;
      return buildWidgetContent({
        gladys,
        record,
        configured: config.netios.length > 0,
        allowPowerOff: config.allowPowerOff,
        created: created(),
        outputName: (output) => outputDisplayName(record, output, lang),
        netioName: () => netioDisplayName(record),
        settings,
        language: lang,
      });
    },

    async widgetAction(actionKey, params, { values } = {}) {
      if (actionKey !== CONTROL_ACTION) {
        throw new ActionFailure(MESSAGES.unknownCommand);
      }
      const record = recordOf(params?.netio);
      const id = Number(values?.output);
      const externalId =
        record && Number.isInteger(id) ? outputIds(gladys, record.platformId, id).device : null;
      return command(externalId, values?.command, 'Widget');
    },
  };

  return {
    handlers,
    records,
    get config() {
      return config;
    },
    cycle,
    connectionStatus,

    /** Register every handler on the Gladys client (before connect()). */
    register() {
      gladys.onScanRequest(() => handlers.scanRequest());
      gladys.onPoll(() => handlers.poll());
      gladys.onSetValue((device, feature, value) => handlers.setValue(device, feature, value));
      gladys.onDeviceCreated((device) => handlers.deviceChanged(device));
      gladys.onDeviceUpdated((device) => handlers.deviceChanged(device));
      gladys.onDeviceDeleted((device) => handlers.deviceDeleted(device));
      gladys.onAction(ACTIONS.testConnection, () => handlers.testConnection());
      gladys.onAction(ACTIONS.controlOutput, (fields) => handlers.controlOutputAction(fields));
      gladys.onSceneAction(SCENE_ACTIONS.controlOutput, (fields) =>
        handlers.controlOutputScene(fields),
      );
      gladys.onWidgetGet(WIDGET_KEY, (context) => handlers.widgetGet(context));
      gladys.onWidgetAction(WIDGET_KEY, (actionKey, params, context) =>
        handlers.widgetAction(actionKey, params, context),
      );
      gladys.onConfigUpdated(async (raw) => {
        logger.info('Configuration updated');
        await applyConfig(raw);
      });
      gladys.on('connected', async () => {
        try {
          // A reconnection (Gladys restarted): send everything again.
          discoveredKey = null;
          connectionKey = null;
          transports.clear();
          gladys.forgetPublishedStates?.();
          await applyConfig(await gladys.getConfig());
        } catch (err) {
          logger.error(`Initialization failed (${err.message})`);
        }
      });
    },

    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      for (const handle of restartTimers) clearTimeout(handle);
      restartTimers.clear();
      await running;
    },
  };
}
