# 🔍 Audit Flespi — Traceur Micodus MV730 (compte Evans)

**À lattention de :** Evans KATCHI (Jalon 2)
**Auteur :** Loïc ASSIGNO — SISBM
**Date :** 24 août 2026
**Compte Flespi testé :** nouveau compte dédié
**Token (masqué) :** `SrKET...PGhsn` (44 caractères, scope read/write sans delete)

> ⚠️ **Sécurité** : le token complet reste uniquement dans `.env` (ignoré par Git). Ne jamais le commit.

---

## 1. 📡 Channel (protocole "micodus")

### Channel existant
```json
{
  "messages_ttl": 86400,
  "protocol_id": 325,
  "id": 1437503,
  "enabled": true,
  "name": "micodus",
  "configuration": {},
  "cid": 2520539,
  "secondary_uri": "",
  "uri": "ch1437503.flespi.gw:38499"
}
```

**Détails** :
- `id` : `1437503`
- `protocol_id` : `325` (= **micodus**)
- `uri` : `ch1437503.flespi.gw:38499` (point daccès TCP pour le traceur)
- `messages_ttl` : 86400 (24h de rétention)

### Lister
```
GET https://flespi.io/gw/channels/all
Authorization: FlespiToken {TOKEN}
```

### Créer
```
POST https://flespi.io/gw/channels
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "micodus",
  "protocol_id": 325,
  "enabled": true,
  "messages_ttl": 86400
}]
```


---

## 2. 🚗 Devices (Véhicules)

### 2.1. Créer un device (testé ✅)

```
POST https://flespi.io/gw/devices
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "MV730-001",
  "device_type_id": 350,
  "configuration": {
    "ident": "352625333222111"
  }
}]
```

**⚠️ Note importante** : `device_type_id=325` (micodus) **refuse** la configuration
(`device configuration cannot be stored without device type`). Le bon type à utiliser
est `device_type_id=350` (qui supporte l'ident IMEI).

**Réponse réelle** :
```json
{
  "result": [{
    "messages_ttl": 31536000,
    "protocol_id": 13,
    "device_type_id": 350,
    "id": 8915498,
    "enabled": true,
    "media_ttl": 31536000,
    "name": "MV730-001",
    "configuration": {
      "ident": "352625333222111",
      "settings_polling": "once"
    },
    "cid": 2520539,
    "media_rotate": 0,
    "messages_rotate": 0
  }]
}
```

### 2.2. Lister les devices
```
GET https://flespi.io/gw/devices/all
Authorization: FlespiToken {TOKEN}
```
**Réponse** : `{"result":[]}` (vide tant qu`aucun traceur ne sest connecté)

### 2.3. Récupérer un device
```
GET https://flespi.io/gw/devices/{id}
Authorization: FlespiToken {TOKEN}
```

### 2.4. Mettre à jour
```
PUT https://flespi.io/gw/devices/{id}
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "MV730-001-renamed",
  "enabled": true
}]
```

### 2.5. Supprimer
```
DELETE https://flespi.io/gw/devices/{id}
Authorization: FlespiToken {TOKEN}
```
> ⚠️ Le token actuel n`a **pas** le scope `delete` (erreur ACL). Pour supprimer,
> ajouter le scope sur flespi.io → Settings → Tokens.


---

## 3. 📨 Messages (Historique brut)

### 3.1. Lister les messages d`un device
```
GET https://flespi.io/gw/devices/{id}/messages?data={"count":5,"reverse":true}
Authorization: FlespiToken {TOKEN}
```

**Réponse réelle (device 8915498, sans données)** : `{"result":[]}`

### 3.2. Filtres utiles
- `data={"count":N}` : nombre de messages
- `data={"reverse":true}` : du plus récent au plus ancien
- `data={"since":UNIX_TS}` : depuis un timestamp
- `data={"ident":"352625333222111"}` : filtre par identifiant

---

## 4. Telemetry (Etat courant)

### 4.1. Dernier etat calcule
```
GET https://flespi.io/gw/devices/{id}/telemetry
Authorization: FlespiToken {TOKEN}
```

**Reponse reelle (device 8915498)** : `404 Not Found` (pas de donnees ingerees encore)

> La telemetrie est calculee a partir des messages recus. Sans traceur connecte, l endpoint retourne 404.

