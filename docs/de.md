# Netio

Steuere deine Netio-Steckdosenleisten und PDUs (PowerPDU, PowerCable, PowerBOX, NETIO 4 / 4All /
4C, PowerDIN) aus Gladys, in deinem lokalen Netzwerk, über die JSON-API, die jeder Netio mitbringt.

> Ohne die Hardware entwickelt, nach der offiziellen Dokumentation der Netio-JSON-API:
> Rückmeldungen sind willkommen. Wenn etwas nicht wie beschrieben funktioniert, sag es im
> Gladys-Forum.

## Überblick

- Ein Gladys-Gerät pro Ausgang des Netio, mit seinem Ein/Aus-Schalter, und bei den Modellen, die
  messen, seiner Leistung (W), seinem Strom (A) und seiner Energie (kWh).
- Bei den Modellen mit Messung ein Gerät für den Netio selbst: Spannung, Gesamtleistung, Gesamtstrom
  und Gesamtenergie.
- Einen Ausgang einschalten ist immer erlaubt. Ausschalten und Neustart (eine kurze Unterbrechung,
  das „Short Off“ von Netio) sind standardmäßig deaktiviert und werden über eine Option erlaubt: Ein
  Netio versorgt oft einen Server oder einen Internet-Router.
- Ein Dashboard-Widget mit den Ausgängen eines Netio, seiner Leistung, Spannung und Frequenz, und
  einer Taste zum Steuern eines Ausgangs.
- Szenen-Auslöser, wenn ein Netio nicht mehr antwortet und wieder antwortet, und eine Szenen-Aktion,
  um einen Ausgang ein- oder auszuschalten oder neu zu starten.

Alles bleibt in deinem lokalen Netzwerk: kein Cloud-Konto, kein Internetzugang nötig.

## Voraussetzungen

- Gladys Assistant 5.2 oder neuer.
- Ein Netio mit einer Firmware, die die JSON-API bietet (M2M API, JSON-Protokoll, Version 2.x): Das
  gilt für alle aktuellen Netio-Geräte.
- Netio und Gladys im selben Netzwerk, der Netio mit fester IP-Adresse (eine DHCP-Reservierung in
  deinem Router).

## Konfiguration

1. Öffne in der Weboberfläche des Netio **M2M API Protocols → JSON API**, aktiviere sie und
   aktiviere den Lese-Schreib-Zugriff (**READ-WRITE**). Lege Benutzername und Passwort fest.
2. Öffne in Gladys **Integrationen → Netio → Konfiguration**. Gib für jeden Netio (bis zu drei) ein:
   - seine **Adresse**: die IP-Adresse (`192.168.1.50`), mit Port, wenn die JSON-API nicht Port 80
     nutzt (`192.168.1.50:8080`), oder `https://192.168.1.50`, wenn du HTTPS aktiviert hast;
   - **Benutzer** und **Passwort** der JSON-API.
3. Wähle das **Aktualisierungsintervall** (standardmäßig 10 Sekunden) und die **Sprache** der Namen
   und Meldungen.
4. Speichere und klicke auf **Verbindung testen**: eine Zeile pro Netio, mit Modell und Ausgängen.
5. Öffne den Tab **Entdecken** und füge die gewünschten Geräte hinzu.

Ein Nur-Lese-Konto (**READ-ONLY** im Netio) reicht, um Zustände und Messwerte zu sehen, aber jeder
Befehl wird dann abgelehnt, mit einer Meldung, die es erklärt.

## Geräte

| Gerät        | Funktion       | Einheit | Hinweise                              |
| ------------ | -------------- | ------- | ------------------------------------- |
| Ausgang      | Ein/Aus        |         | ein Schalter, steuerbar               |
| Ausgang      | Leistung       | W       | nur Modelle mit Messung               |
| Ausgang      | Strom          | A       | nur Modelle mit Messung               |
| Ausgang      | Energie        | kWh     | der Zähler des Netio, nur mit Messung |
| Netio selbst | Spannung       | V       | nur Modelle mit Messung               |
| Netio selbst | Gesamtleistung | W       | die Summe der Ausgänge                |
| Netio selbst | Gesamtstrom    | A       |                                       |
| Netio selbst | Gesamtenergie  | kWh     | der Zähler des Netio                  |

Der Name eines Ausgangs ist der im Netio vergebene, nach dem Namen des Netio (`Rack Server`); ein
Ausgang mit seinem Werksnamen (`output_3`) heißt `Rack Ausgang 3`. Benenne sie in Gladys nach
Belieben um.

