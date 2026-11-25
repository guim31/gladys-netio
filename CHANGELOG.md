# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-25

### Added

- Netio power strips and PDUs (PowerPDU, PowerCable, PowerBOX, NETIO 4 / 4All /
  4C, PowerDIN) over the local JSON API, up to three Netio.
- One device per output with its switch, and its power, current and energy on
  the metering models; one device for the Netio itself with voltage, total
  power, total current and total energy.
- Switching on always allowed; switching off and restarting (Netio "short
  off") behind an option, off by default.
- "Control a Netio output" scene action and integration action, "Netio stopped
  answering" and "Netio answers again" scene triggers.
- "Netio outputs" dashboard widget: outputs, power, voltage, frequency, and a
  button opening a form to control an output.
- Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-netio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-netio/releases/tag/v1.0.0
