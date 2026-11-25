# Netio

Controle sus regletas y PDU Netio (PowerPDU, PowerCable, PowerBOX, NETIO 4 / 4All / 4C, PowerDIN)
desde Gladys, en su red local, mediante la API JSON integrada en cada Netio.

> Desarrollada sin el hardware, a partir de la documentación oficial de la API JSON de Netio: sus
> comentarios son bienvenidos. Si algo no funciona como se describe, dígalo en el foro de Gladys.

## Presentación

- Un dispositivo de Gladys por salida del Netio, con su interruptor de encendido/apagado, y en los
  modelos que la miden, su potencia (W), su corriente (A) y su energía (kWh).
- En los modelos con medición, un dispositivo para el propio Netio: tensión, potencia total,
  corriente total y energía total.
- Encender una salida siempre está permitido. Apagarla y reiniciarla (un corte breve, el «short off»
  de Netio) están desactivados por defecto y se permiten con una opción: un Netio suele alimentar un
  servidor o un router de internet.
- Un widget del panel con las salidas de un Netio, su potencia, tensión y frecuencia, y un botón
  para controlar una salida.
- Disparadores de escena cuando un Netio deja de responder y responde de nuevo, y una acción de
  escena para encender, apagar o reiniciar una salida.

Todo se queda en su red local: sin cuenta en la nube, sin acceso a internet.

## Requisitos

- Gladys Assistant 5.2 o posterior.
- Un Netio con un firmware que ofrezca la API JSON (M2M API, protocolo JSON, versión 2.x): es el caso
  de todos los Netio actuales.
- El Netio y Gladys en la misma red, el Netio con una dirección IP fija (una reserva DHCP en su
  router).

## Configuración

1. En la interfaz web del Netio, abra **M2M API Protocols → JSON API**, actívela y active el acceso
   de lectura y escritura (**READ-WRITE**). Elija su usuario y su contraseña.
2. En Gladys, abra **Integraciones → Netio → Configuración**. Para cada Netio (hasta tres),
   introduzca:
   - su **dirección**: la dirección IP (`192.168.1.50`), con un puerto si la API JSON no usa el
     puerto 80 (`192.168.1.50:8080`), o `https://192.168.1.50` si activó HTTPS;
   - el **usuario** y la **contraseña** de la API JSON.
3. Elija el **intervalo de actualización** (10 segundos por defecto) y el **idioma** de los nombres
   y mensajes.
4. Guarde y pulse **Probar la conexión**: una línea por Netio, con su modelo y sus salidas.
5. Abra la pestaña **Descubrir** y añada los dispositivos que desee.

Una cuenta de solo lectura (**READ-ONLY** en el Netio) basta para ver los estados y las mediciones,
pero cualquier orden se rechaza entonces, con un mensaje que lo indica.

## Dispositivos

| Dispositivo | Función           | Unidad | Notas                               |
| ----------- | ----------------- | ------ | ----------------------------------- |
| Salida      | Encendido/apagado |        | un interruptor, controlable         |
| Salida      | Potencia          | W      | solo modelos con medición           |
| Salida      | Corriente         | A      | solo modelos con medición           |
| Salida      | Energía           | kWh    | el contador del Netio, con medición |
| El Netio    | Tensión           | V      | solo modelos con medición           |
| El Netio    | Potencia total    | W      | la suma de las salidas              |
| El Netio    | Corriente total   | A      |                                     |
| El Netio    | Energía total     | kWh    | el contador del Netio               |

El nombre de una salida es el que tiene en el Netio, tras el nombre del Netio (`Rack Server`); una
salida con su nombre de fábrica (`output_3`) se llama `Rack salida 3`. Puede renombrarlas en Gladys.

Los interruptores se envían a Gladys en cuanto cambian, incluso cuando pulsa el botón del Netio. Las
mediciones se envían como máximo una vez por minuto, para no sobrecargar Gladys. La frecuencia y el
factor de potencia no tienen función (Gladys no tiene unidad para ellos): están en el widget.

## Apagar y reiniciar

La opción **Permitir apagar y reiniciar** está desactivada por defecto. Sin ella:

- encender funciona desde el interruptor, el widget, las escenas y la acción de la página de la
  integración;
- apagar y reiniciar se rechazan, con un mensaje en rojo.

Una vez marcada, todo lo que puede usar un interruptor de Gladys puede cortar la corriente de una
salida: el panel, las escenas y los asistentes de voz (incluido un «apágalo todo»). Márquela solo si
lo que está enchufado al Netio lo soporta.

**Reiniciar** envía el «short off» de Netio: la salida se apaga y vuelve a encenderse tras el retardo
configurado para ella en el Netio (unos segundos). Una salida apagada no se reinicia: enciéndala en
su lugar.

## Widget

Añada el widget **Salidas Netio** a un panel. Sus ajustes:

- **Netio**: cualquier dispositivo del Netio que mostrar (el primer Netio si está vacío);
- **Mostrar potencia y tensión**: los mosaicos de los modelos con medición y la potencia de cada
  salida;
- **Mostrar el botón de control**: un botón que abre un formulario para elegir una salida y una
  orden.

El widget muestra los nombres dados a los dispositivos en Gladys. Nunca envía una petición al Netio:
muestra la última lectura.

## Escenas

Disparadores:

- **Netio dejó de responder**: un Netio que respondía deja de responder (corte de luz, red caída,
  desenchufado). Variable: el nombre del Netio. No se dispara nada para un Netio ya mudo al arrancar
  la integración.
- **Netio responde de nuevo**: el mismo Netio responde de nuevo, por ejemplo tras un corte de luz.

Acción **Controlar una salida Netio**: elija una salida y una orden (encender, apagar, reiniciar).
Apagar y reiniciar requieren la opción anterior.

El interruptor de cada salida también sirve en las condiciones y acciones de escena, como cualquier
interruptor de Gladys.

## Solución de problemas

- **«no responde»**: compruebe la dirección, que la API JSON esté activada en el Netio, y su puerto.
- **«usuario o contraseña incorrectos»**: la cuenta de la API JSON, no la de la interfaz web.
- **«esta cuenta solo puede leer»**: indique la cuenta READ-WRITE de la API JSON.
- **«no hay API JSON de Netio en esta dirección»**: la API JSON está desactivada, u otro
  dispositivo responde en esa dirección.
- Defina `LOG_LEVEL=debug` en el contenedor para una línea por lectura.

## Límites

- Desarrollada sin el hardware, a partir de la documentación de Netio: sus comentarios son
  bienvenidos.
- Hasta tres Netio. Las entradas del PowerDIN (contadores S0, entradas digitales) no se leen.
- Solo la API JSON: los demás protocolos de Netio (Modbus/TCP, MQTT, SNMP, Telnet, URL API) no se
  usan.
- Los contadores de energía son los del Netio: ponerlos a cero en el Netio los pone a cero en Gladys.

## Datos y red

- La integración solo habla con las direcciones de Netio introducidas, por HTTP (o HTTPS) en su red
  local. Con HTTPS, el certificado autofirmado del Netio se acepta sin comprobarlo.
- El usuario y la contraseña se quedan en la configuración de Gladys; nunca se escriben en los
  registros. No se guarda nada en disco.
- Sin nube, sin cuenta, ningún dato sale de su red.
