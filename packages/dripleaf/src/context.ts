import type { BlockFace, Connection } from "@dripleaf/protocol"
import type { GameProfile, BlockPos } from "@dripleaf/core"
import type { World } from "@dripleaf/world"
import type { EntityData } from "@dripleaf/entity"
import type { Window, ItemStack } from "@dripleaf/inventory"
import type { RegistryManager } from "@dripleaf/registry"
import type { EventEmitter } from "node:events"
import type { Vec3 } from "vec3"

export type EquipmentEntry = {
  slot: number
  item: ItemStack
}

export type ClientContext = {
  username: string
  connection: Connection | null
  profile: GameProfile | null
  loggedIn: boolean
  entityId: number
  position: Vec3
  yaw: number
  pitch: number
  onGround: boolean
  health: number
  food: number
  saturation: number
  world: World | null
  entities: Map<number, EntityData>
  inventory: Window
  windows: Map<number, Window>
  currentWindowId: number | null
  heldItem: number
  sequence: number
  equipment: Map<number, EquipmentEntry[]>
  registries: RegistryManager
  chunkBatchSize: number
  mining: { pos: BlockPos; face: BlockFace } | null
  players: Map<string, { uuid: string; name: string }>
  emitter: EventEmitter
  emit(event: string, ...args: unknown[]): void

  gameMode: number
  previousGameMode: number
  isFlying: boolean
  flyingSpeed: number
  walkingSpeed: number
  invulnerable: boolean
  instantBreak: boolean
  experienceLevel: number
  experienceProgress: number
  totalExperience: number
  velocity: Vec3
  isDead: boolean
  attackCooldown: number
  attackCooldownMax: number
  worldBorder: {
    centerX: number
    centerZ: number
    diameter: number
    targetDiameter: number
    speed: number
    warningBlocks: number
    warningTime: number
  }
  advancements: {
    recipes: Set<string>
    recipeBookOpen: boolean
    recipeBookFiltering: boolean
  }
  difficulty: number
  timeOfDay: number
  gameTime: number
  spawnPosition: Vec3 | null
  itemCooldowns: Map<string, number>
}
