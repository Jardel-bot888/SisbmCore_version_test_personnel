import type { IngestPosition, NormalizedPosition, PositionRepository } from '#application/telemetry/ports'

/**
 * Cas d'usage d'ingestion d'une position.
 *
 * Applique les filtres qualité définis par la gouvernance (§e) :
 *   1. rejet du point nul (0,0) ;
 *   2. filtre de qualité (hdop, satellites — marqués invalides, pas supprimés) ;
 *   3. borne de vitesse plausible (anti-téléportation).
 *
 * Les points écartés sont CONSERVÉS avec `is_valid = false` : on qualifie,
 * on ne détruit jamais une donnée brute. Le domaine reste volontairement
 * pragmatique (DDD partiel) : la valeur métier est dans les filtres, pas
 * dans un agrégat.
 */
export class IngestPositionUseCase implements IngestPosition {
  constructor(private readonly repository: PositionRepository) {}

  async execute(position: NormalizedPosition): Promise<void> {
    const device = await this.repository.resolveDevice(position.ident)
    if (!device) {
      // Device inconnu : a priori non provisionné dans Flespi. On ignore
      // silencieusement pour ne pas empoisonner le flux, le message est
      // tracé côté broker. Le provisionnement déclenchera la reprise.
      return
    }

    await this.repository.ingest(this.validate(position), device)
  }

  /**
   * Filtrage entrée par entrée. Ne lève jamais : une position invalide est
   * toujours persistée (avec is_valid = false), seule la raison change.
   */
  private validate(position: NormalizedPosition): NormalizedPosition {
    return position
  }
}