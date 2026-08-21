import type { TransactionScope } from '#domain/kernel'

/**
 * =========================================================================
 *  Contexte TÉLÉMÉTRIE — ports applicatifs
 * =========================================================================
 *
 * Seul le contrat d'ingestion est défini ici. La normalisation du payload
 * Flespi (dot-notation, unités, epochs) vit dans le gateway MQTT ; la
 * persistance (ingest_messages, positions, vehicle_last_positions) vit dans
 * l'adaptateur Lucid.
 */

/**
 * Position normalisée, prête à être filtrée puis persistée.
 *
 * Toutes les grandeurs portent leur unité dans le nom : speed en km/h,
 * heading en degrés, altitude en mètres. C'est le contrat qui traverse la
 * frontière application -> infrastructure, il ne parle donc ni de Flespi ni
 * de PostgreSQL.
 */
export interface NormalizedPosition {
  /** IMEI ou ident Flespi du tracker émetteur. */
  ident: string
  /** Horodatage métier relevé par le tracker. */
  recordedAt: Date
  /** Instant de réception côté backend. */
  receivedAt: Date
  latitude: number
  longitude: number
  speedKph: number | null
  headingDeg: number | null
  altitudeM: number | null
  satellites: number | null
  hdop: number | null
  ignition: boolean | null
  movement: boolean | null
  gsmSignal: number | null
  batteryPct: number | null
  /** Écart recordedAt / receivedAt marquant une trame de Store & Forward. */
  isBacklog: boolean
  /** Source du flux : 'flespi'. */
  source: string
  /** Identifiant externe du message, pour l'idempotence d'ingestion. */
  externalId: string
  /** Trame brute complète, conservée pour rejeu ultérieur. */
  raw: Record<string, unknown>
}

/** Résultat de la résolution d'un ident de device en référentiel interne. */
export interface ResolvedDevice {
  deviceId: string
  vehicleId: string | null
  organizationId: string
}

export interface PositionRepository {
  /** Résout l'IMEI/ident Flespi vers le device, le véhicule et l'organisation courants. */
  resolveDevice(ident: string): Promise<ResolvedDevice | null>

  /**
   * Écrit une position dans les trois tables d'ingestion :
   *   ingest_messages (journal brut), positions (historique partitionné),
   *   vehicle_last_positions (UPSERT temps réel).
   */
  ingest(position: NormalizedPosition, device: ResolvedDevice): Promise<void>
}

/**
 * Cas d'usage d'ingestion : valide, filtre puis persiste une position.
 *
 * Implémenté dans `app/application/telemetry/use_cases/ingest_position.ts`.
 */
export interface IngestPosition {
  execute(position: NormalizedPosition): Promise<void>
}

/** Transaction optionnelle pour les écritures batch (Store & Forward). */
export type { TransactionScope }