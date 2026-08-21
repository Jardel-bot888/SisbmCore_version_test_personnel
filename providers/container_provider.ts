import type { ApplicationService } from '@adonisjs/core/types'
import { LucidUnitOfWork } from '#infrastructure/persistence/unit_of_work'
import { LucidAuditLogger } from '#infrastructure/persistence/audit_logger'
import { SystemClock } from '#infrastructure/services/clock'
import { UuidGenerator } from '#infrastructure/services/id_generator'
import { LucidDeviceCommandRepository } from '#infrastructure/persistence/repositories/device_command_repository'
import { LucidVehicleStateReader } from '#infrastructure/persistence/readers/vehicle_state_reader'
import { RequestImmobilization } from '#application/security/use_cases/request_immobilization'
import { ValidateImmobilization } from '#application/security/use_cases/validate_immobilization'
import { IngestPositionUseCase } from '#application/telemetry/use_cases/ingest_position'
import { LucidPositionRepository } from '#infrastructure/persistence/repositories/position_repository'
import { FlespiMqttClient } from '#infrastructure/gateways/flespi_mqtt_client'
import sisbmConfig from '#config/sisbm'

/**
 * =========================================================================
 *  COMPOSITION ROOT
 * =========================================================================
 *
 * SEUL endroit du projet où les interfaces du domaine rencontrent leurs
 * implémentations concrètes. Partout ailleurs, le code dépend d'abstractions.
 *
 * Le câblage est EXPLICITE, pas auto-résolu. Les dépendances des cas d'usage
 * sont des interfaces TypeScript : elles n'existent pas au runtime, le
 * conteneur ne peut donc pas les déduire. C'est un avantage — la composition
 * complète du système se lit d'un seul coup d'oeil, ici.
 *
 * Pour brancher des doubles en test, on ne modifie que ce fichier.
 *
 * Vérification de la santé de l'architecture :
 *
 *     grep -rl "@adonisjs" app/modules/<ctx>/domain/       -> doit être vide
 *     grep -rl "@adonisjs" app/modules/<ctx>/application/  -> seulement `inject`
 */
export default class ContainerProvider {
  constructor(protected app: ApplicationService) {}

  private flespiClient: FlespiMqttClient | null = null

  register() {
    const immo = sisbmConfig.immobilization

    // ------------------------------------------------------------- sécurité
    this.app.container.singleton(RequestImmobilization, () => {
      return new RequestImmobilization(
        new LucidUnitOfWork(),
        new LucidDeviceCommandRepository(),
        new LucidVehicleStateReader(),
        new SystemClock(),
        new UuidGenerator(),
        new LucidAuditLogger(),
        {
          safetySpeedKph: immo.safetySpeedKph,
          requireValidation: immo.requireValidation,
          commandTtlMinutes: immo.commandTtlMinutes,
          maxPositionAgeSeconds: immo.maxPositionAgeSeconds,
        }
      )
    })

    this.app.container.singleton(ValidateImmobilization, () => {
      return new ValidateImmobilization(
        new LucidUnitOfWork(),
        new LucidDeviceCommandRepository(),
        new LucidVehicleStateReader(),
        new SystemClock(),
        new LucidAuditLogger(),
        immo.maxPositionAgeSeconds
      )
    })

    // ------------------------------------------------------------- télémetrie
    this.app.container.singleton(IngestPositionUseCase, () => {
      return new IngestPositionUseCase(new LucidPositionRepository())
    })

    // Client MQTT Flespi — démarré au boot si un token est configuré.
    const flespi = sisbmConfig.flespi
    if (flespi.token) {
      this.flespiClient = new FlespiMqttClient(
        {
          host: flespi.mqttHost,
          port: flespi.mqttPort,
          tls: flespi.mqttTls,
          token: flespi.token,
          clientId: flespi.clientId,
        },
        new IngestPositionUseCase(new LucidPositionRepository())
      )
    }
  }

  async boot() {}

  async start() {
    if (this.flespiClient) {
      try {
        await this.flespiClient.connect()
      } catch (err) {
        console.error('[flespi-mqtt] échec de connexion au démarrage', err)
      }
    }
  }

  async ready() {}

  async shutdown() {
    if (this.flespiClient) {
      await this.flespiClient.disconnect()
    }
  }
}