// -----------------------------------------------------------------------------
// Configuration of the integration, as filled in by the user from the
// manifest `config_schema`. DEFAULT_CONFIG mirrors the manifest defaults
// (test/manifest.test.js keeps them equal); normalizeConfig() turns whatever
// the form sends into checked values, so the rest of the code never deals
// with an empty or malformed field.
//
// Up to three Netio devices, each in its own slot: an address and the
// account of the JSON API (M2M API → JSON in the Netio web interface).
// -----------------------------------------------------------------------------

export const LANGUAGE_OPTIONS = ['fr', 'en', 'de', 'es'];
export const SLOTS = [1, 2, 3];

// Refresh intervals offered in the form, in seconds. A Netio answers its
// JSON API in a few milliseconds: 10 s keeps the switches responsive.
export const POLL_INTERVALS_S = [5, 10, 30, 60];

export const DEFAULT_CONFIG = {
  netio_1_host: '',
  netio_1_username: '',
  netio_1_password: '',
  netio_2_host: '',
  netio_2_username: '',
  netio_2_password: '',
  netio_3_host: '',
  netio_3_username: '',
  netio_3_password: '',
  poll_interval: '10',
  allow_power_off: false,
  language: 'fr',
};

/**
 * Turn what the user typed into the base URL of a Netio.
 * "192.0.2.10", "192.0.2.10:8080", "http://netio.lan/", "https://192.0.2.10"
 * are accepted; a path is dropped, and so are credentials typed in the URL
 * (they must not end up in a log line: the account has its own fields).
 * @returns {{ baseUrl: string, valid: boolean }} baseUrl '' when empty or invalid
 */
export function parseHost(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') {
    return { baseUrl: '', valid: true };
  }
  if (/\s/.test(text)) {
    return { baseUrl: '', valid: false };
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return { baseUrl: '', valid: false };
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname === '') {
    return { baseUrl: '', valid: false };
  }
  return { baseUrl: `${url.protocol}//${url.host}`, valid: true };
}

/** A boolean from the form (true, "true", 1, "1"); anything else is false. */
function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @param {Record<string, unknown>} [raw] the config from the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const netios = [];
  const invalidSlots = [];
  for (const slot of SLOTS) {
    const { baseUrl, valid } = parseHost(source[`netio_${slot}_host`]);
    if (!valid) {
      invalidSlots.push(slot);
      continue;
    }
    if (!baseUrl) {
      continue;
    }
    const password = source[`netio_${slot}_password`];
    netios.push({
      slot,
      baseUrl,
      username: text(source[`netio_${slot}_username`]),
      // A pasted password often carries a trailing new line; spaces inside are kept.
      password: typeof password === 'string' ? password.replace(/^[\r\n]+|[\r\n]+$/g, '') : '',
    });
  }
  const interval = Number(source.poll_interval ?? DEFAULT_CONFIG.poll_interval);
  return {
    netios,
    invalidSlots,
    pollIntervalMs:
      (POLL_INTERVALS_S.includes(interval) ? interval : Number(DEFAULT_CONFIG.poll_interval)) *
      1000,
    allowPowerOff: bool(source.allow_power_off),
    language: LANGUAGE_OPTIONS.includes(source.language)
      ? source.language
      : DEFAULT_CONFIG.language,
  };
}
