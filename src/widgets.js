// -----------------------------------------------------------------------------
// The "Netio outputs" dashboard widget: one Netio (chosen in its settings,
// the first one otherwise), its outputs on or off with their power, the
// total power, voltage and frequency on the metering models, and a button
// that opens a form to switch an output on, off or restart it (Gladys 5.2+).
//
// A widget never costs a request to the Netio: the content is built from the
// last cycle. The form fields carry multi-language labels (the core picks
// the language when it renders the form). Budget of the core: 8 components; this content uses at most
// 3 tiles, 1 status list and 1 button. The measures and the button can be
// hidden (widget settings). Switching off and restarting are only offered
// when the configuration allows them.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FEATURES, netioIds, netioName } from './devices.js';
import {
  COMMAND_TEXT,
  STATE_TEXT,
  WIDGET_MESSAGES,
  WIDGET_TEXT,
  formatNumber,
  localize,
  pick,
} from './i18n.js';

export const WIDGET_KEY = 'outputs';
export const CONTROL_ACTION = 'control';
export const WIDGET_TTL_SECONDS = 30;
export const WIDGET_SETTINGS_DEFAULTS = { show_measures: true, show_control: true };
const MAX_ROWS = 10;

const setting = (settings, key) =>
  typeof settings?.[key] === 'boolean' ? settings[key] : WIDGET_SETTINGS_DEFAULTS[key];

const message = (text, language) => ({
  ttl_seconds: WIDGET_TTL_SECONDS,
  components: [{ type: 'text', variant: 'body', text: pick(text, language) }],
});

/** A tile bound to a feature of the Netio device when the user added it. */
function tile(label, icon, featureId, created, value, unit) {
  if (created.features.has(featureId)) {
    return { type: 'value', label, icon, device_feature: featureId };
  }
  return value === null || value === undefined ? null : { type: 'value', label, icon, value, unit };
}

/**
 * @param {object} input
 * @param {object} input.gladys
 * @param {object|null} input.record the Netio shown (src/app.js)
 * @param {boolean} input.configured
 * @param {boolean} input.allowPowerOff
 * @param {{ features: Set<string> }} input.created
 * @param {(output: object) => string} input.outputName
 * @param {object} [input.settings]
 * @param {string} input.language
 */
export function buildWidgetContent({
  gladys,
  record,
  configured,
  allowPowerOff,
  created,
  outputName,
  settings,
  language,
}) {
  if (!configured || !record) {
    return message(WIDGET_MESSAGES.notConfigured, language);
  }
  if (!record.status) {
    return message(WIDGET_MESSAGES.noData, language);
  }
  const { status } = record;
  const measures = setting(settings, 'show_measures');
  const components = [];

  if (measures && status.metered && !record.error) {
    const ids = netioIds(gladys, record.platformId);
    const { global } = status;
    components.push(
      ...[
        tile(
          pick(WIDGET_TEXT.power, language),
          'zap',
          ids.feature(FEATURES.totalPower),
          created,
          global.power === null ? null : Math.round(global.power),
          'W',
        ),
        tile(
          pick(WIDGET_TEXT.voltage, language),
          'activity',
          ids.feature(FEATURES.voltage),
          created,
          global.voltage === null ? null : formatNumber(global.voltage, 1, language),
          'V',
        ),
        global.frequency === null
          ? null
          : {
              type: 'value',
              label: pick(WIDGET_TEXT.frequency, language),
              icon: 'radio',
              value: formatNumber(global.frequency, 1, language),
              unit: 'Hz',
            },
      ].filter(Boolean),
    );
  }

  const items = [];
  if (record.error) {
    items.push({
      label: netioName(status).slice(0, 40),
      value: pick(WIDGET_TEXT.unreachable, language),
      icon: 'alert-triangle',
      color: WIDGET_COLORS.DANGER,
    });
  }
  for (const output of status.outputs.slice(0, MAX_ROWS - items.length)) {
    let value = pick(
      output.on === null ? STATE_TEXT.unknown : output.on ? STATE_TEXT.on : STATE_TEXT.off,
      language,
    );
    if (measures && output.metered && output.on && output.power !== null) {
      value = `${value} · ${Math.round(output.power)} W`;
    }
    items.push({
      label: outputName(output).slice(0, 40),
      value: value.slice(0, 40),
      icon: 'power',
      color: record.error
        ? WIDGET_COLORS.NEUTRAL
        : output.on
          ? WIDGET_COLORS.SUCCESS
          : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }

  if (setting(settings, 'show_control') && !record.error && status.outputs.length > 0) {
    const commands = allowPowerOff ? ['on', 'off', 'restart'] : ['on'];
    components.push({
      type: 'button',
      label: pick(WIDGET_TEXT.control, language),
      icon: 'power',
      action: {
        key: CONTROL_ACTION,
        params: { netio: record.platformId },
        fields: [
          {
            key: 'output',
            type: 'select',
            required: true,
            label: WIDGET_TEXT.output,
            default: String(status.outputs[0].id),
            options: status.outputs.map((output) => ({
              value: String(output.id),
              label: localize(() => outputName(output).slice(0, 60)),
            })),
          },
          {
            key: 'command',
            type: 'select',
            required: true,
            label: WIDGET_TEXT.command,
            default: 'on',
            options: commands.map((command) => ({
              value: command,
              label: COMMAND_TEXT[command],
            })),
          },
        ],
      },
    });
  }
  return { ttl_seconds: WIDGET_TTL_SECONDS, components };
}
