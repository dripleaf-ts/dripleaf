import { EntityType, EntityTypeRegistry } from "@dripleaf/registry"

export { EntityType, EntityTypeRegistry }

export type EntityData = {
  id: number
  type: EntityType
  uuid: string
  position: { x: number; y: number; z: number }
  yaw: number
  pitch: number
  headYaw: number
  velocityX: number
  velocityY: number
  velocityZ: number
  metadata: Record<number, unknown>
}
