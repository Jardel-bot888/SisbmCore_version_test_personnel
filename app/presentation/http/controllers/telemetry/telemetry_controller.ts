import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { authorize } from '#presentation/http/support/authorize'

/**
 * Contrôleur de lecture Télémetrie.
 *
 * Lecture seule, pour superviser la flotte et rejouer l'historique. Aucune
 * écriture ici : l'écriture passe exclusivement par le chemin MQTT/ingestion.
 * La pagination est par curseur (`recorded_at`, `id`), jamais par OFFSET,
 * conformément à la gouvernance §f.
 */
@inject()
export default class TelemetryController {
  /** GET /api/v1/telemetry/vehicles */
  async vehicles(ctx: HttpContext) {
    await authorize(ctx, 'viewVehicles')

    const rows = await db.rawQuery(
      `SELECT
         v.id,
         v.registration,
         v.brand,
         v.model,
         v.vehicle_type   AS "vehicleType",
         v.status,
         d.imei,
         ST_Y(p.location::geometry) AS lat,
         ST_X(p.location::geometry) AS lng,
         p.speed_kph      AS "speedKph",
         p.heading_deg    AS "headingDeg",
         p.ignition,
         p.recorded_at    AS "recordedAt",
         p.connection_state AS "connectionState"
       FROM vehicles v
       LEFT JOIN vehicle_last_positions p ON p.vehicle_id = v.id
       LEFT JOIN devices d                  ON d.id = p.device_id
       WHERE v.deleted_at IS NULL
       ORDER BY v.registration`
    )

    return ctx.response.ok({ data: rows.rows })
  }

  /** GET /api/v1/telemetry/vehicles/:id/positions */
  async positions(ctx: HttpContext) {
    await authorize(ctx, 'viewVehicles')

    const { limit = 100, cursor } = ctx.request.qs()
    const id = ctx.params.id

    const rows = await db.rawQuery(
      `SELECT
         recorded_at AS "recordedAt",
         ST_X(location::geometry) AS lng,
         ST_Y(location::geometry) AS lat,
         speed_kph    AS "speedKph",
         heading_deg  AS "headingDeg",
         ignition,
         satellites,
         hdop,
         battery_pct  AS "batteryPct",
         is_valid     AS "isValid",
         is_backlog   AS "isBacklog"
       FROM positions
       WHERE vehicle_id = :id
         AND recorded_at < COALESCE(:cursor::timestamptz, now())
       ORDER BY recorded_at DESC
       LIMIT :limit`,
      { id, cursor: cursor ?? null, limit: Number(limit) }
    )

    // Curseur pour la page suivante : dernier recordedAt renvoyé
    const nextCursor =
      rows.rows.length === Number(limit)
        ? rows.rows[rows.rows.length - 1].recordedAt
        : null

    return ctx.response.ok({ data: rows.rows, nextCursor })
  }
}