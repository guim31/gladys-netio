# Netio

Pilotez vos multiprises et PDU Netio (PowerPDU, PowerCable, PowerBOX, NETIO 4 / 4All / 4C,
PowerDIN) depuis Gladys, sur votre réseau local, grâce à l'API JSON intégrée à chaque Netio.

> Développée sans le matériel, d'après la documentation officielle de l'API JSON Netio : vos retours
> sont les bienvenus. Si quelque chose ne se passe pas comme décrit, dites-le sur le forum Gladys.

## Présentation

- Un appareil Gladys par sortie du Netio, avec son interrupteur marche/arrêt, et sur les modèles qui
  la mesurent, sa puissance (W), son courant (A) et son énergie (kWh).
- Sur les modèles avec mesure, un appareil pour le Netio lui-même : tension, puissance totale,
  courant total et énergie totale.
- Allumer une sortie est toujours permis. L'éteindre et la redémarrer (une coupure brève, le « short
  off » de Netio) sont désactivés par défaut, et autorisés par une option : un Netio alimente
  souvent un serveur ou une box internet.
- Un widget de tableau de bord avec les sorties d'un Netio, sa puissance, sa tension et sa
  fréquence, et un bouton pour piloter une sortie.
- Des déclencheurs de scène quand un Netio ne répond plus et répond de nouveau, et une action de
  scène pour allumer, éteindre ou redémarrer une sortie.

Tout reste sur votre réseau local : aucun compte cloud, aucun accès à internet nécessaire.

## Prérequis

- Gladys Assistant 5.2 ou plus récent.
- Un Netio dont le firmware propose l'API JSON (M2M API, protocole JSON, version 2.x) : c'est le cas
  de tous les Netio actuels.
- Le Netio et Gladys sur le même réseau, le Netio à une adresse IP fixe (une réservation DHCP dans
  votre box).

## Configuration

1. Dans l'interface web du Netio, ouvrez **M2M API Protocols → JSON API**, activez-la, et activez
   l'accès en lecture-écriture (**READ-WRITE**). Choisissez son nom d'utilisateur et son mot de passe.
