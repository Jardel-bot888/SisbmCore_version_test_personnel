import db from '@adonisjs/lucid/services/db'
import type {
  NormalizedPosition,
  PositionRepository,
  ResolvedDevice,
} from '#application/telemetry/ports'

/**
 * Adaptateur de persistance pour la télémétrie.
 *
 * Écriture en SQL brute pour trois raisons :
 *
 *  1. `INSERT ... ON CONFLICT (device_id, recorded_at) DO NOTHING` n'est pas
 *     exposé par le query builder Lucid pour une table partitionnée.
 *  2. L'UPSERT sur `vehicle_last_positions` nécessite toutes les colonnes
 *     dans le `DO UPDATE SET`.
 *  3. La résolution device↔véhicule passe par la vue
 *     `current_device_assignments` → `flespi_ident` et `imei`, une jointure
 *     que le query builder standard ne simplifie pas.
 *
 * Aucune règle métier ici : filtrage qualité, rejet de point nul, etc. sont
 * dans le cas d'usage.
 */
export class LucidPositionRepository implements PositionRepository {
  /**
   * Résout l'identifiant Flespi (imei ou flespi_ident) vers le device
   * interne, le véhicule courant et l'organisation.
   */
  async resolveDevice(ident: string): Promise<ResolvedDevice | null> {
    const result = await db.rawQuery(
      `SELECT da.device_id   AS "deviceId",
              da.vehicle_id  AS "vehicleId",
              d.organization_id AS "organizationId"
       FROM devices d
       LEFT JOIN current_device_assignments da ON da.device_id = d.id
       WHERE (d.imei = :ident OR d.flespi_ident = :ident)
         AND d.status = 'active'
       LIMIT 1`,
      { ident }
    )
    const row = result.rows?.[0]
    if (!row) return null
    return {
      deviceId: row.deviceId,
      vehicleId: row.vehicleId ?? null,
      organizationId: row.organizationId,
    }
  }

  /**
   * Écrit dans les trois tables en une seule transaction.
   *
   *  1. ingest_messages  → journal brut, source d'idempotence par external_id
   *  2. positions        → INSERT idempotent (CM-16)
   *  3. vehicle_last_positions → UPSERT (temps réel)
   */
  async ingest(position: NormalizedPosition, device: ResolvedDevice): Promise<void> {
    await db.transaction(async (trx) => {
      // ---- 1. ingest_messages : journal brut
      await trx.rawQuery(
        `INSERT INTO ingest_messages
           (source, external_id, device_ident, device_id, received_at,
            processed_at, status, payload)
         VALUES
           (:source, :externalId, :ident, :deviceId, :receivedAt,
            now(), 'processed', :payload)
         ON CONFLICT (source, external_id, received_at) DO NOTHING`,
        {
          source: position.source,
          externalId: position.externalId,
          ident: position.ident,
          deviceId: device.deviceId,
          receivedAt: position.receivedAt.toISOString(),
          payload: JSON.stringify(position.raw),
        }
      )

      // ---- 2. positions : idempotent via UNIQUE (device_id, recorded_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await trx.rawQuery(
        `INSERT INTO positions
           (organization_id, device_id, vehicle_id, trip_id,
            recorded_at, received_at,
            location, altitude_m, speed_kph, heading_deg,
            satellites, hdop, ignition, movement,
            gsm_signal, battery_pct, external_voltage_v,
            is_valid, is_backlog, source, raw)
         VALUES
           (:organizationId, :deviceId, :vehicleId, :tripId,
            :recordedAt, :receivedAt,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :altitudeM, :speedKph, :headingDeg,
            :satellites, :hdop, :ignition, :movement,
            :gsmSignal, :batteryPct, NULL,
            true, :isBacklog, :source, :raw)
         ON CONFLICT (device_id, recorded_at) DO NOTHING`,
        {
          organizationId: device.organizationId,
          deviceId: device.deviceId,
          vehicleId: device.vehicleId ?? null,
          tripId: null,
          recordedAt: position.recordedAt.toISOString(),
          receivedAt: position.receivedAt.toISOString(),
          lng: position.longitude,
          lat: position.latitude,
          altitudeM: position.altitudeM ?? null,
          speedKph: position.speedKph ?? null,
          headingDeg: position.headingDeg ?? null,
          satellites: position.satellites ?? null,
          hdop: position.hdop ?? null,
          ignition: position.ignition ?? null,
          movement: position.movement ?? null,
          gsmSignal: position.gsmSignal ?? null,
          batteryPct: position.batteryPct ?? null,
          isBacklog: position.isBacklog,
          source: position.source,
          raw: JSON.stringify(position.raw),
        } as any
      )

      // ---- 3. vehicle_last_positions : UPSERT (temps réel)
      if (device.vehicleId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await trx.rawQuery(
          `INSERT INTO vehicle_last_positions
             (vehicle_id, organization_id, device_id,
              recorded_at, received_at, location,
              speed_kph, heading_deg, ignition, movement,
              gsm_signal, battery_pct, external_voltage_v,
              connection_state, updated_at)
           VALUES
             (:vehicleId, :organizationId, :deviceId,
              :recordedAt, :receivedAt,
              ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
              :speedKph, :headingDeg, :ignition, :movement,
              :gsmSignal, :batteryPct, NULL,
              'online', now())
           ON CONFLICT (vehicle_id) DO UPDATE SET
             device_id       = EXCLUDED.device_id,
             recorded_at     = EXCLUDED.recorded_at,
             received_at     = EXCLUDED.received_at,
             location        = EXCLUDED.location,
             speed_kph       = EXCLUDED.speed_kph,
             heading_deg     = EXCLUDED.heading_deg,
             ignition        = EXCLUDED.ignition,
             movement        = EXCLUDED.movement,
             gsm_signal      = EXCLUDED.gsm_signal,
             battery_pct     = EXCLUDED.battery_pct,
             connection_state = 'online',
             updated_at       = now()`,
          {
            vehicleId: device.vehicleId,
            organizationId: device.organizationId,
            deviceId: device.deviceId,
            recordedAt: position.recordedAt.toISOString(),
            receivedAt: position.receivedAt.toISOString(),
            lng: position.longitude,
            lat: position.latitude,
            speedKph: position.speedKph ?? null,
            headingDeg: position.headingDeg ?? null,
            ignition: position.ignition ?? null,
            movement: position.movement ?? null,
            gsmSignal: position.gsmSignal ?? null,
            batteryPct: position.batteryPct ?? null,
          } as any
        )
      }
    })
  }
}