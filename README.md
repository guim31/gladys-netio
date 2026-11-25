# Netio for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for
[Netio](https://www.netio-products.com) power strips and PDUs (PowerPDU,
PowerCable, PowerBOX, NETIO 4 / 4All / 4C, PowerDIN), over the local JSON API
(M2M API, JSON protocol) built into every Netio.

> **Developed without the hardware**, from the official documentation of the
> Netio JSON API, and tested against a fake Netio that follows it: feedback
> welcome.

## What it does

- One device per output: its on/off switch, and on the metering models its
  power (W), current (A) and energy (kWh).
- On the metering models, one device for the Netio itself: voltage, total
  power, total current, total energy.
- Switching on is always allowed. Switching off and restarting (Netio "short
  off") are behind an option, **off by default**: a Netio often powers a server
  or an internet box.
- A dashboard widget (outputs, power, voltage, frequency, a button opening a
  form to control an output), a scene action to control an output, and scene
  triggers when a Netio stops answering and answers again.
- Local only: no cloud, no account.

## Requirements

- Gladys Assistant 5.2 or later.
- A Netio with the JSON API enabled (M2M API Protocols → JSON API), ideally
  with a read-write account.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-netio`. Then fill in the address and the JSON
API account of each Netio (up to three) in the configuration. The user
documentation is in [`docs/`](docs/en.md) (English, French, German, Spanish).

## Limits

- Developed without the hardware: the behaviour of real devices may differ in
  details (say so on the Gladys forum).
- Up to three Netio. The PowerDIN inputs (S0 counters, digital inputs) are not
  read. Only the JSON API is used.
- Gladys has no unit for hertz nor a power factor type: the frequency is shown
  in the widget only.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
node dev/fake-netio-server.js   # a fake Netio over HTTP, for tests in Docker
```

See [`CLAUDE.md`](CLAUDE.md) for the architecture and the project rules.

## Credits

- The JSON API is documented by NETIO products a.s. in its "M2M API Protocol
  JSON" documents; the fake Netio of the tests follows them (no code copied).
- Built on [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
  and the official JavaScript template.
- The cover uses the official Netio logo, from the download page of
  [netio-products.com](https://www.netio-products.com/en/download); it belongs
  to NETIO products a.s.

Not affiliated with, endorsed by or sponsored by NETIO products a.s. "Netio"
is a trademark of its owner.

## License

[Apache-2.0](LICENSE)