2. Dans Gladys, ouvrez **Intégrations → Netio → Configuration**. Pour chaque Netio (jusqu'à trois),
   saisissez :
   - son **adresse** : l'adresse IP (`192.168.1.50`), avec un port si l'API JSON n'utilise pas le
     port 80 (`192.168.1.50:8080`), ou `https://192.168.1.50` si vous avez activé HTTPS ;
   - l'**utilisateur** et le **mot de passe** de l'API JSON.
3. Choisissez l'**intervalle de rafraîchissement** (10 secondes par défaut) et la **langue** des
   noms et des messages.
4. Enregistrez, puis cliquez sur **Tester la connexion** : une ligne par Netio, avec son modèle et
   ses sorties.
5. Ouvrez l'onglet **Découverte** et ajoutez les appareils voulus.

Un compte en lecture seule (**READ-ONLY** dans le Netio) suffit pour voir les états et les mesures,
mais toute commande est alors refusée, avec un message qui le dit.

## Appareils

| Appareil | Fonctionnalité   | Unité | Remarques                         |
| -------- | ---------------- | ----- | --------------------------------- |
| Sortie   | Marche/arrêt     |       | un interrupteur, pilotable        |
| Sortie   | Puissance        | W     | modèles avec mesure seulement     |
| Sortie   | Courant          | A     | modèles avec mesure seulement     |
| Sortie   | Énergie          | kWh   | le compteur du Netio, avec mesure |
| Le Netio | Tension          | V     | modèles avec mesure seulement     |
| Le Netio | Puissance totale | W     | la somme des sorties              |
| Le Netio | Courant total    | A     |                                   |
| Le Netio | Énergie totale   | kWh   | le compteur du Netio              |

Le nom d'une sortie est celui donné dans le Netio, après le nom du Netio (`Rack Server`) ; une
sortie qui garde son nom d'usine (`output_3`) s'appelle `Rack sortie 3`. Renommez-les dans Gladys à
votre guise.

Les interrupteurs partent vers Gladys dès qu'ils changent, même quand vous appuyez sur le bouton du
Netio. Les mesures partent vers Gladys une fois par minute au plus, pour ménager Gladys. La
fréquence et le facteur de puissance n'ont pas de fonctionnalité (Gladys n'a pas d'unité pour eux) :
ils sont dans le widget.

## Éteindre et redémarrer

L'option **Autoriser l'arrêt et le redémarrage** est désactivée par défaut. Sans elle :

- allumer fonctionne depuis l'interrupteur, le widget, les scènes et l'action de la page de
  l'intégration ;
- éteindre et redémarrer sont refusés, avec un message en rouge.

Une fois cochée, tout ce qui peut utiliser un interrupteur de Gladys peut couper le courant d'une
sortie : le tableau de bord, les scènes et les assistants vocaux (un « éteins tout » compris). Ne la
cochez que si ce qui est branché sur le Netio le supporte.

**Redémarrer** envoie le « short off » de Netio : la sortie s'éteint, puis se rallume après le délai
réglé pour elle dans le Netio (quelques secondes). Une sortie éteinte n'est pas redémarrée :
allumez-la plutôt.

## Widget

Ajoutez le widget **Sorties Netio** à un tableau de bord. Ses réglages :

- **Netio** : un appareil quelconque du Netio à afficher (le premier Netio si vide) ;
- **Afficher puissance et tension** : les tuiles des modèles avec mesure, et la puissance de chaque
  sortie ;
- **Afficher le bouton de pilotage** : un bouton qui ouvre un formulaire pour choisir une sortie et
  une commande.

Le widget affiche les noms donnés aux appareils dans Gladys. Il n'envoie jamais de requête au Netio :
il montre la dernière lecture.

## Scènes

Déclencheurs :

- **Netio injoignable** : un Netio qui répondait ne répond plus (coupure de courant, réseau en
  panne, débranché). Variable : le nom du Netio. Rien ne se déclenche pour un Netio déjà muet au
  démarrage de l'intégration.
- **Netio de nouveau joignable** : le même Netio répond de nouveau, par exemple après une coupure
  de courant.

Action **Piloter une sortie Netio** : choisissez une sortie et une commande (allumer, éteindre,
redémarrer). Éteindre et redémarrer demandent l'option ci-dessus.

L'interrupteur de chaque sortie sert aussi dans les conditions et actions de scène, comme tout
interrupteur de Gladys.

## Dépannage

- **« ne répond pas »** : vérifiez l'adresse, que l'API JSON est activée dans le Netio, et son port.
- **« nom d'utilisateur ou mot de passe incorrect »** : le compte de l'API JSON, pas celui de
  l'interface web.
- **« ce compte ne peut que lire »** : indiquez le compte READ-WRITE de l'API JSON.
- **« pas d'API JSON Netio à cette adresse »** : l'API JSON est désactivée, ou un autre appareil
  répond à cette adresse.
- Réglez `LOG_LEVEL=debug` sur le conteneur pour une ligne par lecture.

## Limites

- Développée sans le matériel, d'après la documentation Netio : vos retours sont les bienvenus.
- Jusqu'à trois Netio. Les entrées du PowerDIN (compteurs S0, entrées numériques) ne sont pas lues.
- Seulement l'API JSON : les autres protocoles Netio (Modbus/TCP, MQTT, SNMP, Telnet, URL API) ne
  sont pas utilisés.
- Les compteurs d'énergie sont ceux du Netio : les remettre à zéro dans le Netio les remet à zéro
  dans Gladys.

## Données et réseau

- L'intégration ne parle qu'aux adresses de Netio saisies, en HTTP (ou HTTPS) sur votre réseau
  local. En HTTPS, le certificat auto-signé du Netio est accepté sans être vérifié.
- Le nom d'utilisateur et le mot de passe restent dans la configuration de Gladys ; ils ne sont
  jamais écrits dans les journaux. Rien n'est stocké sur disque.
- Pas de cloud, pas de compte, aucune donnée ne quitte votre réseau.
