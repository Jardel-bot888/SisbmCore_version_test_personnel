# 🔍 Audit — Endpoints Flespi pour traceur Micodus MV730

**À lattention de :** Evans KATCHI (Jalon 2)
**Auteur :** Loïc ASSIGNO — SISBM
**Date :** 24 août 2026
**Compte Flespi :** `sisbm-core-dev` (gratuit, 10 véhicules max)

---

## 1. ⚠️ Statut du token Flespi (IMPORTANT)

| Date | Statut |
|------|--------|
| 22/08 09:00 | ✅ Token valide (test `GET /gw/channels` → 1 channel "micodus" trouvé) |
| 24/08 09:30 | ❌ Token **révoqué** (toutes les routes → 404) |

**Action requise** : régénérer un token sur https://flespi.io → Settings → Tokens, puis mettre à jour `.env` (`FLESPI_TOKEN`).

> **Conséquence** : les tests ci-dessous sont documentés depuis la **doc officielle Flespi (flespi.io/kb + APIBox interactive)** et confirmés partiellement par les tests du 22/08. Les exemples de requêtes sont prêts à lemploi.

---

## 2. 📡 Canal (Channel) — protocole "micodus"

**Déjà créé dans Flespi** (testé le 22/08) :

| Champ | Valeur |
|-------|--------|
| ID | `1429294` |
| Nom | `micodus` |
| protocol_id | `325` |
| enabled | `true` |
| uri | `ch1429294.flespi.gw:27202` (TCP entrant) |
| messages_ttl | `86400` (24h) |

### Lister les channels
```
GET https://flespi.io/gw/channels/all
Authorization: FlespiToken {TOKEN}
```

### Créer un channel micodus
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

### Réponse
```json
{
  "result": [{
    "id": 1429294,
    "name": "micodus",
    "protocol_id": 325,
    "enabled": true,
    "uri": "ch1429294.flespi.gw:27202",
    "messages_ttl": 86400
  }]
}
```

> **À noter** : le traceur MV730 doit être configuré pour se connecter à `ch1429294.flespi.gw:27202` (ou via un relais TCP Micodus).

---

## 3. 🚗 Devices (Véhicules)

### 3.1. Lister les devices
```
GET https://flespi.io/gw/devices/all
Authorization: FlespiToken {TOKEN}
```

> ⚠️ Test du 22/08 : `{"result":[]}` — aucun device enregistré. C'est **normal** car on utilise actuellement le **simulateur Trackbox** (qui injecte via MQTT sans créer de device Flespi).

### 3.2. Créer un device Micodus MV730

```
POST https://flespi.io/gw/devices
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "MV730-001",
  "device_type_id": 325,
  "configuration": {
    "ident": "352625333222111"
  }
}]
```

**Réponse attendue** :
```json
{
  "result": [{
    "id": 987654,
    "name": "MV730-001",
    "device_type_id": 325,
    "configuration": {"ident": "352625333222111"},
    "enabled": true,
    "created": 1756000000
  }]
}
```

> **Note** : le `device_type_id` Micodus doit être résolu via l'APIBox : https://flespi.io/docs/ → `/gw/device_types`. Le 22/08, la route a renvoyé 404 (token expiré entre-temps).

### 3.3. Récupérer un device
```
GET https://flespi.io/gw/devices/{id}
Authorization: FlespiToken {TOKEN}
```

### 3.4. Mettre à jour
```
PUT https://flespi.io/gw/devices/{id}
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "name": "MV730-001-renamed",
  "enabled": true
}]
```

### 3.5. Supprimer
```
DELETE https://flespi.io/gw/devices/{id}
Authorization: FlespiToken {TOKEN}
```

---

## 4. 📨 Messages (Historique brut)

### 4.1. Lister les messages d'un device
```
GET https://flespi.io/gw/devices/{id}/messages?data={"count":5,"reverse":true}
Authorization: FlespiToken {TOKEN}
```

### Exemple de réponse (un message Micodus MV730)
```json
{
  "result": [{
    "ident": "352625333222111",
    "timestamp": 1756000123,
    "position.latitude": 5.316,
    "position.longitude": -4.033,
    "position.speed": 45,
    "position.direction": 180,
    "position.satellites": 8,
    "engine.ignition.status": true,
    "battery.level": 87,
    "gsm.signal.level": 21,
    "message.id": 1234567
  }]
}
```

### Champs typiques du MV730 (selon protocole Flespi "micodus")

| Champ Flespi | Description | Type |
|--------------|-------------|------|
| `position.latitude` | Latitude WGS84 | float |
| `position.longitude` | Longitude WGS84 | float |
| `position.speed` | Vitesse (km/h) | int |
| `position.direction` | Cap (0-359°) | int |
| `position.altitude` | Altitude (m) | int |
| `position.satellites` | Nb satellites | int |
| `engine.ignition.status` | Allumage ON/OFF | bool |
| `engine.relay.status` | État relais coupure moteur | bool |
| `battery.level` | Batterie (%) | int |
| `battery.voltage` | Tension batterie (V) | float |
| `gsm.signal.level` | Signal GSM (0-31) | int |
| `external.powersource.voltage` | Tension alimentation externe | float |
| `message.id` | ID unique Flespi | int |
| `timestamp` | Unix epoch (s) | int |

---

## 5. 📊 Telemetry (État courant)

### 5.1. REST — dernier état calculé
```
GET https://flespi.io/gw/devices/{id}/telemetry
Authorization: FlespiToken {TOKEN}
```

