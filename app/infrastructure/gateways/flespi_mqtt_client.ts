import mqtt, { type MqttClient } from 'mqtt'
import type { IngestPosition, NormalizedPosition } from '#application/telemetry/ports'

/**
 * =========================================================================
 *  Passerelle MQTT Flespi
 * =========================================================================
 *
 * Se connecte au broker MQTT de Flespi (mqtt.flespi.io:8883, TLS),
 * s'abonne au topic des événements devices, normalise chaque message
 * en `NormalizedPosition` et le transmet au cas d'usage d'ingestion.
 *
 * Cycle de vie :
 *   - `connect()`  : établit la connexion TLS et s'abonne
 *   - `disconnect()`: ferme proprement le client (arrêt gracieux)
 *
 * Le parsing est volontairement tolérant : un message mal formé est logué
 * et ignoré, il ne casse pas le flux. La trame brute est toujours conservée
 * dans `raw` pour permettre un rejeu ultérieur.
 */

export interface FlespiMqttConfig {
  host: string
  port: number
  tls: boolean
  token: string
  clientId: string
}

/**
 * Format d'un message Flespi standard (tel que publié par le broker).
 *
 * Les champs sont en dot-notation (ex: `position.latitude`) et les
 * horodatages en secondes Unix. Cette interface ne couvre que les
 * champs utilisés par l'ingestion ; le payload complet est conservé
 * dans `raw`.
 */
interface FlespiMessage {
  /** Identifiant du device (IMEI ou ident Flespi). */
  ident?: string
  /** Timestamp Unix (secondes) de l'événement. */
  timestamp?: number
  /** Identifiant unique du message Flespi (pour idempotence). */
  'message.id'?: number
  'position.latitude'?: number
  'position.longitude'?: number
  'position.altitude'?: number
  'position.speed'?: number
  'position.direction'?: number
  'position.satellites'?: number
  'position.hdop'?: number
  'status.ignition'?: boolean
  'status.movement'?: boolean
  'gsm.signal.level'?: number
  'battery.level'?: number
  [key: string]: unknown
}

export class FlespiMqttClient {
  private client: MqttClient | null = null

  constructor(
    private readonly config: FlespiMqttConfig,
    private readonly ingestPosition: IngestPosition
  ) {}

  /**
   * Établit la connexion TLS au broker Flespi et s'abonne au topic
   * des événements devices.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `mqtts://${this.config.host}:${this.config.port}`

      this.client = mqtt.connect(url, {
        clientId: this.config.clientId,
        username: this.config.token,
        password: '',
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 15000,
        rejectUnauthorized: true,
      })

      this.client.on('connect', () => {
        console.log('[flespi-mqtt] connecté à', url)

        // S'abonner au topic Trackbox : devices/ingest/{ident}
        this.client!.subscribe('devices/ingest/+', (err) => {
          if (err) {
            console.error('[flespi-mqtt] échec abonnement', err)
            reject(err)
          } else {
            console.log('[flespi-mqtt] abonné à devices/ingest/+')
            resolve()
          }
        })
      })

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload).catch((err) => {
          console.error('[flespi-mqtt] erreur traitement message', err)
        })
      })

      this.client.on('error', (err) => {
        console.error('[flespi-mqtt] erreur', err)
      })

      this.client.on('close', () => {
        console.log('[flespi-mqtt] déconnecté')
      })

      this.client.on('reconnect', () => {
        console.log('[flespi-mqtt] tentative de reconnexion...')
      })
    })
  }

  /** Ferme proprement la connexion. */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.endAsync()
      this.client = null
    }
  }

  // ------------------------------------------------------------- parsing

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    // Log TOUS les messages reçus pour diagnostiquer le flux Trackbox
    const preview = payload.toString().substring(0, 200)
    console.log(`[flespi-mqtt] message reçu sur topic="${topic}" payload=${preview}`)

    let raw: FlespiMessage
    try {
      raw = JSON.parse(payload.toString())
    } catch {
      console.warn('[flespi-mqtt] payload JSON invalide, ignoré')
      return
    }

    // L'identifiant peut être dans le payload (champ 'ident') OU dans le topic
    // (dernier segment après le dernier '/'). Trackbox le met dans le topic.
    const ident: string = raw.ident ?? topic.split('/').pop() ?? ''
    if (!ident) {
      console.warn('[flespi-mqtt] message sans ident (ni payload ni topic), ignoré')
      return
    }

    const recordedAt = raw.timestamp
      ? new Date(raw.timestamp * 1000)
      : new Date()

    const now = new Date()
    const isBacklog = (now.getTime() - recordedAt.getTime()) > 300_000 // 5 min

    const position: NormalizedPosition = {
      ident,
      recordedAt,
      receivedAt: now,
      latitude: raw['position.latitude'] ?? 0,
      longitude: raw['position.longitude'] ?? 0,
      speedKph: raw['position.speed'] ?? null,
      headingDeg: raw['position.direction'] ?? null,
      altitudeM: raw['position.altitude'] ?? null,
      satellites: raw['position.satellites'] ?? null,
      hdop: raw['position.hdop'] ?? null,
      ignition: raw['status.ignition'] ?? null,
      movement: raw['status.movement'] ?? null,
      gsmSignal: raw['gsm.signal.level'] ?? null,
      batteryPct: raw['battery.level'] ?? null,
      isBacklog,
      source: 'flespi',
      externalId: raw['message.id']?.toString() ?? `${ident}-${recordedAt.getTime()}`,
      raw: raw as Record<string, unknown>,
    }

    await this.ingestPosition.execute(position)
  }
}