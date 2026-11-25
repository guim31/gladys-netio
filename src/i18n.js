// -----------------------------------------------------------------------------
// Every text the code shows to the user, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted".
// test/i18n.test.js checks that each one exists in all four, is not empty
// and fits where it is shown, and that no other source file writes a text.
//
// Vocabulary taken from the Gladys interface (front/src/config/i18n) and from
// Netio's own (output / sortie / Ausgang / salida). Brand and model names are
// not translated.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The text of one language, English when it is missing. */
export function pick(text, language) {
  return text?.[language] ?? text?.en ?? '';
}

/** A multi-language object built by one function per language. */
export function localize(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/** Decimal number in the conventions of a language, without thousands separator. */
export function formatNumber(value, digits, language) {
  const text = Number(value).toFixed(digits);
  return language === 'en' ? text : text.replace('.', ',');
}

// --- Device and feature names (frozen by Gladys when the device is created) ---

export const DEVICE_NAMES = {
  /** An output without a name in the Netio. */
  output: (netio, id) => ({
    en: `${netio} output ${id}`,
    fr: `${netio} sortie ${id}`,
    de: `${netio} Ausgang ${id}`,
    es: `${netio} salida ${id}`,
  }),
};

export const FEATURE_NAMES = {
  state: { en: 'On/off', fr: 'Marche/arrêt', de: 'Ein/Aus', es: 'Encendido/apagado' },
  power: { en: 'Power', fr: 'Puissance', de: 'Leistung', es: 'Potencia' },
  current: { en: 'Current', fr: 'Courant', de: 'Strom', es: 'Corriente' },
  energy: { en: 'Energy', fr: 'Énergie', de: 'Energie', es: 'Energía' },
  voltage: { en: 'Voltage', fr: 'Tension', de: 'Spannung', es: 'Tensión' },
  totalPower: {
    en: 'Total power',
    fr: 'Puissance totale',
    de: 'Gesamtleistung',
    es: 'Potencia total',
  },
  totalCurrent: {
    en: 'Total current',
    fr: 'Courant total',
    de: 'Gesamtstrom',
    es: 'Corriente total',
  },
  totalEnergy: {
    en: 'Total energy',
    fr: 'Énergie totale',
    de: 'Gesamtenergie',
    es: 'Energía total',
  },
};

// --- Output states and commands (widget, scene action, 24 characters at most) ---

export const STATE_TEXT = {
  on: { en: 'On', fr: 'Allumée', de: 'Ein', es: 'Encendida' },
  off: { en: 'Off', fr: 'Éteinte', de: 'Aus', es: 'Apagada' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
};

export const COMMAND_TEXT = {
  on: { en: 'Switch on', fr: 'Allumer', de: 'Einschalten', es: 'Encender' },
  off: { en: 'Switch off', fr: 'Éteindre', de: 'Ausschalten', es: 'Apagar' },
  restart: { en: 'Restart', fr: 'Redémarrer', de: 'Neu starten', es: 'Reiniciar' },
};

// --- Widget ---

export const WIDGET_TEXT = {
  power: { en: 'Power', fr: 'Puissance', de: 'Leistung', es: 'Potencia' },
  voltage: { en: 'Voltage', fr: 'Tension', de: 'Spannung', es: 'Tensión' },
  frequency: { en: 'Frequency', fr: 'Fréquence', de: 'Frequenz', es: 'Frecuencia' },
  control: {
    en: 'Control an output',
    fr: 'Piloter une sortie',
    de: 'Ausgang steuern',
    es: 'Controlar salida',
  },
  output: { en: 'Output', fr: 'Sortie', de: 'Ausgang', es: 'Salida' },
  command: { en: 'Command', fr: 'Commande', de: 'Befehl', es: 'Orden' },
  unreachable: {
    en: 'Not answering',
    fr: 'Ne répond pas',
    de: 'Antwortet nicht',
    es: 'No responde',
  },
};

export const WIDGET_MESSAGES = {
  notConfigured: {
    en: 'Enter the address of your Netio in the configuration of the integration.',
    fr: "Saisissez l'adresse de votre Netio dans la configuration de l'intégration.",
    de: 'Gib die Adresse deines Netio in der Konfiguration der Integration ein.',
    es: 'Introduzca la dirección de su Netio en la configuración de la integración.',
  },
  noData: {
    en: 'No reading from the Netio yet.',
    fr: 'Pas encore de lecture du Netio.',
    de: 'Noch keine Messwerte vom Netio.',
    es: 'Todavía no hay lecturas del Netio.',
  },
};

// --- Errors of a Netio (connection status, test, actions) ---

export const ERROR_TEXT = {
  unreachable: {
    en: 'does not answer: check its address and that its JSON API is enabled',
    fr: 'ne répond pas : vérifiez son adresse et que son API JSON est activée',
    de: 'antwortet nicht: Prüfe die Adresse und ob die JSON-API aktiviert ist',
    es: 'no responde: compruebe su dirección y que su API JSON esté activada',
  },
  auth: {
    en: 'wrong user name or password of the JSON API',
    fr: "nom d'utilisateur ou mot de passe de l'API JSON incorrect",
    de: 'falscher Benutzername oder falsches Passwort der JSON-API',
    es: 'usuario o contraseña de la API JSON incorrectos',
  },
  forbidden: {
    en: 'this account may only read: give the read-write account of the JSON API',
    fr: "ce compte ne peut que lire : indiquez le compte lecture-écriture de l'API JSON",
    de: 'dieses Konto darf nur lesen: Gib das Lese-Schreib-Konto der JSON-API an',
    es: 'esta cuenta solo puede leer: indique la cuenta de lectura y escritura de la API JSON',
  },
  not_netio: {
    en: 'no Netio JSON API at this address (M2M API → JSON, enabled?)',
    fr: "pas d'API JSON Netio à cette adresse (M2M API → JSON activé ?)",
    de: 'keine Netio-JSON-API unter dieser Adresse (M2M API → JSON aktiviert?)',
    es: 'no hay API JSON de Netio en esta dirección (¿M2M API → JSON activado?)',
  },
  http: {
    en: 'unexpected answer of the Netio',
    fr: 'réponse inattendue du Netio',
    de: 'unerwartete Antwort des Netio',
    es: 'respuesta inesperada del Netio',
  },
};

/** "<name>: <text>", with the colon of the language (a space before it in French). */
export const labelled = (name, text, language) =>
  `${name}${language === 'fr' ? ' : ' : ': '}${text}`;

/** A multi-language "<name>: <error>". */
export const errorOf = (name, kind) =>
  localize((language) =>
    labelled(name, pick(ERROR_TEXT[kind] ?? ERROR_TEXT.http, language), language),
  );

// --- Connection status, test and action messages ---

export const MESSAGES = {
  notConfigured: {
    en: 'Enter the address of your Netio in the configuration.',
    fr: "Saisissez l'adresse de votre Netio dans la configuration.",
    de: 'Gib die Adresse deines Netio in der Konfiguration ein.',
    es: 'Introduzca la dirección de su Netio en la configuración.',
  },
  invalidHost: {
    en: 'A Netio address is not valid: type its IP address, e.g. 192.168.1.50.',
    fr: "Une adresse de Netio n'est pas valide : saisissez son adresse IP, par ex. 192.168.1.50.",
    de: 'Eine Netio-Adresse ist ungültig: Gib die IP-Adresse ein, z. B. 192.168.1.50.',
    es: 'Una dirección de Netio no es válida: introduzca su dirección IP, p. ej. 192.168.1.50.',
  },
  /** "Test the connection": one line per Netio. */
  found: ({ name, model, outputs, metered }) =>
    localize((language) =>
      labelled(
        name,
        {
          en: `OK, ${model}, ${outputs} output(s)${metered ? ', with metering' : ''}`,
          fr: `OK, ${model}, ${outputs} sortie(s)${metered ? ', avec mesure' : ''}`,
          de: `OK, ${model}, ${outputs} Ausgang/Ausgänge${metered ? ', mit Messung' : ''}`,
          es: `OK, ${model}, ${outputs} salida(s)${metered ? ', con medición' : ''}`,
        }[language],
        language,
      ),
    ),
  offDisabled: {
    en: 'Switching off and restarting are disabled: tick "Allow switching off and restarting" in the configuration.',
    fr: "Éteindre et redémarrer sont désactivés : cochez « Autoriser l'arrêt et le redémarrage » dans la configuration.",
    de: 'Ausschalten und Neustart sind deaktiviert: Aktiviere „Ausschalten und Neustart erlauben“ in der Konfiguration.',
    es: 'Apagar y reiniciar están desactivados: marque «Permitir apagar y reiniciar» en la configuración.',
  },
  unknownOutput: {
    en: 'Choose an output of a Netio (not the Netio itself).',
    fr: "Choisissez une sortie d'un Netio (pas le Netio lui-même).",
    de: 'Wähle einen Ausgang eines Netio (nicht den Netio selbst).',
    es: 'Elija una salida de un Netio (no el propio Netio).',
  },
  unknownCommand: {
    en: 'Unknown command: choose switch on, switch off or restart.',
    fr: 'Commande inconnue : choisissez allumer, éteindre ou redémarrer.',
    de: 'Unbekannter Befehl: Wähle Einschalten, Ausschalten oder Neu starten.',
    es: 'Orden desconocida: elija encender, apagar o reiniciar.',
  },
  restartWhileOff: (name) => ({
    en: `${name} is off: switch it on instead of restarting it.`,
    fr: `La sortie « ${name} » est éteinte : allumez-la plutôt que de la redémarrer.`,
    de: `${name} ist aus: Schalte den Ausgang ein, statt ihn neu zu starten.`,
    es: `La salida «${name}» está apagada: enciéndala en lugar de reiniciarla.`,
  }),
  commandFailed: (name, error) =>
    localize((language) =>
      labelled(
        name,
        {
          en: 'command not applied, ',
          fr: 'commande non appliquée, ',
          de: 'Befehl nicht ausgeführt, ',
          es: 'orden no aplicada, ',
        }[language] + pick(ERROR_TEXT[error] ?? ERROR_TEXT.http, language),
        language,
      ),
    ),
  done: (name, command) =>
    ({
      on: {
        en: `${name} switched on.`,
        fr: `Sortie « ${name} » allumée.`,
        de: `${name} eingeschaltet.`,
        es: `Salida «${name}» encendida.`,
      },
      off: {
        en: `${name} switched off.`,
        fr: `Sortie « ${name} » éteinte.`,
        de: `${name} ausgeschaltet.`,
        es: `Salida «${name}» apagada.`,
      },
      restart: {
        en: `${name} restarting.`,
        fr: `Sortie « ${name} » en cours de redémarrage.`,
        de: `${name} wird neu gestartet.`,
        es: `Salida «${name}» reiniciándose.`,
      },
    })[command],
};