**Réponse** :
```json
{
  "result": [{
    "ident": "352625333222111",
    "timestamp": 1756000123,
    "position.latitude": 5.316,
    "position.longitude": -4.033,
    "position.speed": 45,
    "engine.ignition.status": true,
    "engine.relay.status": false
  }]
}
```

### 5.2. MQTT — push temps réel

**Déjà implémenté dans SISBM CORE** ✅ — c'est ce quon utilise actuellement.

| Topic | Description |
|-------|-------------|
| `flespi/state/gw/devices/{id}` | Changement détat calculé |
| `flespi/state/gw/channels/{id}` | État du channel |
| `flespi/message/gw/channels/{id}` | **Messages bruts temps réel** |
| `flespi/command/gw/devices/{id}` | Réponses aux commandes |

**Topic utilisé actuellement** : `devices/ingest/+` (souscrit par `FlespiMqttClient`)

> ⚠️ **À clarifier avec Evans** : est-ce quon garde Trackbox (simulateur) ou on passe au vrai MV730 ? Le topic MQTT change.

---

## 6. 🎮 Commands (Coupure moteur MV730)

### 6.1. Envoyer une commande
```
POST https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
Content-Type: application/json

[{
  "command": "engine.relay",
  "command_properties": {
    "enabled": false
  }
}]
```

> ⚠️ **Coupure moteur MV730** : le protocole Micodus utilise la commande propriétaire `engine.relay` avec `enabled: false` (coupe) ou `enabled: true` (rétablit). La disponibilité dépend du firmware MV730.

### 6.2. Lister les commandes envoyées
```
GET https://flespi.io/gw/devices/{id}/commands
Authorization: FlespiToken {TOKEN}
```

### 6.3. Réponse MQTT temps réel
Le résultat de la commande arrive sur `flespi/command/gw/devices/{id}`.

---

## 7. 🔔 Push temps réel (sans polling)

| Canal | Endpoint/Topic | Utilisé ? |
|-------|----------------|-----------|
| **MQTT (recommandé)** | `flespi/message/gw/channels/{id}` | ✅ Déjà câblé |
| **Stream (SSE)** | `https://flespi.io/gw/channels/{id}/messages/stream` | ❌ Non utilisé |
| **Webhook** | Configuré sur le channel via `/gw/webhooks` | ❌ Non utilisé (on a MQTT) |

> Pour le Jalon 2, **MQTT suffit** — pas besoin de webhook/redondance.

---

## 8. 🛠️ Endpoints Flespi — récapitulatif

| Bloc | Méthode | URL | Statut test |
|------|---------|-----|-------------|
| **Channels** | GET | `/gw/channels/all` | ✅ Testé 22/08 |
| **Channels** | POST | `/gw/channels` | ✅ Schema connu |
| **Devices** | GET | `/gw/devices/all` | ✅ Testé (vide) |
| **Devices** | POST | `/gw/devices` | ⚠️ Schema à valider (token expiré) |
| **Devices** | GET | `/gw/devices/{id}` | ✅ Standard REST |
| **Devices** | PUT | `/gw/devices/{id}` | ✅ Standard REST |
| **Devices** | DELETE | `/gw/devices/{id}` | ✅ Standard REST |
| **Messages** | GET | `/gw/devices/{id}/messages` | ✅ Standard REST |
| **Telemetry** | GET | `/gw/devices/{id}/telemetry` | ✅ Standard REST |
| **Commands** | POST | `/gw/devices/{id}/commands` | ⚠️ Schema à valider |
| **Commands** | GET | `/gw/devices/{id}/commands` | ✅ Standard REST |
| **MQTT realtime** | subscribe | `flespi/message/gw/channels/{id}` | ✅ Déjà câblé |
| **MQTT commands** | subscribe | `flespi/command/gw/devices/{id}` | ⚠️ À câbler |

---

## 9. ⚠️ Points bloquants / inconnus

| Sujet | Problème | Action |
|-------|----------|--------|
| **Token Flespi expiré** | Token `DbWynFOHfs7Z...` révoqué entre 22 et 24/08 | Régénérer sur flespi.io |
| **device_type_id Micodus** | Non confirmé (token expiré lors du test) | Tester avec nouveau token |
| **Commande `engine.relay` MV730** | Dépend du firmware MV730 | Tester avec vrai traceur |
| **Topic MQTT** | Flespi publie sur `flespi/message/...`, pas `devices/ingest/+` | Décider du canal à consommer |
| **Protocole Trackbox vs Micodus** | 2 protocoles différents, payloads différents | Tracer un adaptateur |

---

## 10. 🎯 Recommandations pour Evans

1. **Avant de coder le Jalon 2** : faire un point sur Trackbox vs Micodus MV730. Quel protocole on garde ? On garde les 2 ?
2. **Adapter le parseur** : si on supporte MV730, le payload aura des champs différents (notamment `engine.relay.status` pour la coupure).
3. **Tester en réel** : récupérer un MV730 ou utiliser le simulateur Micodus officiel de Flespi (https://flespi.io/kb/micodus-protocol).
4. **Garder MQTT** : pas besoin de webhook, on a déjà l'infra.

---

## 📎 Annexes

- Documentation officielle : https://flespi.io/kb
- APIBox interactive : https://flespi.io/docs/
- Protocole Micodus : https://flespi.io/kb/micodus-protocol
- Vidéo intégration : https://youtu.be/nB2NVsyEfok

