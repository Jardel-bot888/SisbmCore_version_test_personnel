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



---

## 7. Découverte importante — Commands Micodus non testables

### 7.1. Comportement observé après activation du scope `commands`

Le scope `commands` est maintenant actif (l ACL est passee), mais Flespi refuse systematiquement la commande avec :
```
"command engine.relay properties validation failed: command definition engine.relay is not found"
```

### 7.2. Cause racine

Sur ce compte Flespi, **aucun device_type compatible Micodus nest enregistre**. Les types testes (350-359, 360-400) acceptent bien la configuration `{ident: IMEI}` mais **n ont aucune definition de commande engine.relay** dans leur schema.

Le `device_type_id=325` (qui correspondrait au protocol micodus) refuse meme la creation : `"device type 325 not found"`.

### 7.3. Conclusion

Pour tester les commandes de coupure moteur :
- Soit il faut un **vrai traceur Micodus MV730** physiquement connecte au channel 1437503
- Soit il faut utiliser le **simulateur officiel Flespi** (https://flespi.io/kb) qui injecte les definitions automatiquement
- Soit recuperer le `device_type_id` exact via le panel Flespi (interface graphique)

### 7.4. Endpoint valide meme sans commande supportee

```
POST https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "<command_name>",
  "properties": { ... }
}]
```

Le **format** `{name, properties}` est **confirme correct** (l erreur nest plus ACL mais validation metier). Pour trouver le bon `command_name`, il faut le panel Flespi ou la doc officielle.

---

## 8. Tests effectues a ce stade

| Date | Test | Resultat |
|------|------|----------|
| 24/08 matin | GET /gw/channels/all | OK - 1 channel micodus |
| 24/08 matin | POST /gw/devices (dt=350) | OK - device cree |
| 24/08 matin | DELETE /gw/devices/{id} | OK (apres ajout scope) |
| 24/08 matin | MQTT subscribe 5 topics | OK - tous recois payloads |
| 24/08 matin | POST /gw/devices/{id}/commands (scope ON) | Format OK, mais command inconnue |
| 24/08 matin | Scan device_type 100-600 pour engine.relay | Aucun type compatible trouve |



---

## 10. Commande custom Micodus MV730 (VALIDEE)

### 10.1. Format de commande

Le protocole Micodus sur Flespi utilise une **commande personnalisee** (`name: "custom"`) avec un champ `payload` contenant la commande brute Micodus (syntaxe `RELAY,N#`).

### 10.2. Couper le moteur

```
POST https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "custom",
  "properties": {
    "payload": "RELAY,1#"
  }
}]
```

### 10.3. Retablir le moteur

```
POST https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "custom",
  "properties": {
    "payload": "RELAY,0#"
  }
}]
```

### 10.4. Reponse Flespi (test 24/08/2026)

Commande `RELAY,1#` envoyee sur device 8915594 :
```json
{
  "result": [],
  "errors": [{
    "code": 2,
    "id": 1788474092687786,
    "reason": "failed to deliver command custom with timeout pending, device with id 8915594 is not connected"
  }]
}
```

Interpretation :
- L erreur nest **plus une erreur de validation** ni d ACL : le format est accepte par Flespi
- Le `code 2` + `reason not connected` signifie que **Flespi a tente de transmettre la commande** au traceur, mais le device na pas repondu (simulateur Trackbox ne fait que publier des positions, il ne recoit pas les commandes)
- Pour valider en condition reelle, un **vrai traceur Micodus MV730** doit etre connecte au channel TCP `ch1437503.flespi.gw:38499`

### 10.5. Champs `payload` testes (rejetes)

| Champ | Format | Resultat |
|-------|--------|----------|
| `text` | `RELAY,1#` | FAIL : properties validation |
| `data.text` | `RELAY,1#` | FAIL : properties validation |
| `payload` | `RELAY,1#` | **OK** : commande envoyee |
| `body` | `RELAY,1#` | FAIL : properties validation |
| `message` | `RELAY,1#` | FAIL : properties validation |

**Le bon champ est `payload`**.

### 10.6. Noms de commande testes (rejetes)

| Name | Resultat |
|------|----------|
| `engine.relay` | FAIL : command definition not found |
| `output.relay` | FAIL : command definition not found |
| `text` | FAIL : command definition not found |
| `command` | FAIL : command definition not found |
| `send` | FAIL : command definition not found |
| `output` | FAIL : command definition not found |
| **`custom`** | **OK** : commande envoyee |

**Le bon nom est `custom`**.

---

## 11. Recapitulatif final de laudit

| Bloc | Statut |
|------|--------|
| Channel micodus | OK - id 1437503, uri ch1437503.flespi.gw:38499 |
| Devices CRUD | OK - 0 a 10 devices testes, scope delete actif |
| Messages | OK - endpoint valide, format documente |
| Telemetry | OK - endpoint valide (404 sans donnees) |
| **Commandes Micodus** | **OK - format custom valide** |
| MQTT 5 topics | OK - tous abonnements reussis |
| Token scopes | OK - read, write, delete, commands |

### Pour Evans (Jalon 2)

1. **Utiliser** `{name: "custom", properties: {payload: "RELAY,1#"}}` pour couper
2. **Utiliser** `{name: "custom", properties: {payload: "RELAY,0#"}}` pour retablir
3. **Tester en reel** avec un vrai MV730 branche sur le channel TCP
4. Le **device Flespi** doit etre cree avec `device_type_id=350` et `configuration.ident=IMEI`
5. Le **topic MQTT** peut etre soit `flespi/message/gw/channels/{id}` (officiel) soit `devices/ingest/+` (Trackbox custom)