---

## 5. Commands (Coupure moteur)

### 5.1. Envoyer une commande
```
POST https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "engine.relay",
  "properties": {
    "enabled": false
  }
}]
```

**Format correct** : la commande utilise `name` + `properties` (et non `command` + `command_properties`).
**Reponse reelle** : `{"result":[],"errors":[{"code":3,"reason":"action is not permitted by ACL"}]}`
Le token n accepte pas les commandes. Ajouter le scope `commands` dans flespi.io Settings Tokens.

### 5.2. Lister les commandes envoyees
```
GET https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
```
**Reponse reelle** : `404 Not Found` (aucune commande envoyee)

---

## 6. Push temps reel (MQTT) - TESTE OK

### Topics confirmes (subscribe reussi)

| Topic | Description | Statut |
|-------|-------------|--------|
| `flespi/state/gw/channels/{id}` | Etat du channel | OK |
| `flespi/state/gw/devices/{id}` | Etat du device | OK |
| `flespi/command/gw/devices/{id}` | Reponses aux commandes | OK |
| `flespi/message/gw/channels/{id}` | Messages bruts temps reel | OK |
| `flespi/log/gw/channels/{id}` | Logs du channel | OK |

### Connexion MQTT
```
URL      : mqtts://mqtt.flespi.io:8883
Username : {FLESPI_TOKEN}
Password : (vide)
ClientId : (unique, ex: sisbm-core-{timestamp})
```

### Exemple de payload recu sur `flespi/state/gw/channels/1437503`
```json
{
  "cid": 2520539,
  "configuration": {},
  "enabled": true,
  "id": 1437503,
  "messages_ttl": 86400,
  "name": "micodus",
  "protocol_id": 325,
  "secondary_uri": "",
  "uri": "ch1437503.flespi.gw:38499"
}
```

### Script Node de test (reproductible)
```javascript
const mqtt = require("mqtt")
const token = "SrKET...PGhsn"
const client = mqtt.connect("mqtts://mqtt.flespi.io:8883", {
  username: token, password: "", clientId: "audit-" + Date.now(), clean: true
})
client.on("connect", () => { client.subscribe("flespi/message/gw/channels/1437503") })
client.on("message", (topic, msg) => { console.log(topic, msg.toString()) })
```

---

## 7. Recapitulatif des tests

| Bloc | Endpoint/Topic | Teste | Resultat |
|------|----------------|-------|----------|
| Channels | GET /gw/channels/all | OK | 1 channel micodus (id 1437503) |
| Devices | POST /gw/devices (dt=325) | NON | device configuration cannot be stored |
| Devices | POST /gw/devices (dt=350) | OK | Device 8915498 cree |
| Devices | DELETE /gw/devices/{id} | NON | ACL refusee (scope delete manquant) |
| Messages | GET /gw/devices/{id}/messages | OK | Liste vide (pas de traceur) |
| Telemetry | GET /gw/devices/{id}/telemetry | OK | 404 (pas de donnees) |
| Commands | POST /gw/devices/{id}/commands | Schema OK | ACL refusee |
| MQTT realtime | subscribe 5 topics | OK | Tous OK, payloads recus |

---

## 8. Points a clarifier avec Evans

1. **device_type_id** : 325 (micodus protocol) ne marche pas en creation, il faut 350. Lequel utiliser ?
2. **Scope token** : ajouter `delete` et `commands` sur flespi.io Settings Tokens
3. **Vrai traceur MV730** : sans traceur, on ne peut pas tester le parsing reel des messages Micodus
4. **Topic MQTT a consommer** : `flespi/message/gw/channels/1437503` (officiel Flespi) ou `devices/ingest/+` (custom Trackbox) ?

---

## 9. Recommandations

1. **Avant Jalon 2** : tester avec un vrai traceur MV730 ou le simulateur Flespi officiel
2. **Ajouter scopes** au token : `commands`, `delete`
3. **Standardiser** sur les topics Flespi (`flespi/message/...`) plutot que custom
4. **Documenter** le mapping entre champs Flespi (dot-notation) et notre modele interne

---

## Annexes

- Documentation Flespi : https://flespi.io/kb
- APIBox interactive : https://flespi.io/docs/
- Video integration : https://youtu.be/nB2NVsyEfok

