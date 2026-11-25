# Netio

Control your Netio power strips and PDUs (PowerPDU, PowerCable, PowerBOX, NETIO 4 / 4All / 4C,
PowerDIN) from Gladys, on your local network, through the JSON API built into every Netio.

> Developed without the hardware, from the official documentation of the Netio JSON API: feedback
> welcome. If something does not behave as described, say so on the Gladys forum.

## Overview

- One Gladys device per output of the Netio, with its on/off switch, and on the models that measure
  it, its power (W), current (A) and energy (kWh).
- On the models with metering, one device for the Netio itself: voltage, total power, total current
  and total energy.
- Switching an output on is always allowed. Switching it off and restarting it (a short power cut,
  the Netio "short off") are disabled by default, and enabled by an option: a Netio often powers a
  server or an internet box.
- A dashboard widget with the outputs of a Netio, its power, voltage and frequency, and a button to
  control an output.
- Scene triggers when a Netio stops answering and answers again, and a scene action to switch an
  output on, off or restart it.

Everything stays on your local network: no cloud account, no internet access needed.

## Requirements

- Gladys Assistant 5.2 or later.
- A Netio with a firmware offering the JSON API (M2M API, JSON protocol, version 2.x): every current
  Netio device does.
- The Netio and Gladys on the same network, the Netio at a fixed IP address (a DHCP reservation in
  your router).

## Configuration

1. In the web interface of the Netio, open **M2M API Protocols → JSON API**, enable it, and enable
   read-write access (**READ-WRITE**). Choose a user name and a password for it.
2. In Gladys, open **Integrations → Netio → Configuration**. For each Netio (up to three), enter:
   - its **address**: the IP address (`192.168.1.50`), with a port if the JSON API does not use
     port 80 (`192.168.1.50:8080`), or `https://192.168.1.50` if you enabled HTTPS;
   - the **user** and **password** of the JSON API.
3. Choose the **refresh interval** (10 seconds by default) and the **language** of the names and
   messages.
4. Save, then click **Test the connection**: one line per Netio, with its model and its outputs.
5. Open the **Discover** tab and add the devices you want.

A read-only account (**READ-ONLY** in the Netio) is enough to see the states and the measures, but
every command is then refused, with a message saying so.

## Devices

| Device       | Feature       | Unit | Notes                                   |
| ------------ | ------------- | ---- | --------------------------------------- |
| Output       | On/off        |      | a switch, writable                      |
| Output       | Power         | W    | metering models only                    |
| Output       | Current       | A    | metering models only                    |
| Output       | Energy        | kWh  | the counter of the Netio, metering only |
| Netio itself | Voltage       | V    | metering models only                    |
| Netio itself | Total power   | W    | the sum of the outputs                  |
| Netio itself | Total current | A    |                                         |
| Netio itself | Total energy  | kWh  | the counter of the Netio                |

The name of an output is the one given in the Netio, after the name of the Netio (`Rack Server`);
an output with its factory name (`output_3`) is called `Rack output 3`. Rename them in Gladys as
you like.

The switches are sent to Gladys as soon as they change, even when you press the button of the
Netio. The measures go to Gladys once a minute at most, to keep Gladys light. The frequency and the
power factor have no device feature (Gladys has no unit for them): they are in the widget.

## Switching off and restarting

The option **Allow switching off and restarting** is off by default. Without it:

- switching on works from the switch, the widget, the scenes and the action of the integration page;
- switching off and restarting are refused, with a message in red.

Once ticked, everything that can use a switch of Gladys can cut the power of an output: the
dashboard, the scenes, and the voice assistants (an "everything off" included). Tick it only if what
is plugged into the Netio can take it.

**Restart** sends the Netio "short off": the output goes off, then on again after the delay set for
that output in the Netio (a few seconds). An output that is off is not restarted: switch it on
instead.

## Widget

Add the **Netio outputs** widget to a dashboard. Its settings:

- **Netio**: any device of the Netio to show (the first Netio when empty);
- **Show power and voltage**: the tiles of the metering models, and the power of each output;
- **Show the control button**: a button that opens a form to choose an output and a command.

The widget shows the names you gave the devices in Gladys. It never sends a request to the Netio: it
shows the last reading.

## Scenes

Triggers:

- **Netio stopped answering**: a Netio that answered stops answering (power cut, network down,
  unplugged). Variable: the name of the Netio. Nothing fires for a Netio already silent when the
  integration starts.
- **Netio answers again**: the same Netio answers again, for example after a power cut.

Action **Control a Netio output**: choose an output and a command (switch on, switch off, restart).
Switching off and restarting need the option above.

The switch of each output can also be used in scene conditions and actions, like any switch of Gladys.

## Troubleshooting

- **"does not answer"**: check the address, that the JSON API is enabled in the Netio, and its port.
- **"wrong user name or password"**: the account of the JSON API, not the one of the web interface.
- **"this account may only read"**: give the READ-WRITE account of the JSON API.
- **"no Netio JSON API at this address"**: the JSON API is disabled, or another device answers there.
- Set `LOG_LEVEL=debug` on the container for a line per reading.

## Limits

- Developed without the hardware, from the Netio documentation: feedback welcome.
- Up to three Netio. The inputs of the PowerDIN (S0 counters, digital inputs) are not read.
- Only the JSON API: the other Netio protocols (Modbus/TCP, MQTT, SNMP, Telnet, URL API) are not used.
- The energy counters are the ones of the Netio: resetting them in the Netio resets them in Gladys.

## Data and network

- The integration talks only to the Netio addresses you entered, over HTTP (or HTTPS) on your local
  network. With HTTPS, the self-signed certificate of the Netio is accepted without being checked.
- The user name and password stay in the configuration of Gladys; they are never written to the
  logs. Nothing is stored on disk.
- No cloud, no account, no data leaves your network.