Die Schalter gehen an Gladys, sobald sie sich ändern, auch wenn du die Taste am Netio drückst. Die
Messwerte gehen höchstens einmal pro Minute an Gladys, um Gladys zu schonen. Frequenz und
Leistungsfaktor haben keine Funktion (Gladys hat keine Einheit dafür): Beide stehen im Widget.

## Ausschalten und Neustart

Die Option **Ausschalten und Neustart erlauben** ist standardmäßig aus. Ohne sie:

- Einschalten funktioniert über den Schalter, das Widget, die Szenen und die Aktion der
  Integrationsseite;
- Ausschalten und Neustart werden abgelehnt, mit einer roten Meldung.

Ist sie aktiviert, kann alles, was einen Schalter von Gladys nutzen kann, den Strom eines Ausgangs
abschalten: das Dashboard, die Szenen und die Sprachassistenten (auch ein „alles aus“). Aktiviere sie
nur, wenn das, was am Netio hängt, das verträgt.

**Neu starten** sendet das „Short Off“ von Netio: Der Ausgang geht aus und nach der im Netio für ihn
eingestellten Verzögerung (einige Sekunden) wieder an. Ein ausgeschalteter Ausgang wird nicht neu
gestartet: Schalte ihn stattdessen ein.

## Widget

Füge das Widget **Netio-Ausgänge** zu einem Dashboard hinzu. Seine Einstellungen:

- **Netio**: ein beliebiges Gerät des anzuzeigenden Netio (der erste Netio, wenn leer);
- **Leistung und Spannung anzeigen**: die Kacheln der Modelle mit Messung und die Leistung jedes
  Ausgangs;
- **Steuertaste anzeigen**: eine Taste, die ein Formular zur Wahl von Ausgang und Befehl öffnet.

Das Widget zeigt die Namen, die du den Geräten in Gladys gegeben hast. Es sendet nie eine Anfrage an
den Netio: Es zeigt den letzten Messwert.

## Szenen

Auslöser:

- **Netio antwortet nicht mehr**: Ein Netio, der geantwortet hat, antwortet nicht mehr (Stromausfall,
  Netzwerk weg, ausgesteckt). Variable: der Name des Netio. Für einen Netio, der beim Start der
  Integration schon stumm ist, wird nichts ausgelöst.
- **Netio wieder erreichbar**: Derselbe Netio antwortet wieder, zum Beispiel nach einem Stromausfall.

Aktion **Netio-Ausgang steuern**: Wähle einen Ausgang und einen Befehl (einschalten, ausschalten, neu
starten). Ausschalten und Neustart brauchen die Option oben.

Der Schalter jedes Ausgangs dient auch in Bedingungen und Aktionen von Szenen, wie jeder Schalter von
Gladys.

## Fehlerbehebung

- **„antwortet nicht“**: Prüfe die Adresse, ob die JSON-API im Netio aktiviert ist, und ihren Port.
- **„falscher Benutzername oder falsches Passwort“**: das Konto der JSON-API, nicht das der
  Weboberfläche.
- **„dieses Konto darf nur lesen“**: Gib das READ-WRITE-Konto der JSON-API an.
- **„keine Netio-JSON-API unter dieser Adresse“**: Die JSON-API ist deaktiviert oder ein anderes
  Gerät antwortet dort.
- Setze `LOG_LEVEL=debug` am Container für eine Zeile pro Abfrage.

## Grenzen

- Ohne die Hardware entwickelt, nach der Netio-Dokumentation: Rückmeldungen sind willkommen.
- Bis zu drei Netio. Die Eingänge des PowerDIN (S0-Zähler, digitale Eingänge) werden nicht gelesen.
- Nur die JSON-API: Die anderen Netio-Protokolle (Modbus/TCP, MQTT, SNMP, Telnet, URL API) werden
  nicht genutzt.
- Die Energiezähler sind die des Netio: Setzt du sie im Netio zurück, gehen sie auch in Gladys auf
  null.

## Daten und Netzwerk

- Die Integration spricht nur mit den eingegebenen Netio-Adressen, per HTTP (oder HTTPS) in deinem
  lokalen Netzwerk. Bei HTTPS wird das selbstsignierte Zertifikat des Netio ungeprüft akzeptiert.
- Benutzername und Passwort bleiben in der Konfiguration von Gladys und werden nie in die Logs
  geschrieben. Nichts wird auf der Festplatte gespeichert.
- Keine Cloud, kein Konto, keine Daten verlassen dein Netzwerk.
