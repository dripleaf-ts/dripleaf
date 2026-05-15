import { EventEmitter } from "node:events"
import { connect as tcpConnect } from "node:net"
import { randomUUID } from "node:crypto"
import type { UUID } from "node:crypto"
import { resolveSrv } from "node:dns"
import { Connection, State, ClientIntention, ChatVisibility, HumanoidArm, ParticleStatus, InteractionHand, PacketReader } from "@dripleaf/protocol"
import { handshake, login, play, configuration } from "@dripleaf/protocol"
import type { GameProfile } from "@dripleaf/core"
import { chatComponentFromNbt } from "@dripleaf/chat"
import { World, ChunkData, ChunkSection, chunkKey, createLinearPalette, createSingletonPalette, createBiomePalette } from "@dripleaf/world"
import type { Dimension, Palette } from "@dripleaf/world"
import { EntityData, Vec3, decodeMetadata } from "@dripleaf/entity"
import { Window } from "@dripleaf/inventory"
import type { ItemStack } from "@dripleaf/inventory"
import { BlockPos } from "@dripleaf/core"

type EquipmentEntry = {
  slot: number
  item: ItemStack
}

const MIN_SECTION_Y = -4
const SECTION_COUNT = 24

type ClientEvents = {
  spawn: (packet: play.ClientboundLoginPacket) => void
  chat: (message: string, sender: string | null) => void
  disconnect: (reason: string) => void
  error: (error: Error) => void
  end: () => void
  packet: (packet: any) => void
  state: (state: State) => void
  move: () => void
  health: (health: number, food: number, saturation: number) => void
  heldItemChange: (slot: number) => void
  entitySpawn: (entity: EntityData) => void
  entityDespawn: (entityId: number) => void
}

function swappedLongs(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 8) {
    for (let j = 0; j < 8; j++) {
      out[i + j] = bytes[i + 7 - j]!
    }
  }
  return out
}

function createIdentityPalette(bpe: number): Palette {
  return {
    type: "linear",
    getState(index: number): number {
      return index
    },
    setState(_index: number, _value: number): void {},
    addState(value: number): number {
      return value
    },
    getIds(): number[] {
      return []
    },
    bitsPerEntry(): number {
      return bpe
    },
  }
}

function parseSections(data: Uint8Array, count: number): (ChunkSection | null)[] {
  const reader = new PacketReader(data)
  const sections: (ChunkSection | null)[] = []

  for (let i = 0; i < count; i++) {
    const section = new ChunkSection(MIN_SECTION_Y + i)

    if (reader.remaining <= 0) {
      sections.push(null)
      continue
    }

    section.blockCount = reader.readUnsignedShort()
    const bpe = reader.readUnsignedByte()

    if (bpe === 0) {
      const state = reader.readVarInt()
      section.palette = createSingletonPalette(state)
      section.states = new Uint8Array(0)
    } else if (bpe <= 8) {
      const paletteLen = reader.readVarInt()
      const ids: number[] = []
      for (let j = 0; j < paletteLen; j++) ids.push(reader.readVarInt())
      section.palette = createLinearPalette(ids)
      const dataLongs = reader.readVarInt()
      const raw = reader.readBytes(dataLongs * 8)
      section.states = swappedLongs(raw)
    } else {
      const dataLongs = reader.readVarInt()
      const raw = reader.readBytes(dataLongs * 8)
      section.palette = createIdentityPalette(bpe)
      section.states = swappedLongs(raw)
    }

    const biomeBits = reader.readUnsignedByte()

    if (biomeBits === 0) {
      const biome = reader.readVarInt()
      section.biomePalette = createSingletonPalette(biome)
      section.biomes = new Uint8Array(0)
    } else {
      const paletteLen = reader.readVarInt()
      const ids: number[] = []
      for (let j = 0; j < paletteLen; j++) ids.push(reader.readVarInt())
      section.biomePalette = createBiomePalette(ids)
      const dataLongs = reader.readVarInt()
      const raw = reader.readBytes(dataLongs * 8)
      section.biomes = swappedLongs(raw)
    }

    sections.push(section)
  }

  return sections
}

export class Client {
  private emitter: EventEmitter
  connection: Connection | null = null
  username: string
  profile: GameProfile | null = null
  loggedIn = false
  entityId = -1

  position = { x: 0, y: 0, z: 0 }
  yaw = 0
  pitch = 0
  onGround = true

  health = 20
  food = 20
  saturation = 5

  world: World | null = null
  entities: Map<number, EntityData> = new Map()

  inventory: Window
  heldItem = 0
  equipment: Map<number, EquipmentEntry[]> = new Map()

  constructor(username: string) {
    this.emitter = new EventEmitter()
    this.username = username
    this.inventory = new Window(0, "inventory", "Inventory", 46)
  }

  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return this
  }

  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
    return this
  }

  private srvHost: string | null = null

  async connect(host: string, port = 25565): Promise<void> {
    const resolved = await this.resolveSrv(host, port)
    return new Promise((resolve, reject) => {
      const socket = tcpConnect(resolved.port, resolved.host, () => {
        this.connection = new Connection(socket, false)
        this.setupHandlers()
        this.startLogin(host, resolved.port)
        resolve()
      })
      socket.on("error", reject)
      socket.setTimeout(10000)
    })
  }

  private isIpAddress(host: string): boolean {
    const ipv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
    const ipv6 = /^\[?([0-9a-fA-F:]+)\]?$/
    return ipv4.test(host) || ipv6.test(host)
  }

  private resolveSrv(host: string, port: number): Promise<{ host: string; port: number }> {
    if (this.isIpAddress(host) || port !== 25565)
      return Promise.resolve({ host, port })

    return new Promise((resolve) => {
      resolveSrv(`_minecraft._tcp.${host}`, (err, records) => {
        if (err || !records || records.length === 0) {
          resolve({ host, port })
          return
        }
        const sorted = records.sort((a, b) => a.priority - b.priority || b.weight - a.weight)
        const srv = sorted[0]!
        resolve({ host: srv.name, port: srv.port })
      })
    })
  }

  chat(message: string): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    if (message.startsWith("/")) {
      this.connection.write(new play.ServerboundChatCommandPacket(message.slice(1)))
    } else {
      this.connection.write(new play.ServerboundChatPacket(
        message,
        BigInt(Date.now()),
        0n,
        null,
        { offset: 0, acknowledged: new Uint8Array(3), checksum: 0 },
      ))
    }
  }

  move(x: number, y: number, z: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundMovePlayerPosPacket(x, y, z, this.onGround, false))
    this.position.x = x
    this.position.y = y
    this.position.z = z
    this.emit("move")
  }

  look(yaw: number, pitch: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundMovePlayerRotPacket(yaw, pitch, this.onGround, false))
    this.yaw = yaw
    this.pitch = pitch
    this.emit("move")
  }

  moveAndLook(x: number, y: number, z: number, yaw: number, pitch: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundMovePlayerPosRotPacket(x, y, z, yaw, pitch, this.onGround, false))
    this.position.x = x
    this.position.y = y
    this.position.z = z
    this.yaw = yaw
    this.pitch = pitch
    this.emit("move")
  }

  setHeldItem(slot: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundSetCarriedItemPacket(slot))
    this.heldItem = slot
    this.emit("heldItemChange", slot)
  }

  lookAt(x: number, y: number, z: number): void {
    const dx = x - this.position.x
    const dy = y - (this.position.y + 1.62)
    const dz = z - this.position.z
    const h = Math.sqrt(dx * dx + dz * dz)
    const yaw = (-Math.atan2(dx, dz) * 180) / Math.PI
    const pitch = (-Math.atan2(dy, h) * 180) / Math.PI
    this.look(yaw, pitch)
  }

  swingArm(hand: InteractionHand = InteractionHand.MainHand): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundSwingPacket(hand))
  }

  disconnect(): void {
    this.connection?.disconnect()
  }

  private emit(event: string, ...args: unknown[]) {
    this.emitter.emit(event, ...args)
  }

  private processLoginPacket(packet: play.ClientboundLoginPacket): void {
    this.entityId = packet.entityId
    this.loggedIn = true
    const dim: Dimension = {
      type: packet.commonPlayerSpawnInfo.dimensionType,
      identifier: packet.commonPlayerSpawnInfo.dimension.toString(),
    }
    this.world = new World(dim)
    this.emit("spawn", packet)
  }

  private processPositionPacket(packet: play.ClientboundPlayerPositionPacket): void {
    const rel = packet.relatives
    const pos = packet.change.position
    if (rel & 1) this.position.x += pos.x
    else this.position.x = pos.x
    if (rel & 2) this.position.y += pos.y
    else this.position.y = pos.y
    if (rel & 4) this.position.z += pos.z
    else this.position.z = pos.z
    if (rel & 8) this.yaw += packet.change.yaw
    else this.yaw = packet.change.yaw
    if (rel & 16) this.pitch += packet.change.pitch
    else this.pitch = packet.change.pitch

    this.connection!.write(new play.ServerboundAcceptTeleportationPacket(packet.teleportId))
    this.emit("move")
  }

  private processRotationPacket(packet: play.ClientboundPlayerRotationPacket): void {
    if (packet.relativeYaw) this.yaw += packet.yaw
    else this.yaw = packet.yaw
    if (packet.relativePitch) this.pitch += packet.pitch
    else this.pitch = packet.pitch
    this.emit("move")
  }

  private processHealthPacket(packet: play.ClientboundSetHealthPacket): void {
    this.health = packet.health
    this.food = packet.food
    this.saturation = packet.saturation
    this.emit("health", packet.health, packet.food, packet.saturation)
  }

  private processChunkPacket(packet: play.ClientboundLevelChunkWithLightPacket): void {
    if (!this.world) return
    const key = chunkKey(packet.x, packet.z)
    let chunk = this.world.chunks.get(key)
    if (!chunk) {
      chunk = new ChunkData(packet.x, packet.z)
      this.world.chunks.set(key, chunk)
    }
    const sections = parseSections(packet.chunkData.data, SECTION_COUNT)
    for (let i = 0; i < SECTION_COUNT; i++) {
      chunk.sections[i] = sections[i]!
    }
  }

  private processBlockUpdate(packet: play.ClientboundBlockUpdatePacket): void {
    if (!this.world) return
    const p = packet.position
    this.world.setBlock(new BlockPos(p.x, p.y, p.z), packet.blockState)
  }

  private processSectionBlocksUpdate(packet: play.ClientboundSectionBlocksUpdatePacket): void {
    if (!this.world) return
    for (const change of packet.blocks) {
      const localX = change.position & 0xf
      const localY = (change.position >> 8) & 0xf
      const localZ = (change.position >> 4) & 0xf
      const x = packet.sectionX * 16 + localX
      const y = packet.sectionY * 16 + localY
      const z = packet.sectionZ * 16 + localZ
      this.world.setBlock(new BlockPos(x, y, z), change.blockStateId)
    }
  }

  private processAddEntity(packet: play.ClientboundAddEntityPacket): void {
    const entity = new EntityData(
      packet.entityId,
      packet.entityUuid,
      packet.type,
      new Vec3(packet.x, packet.y, packet.z),
      packet.yaw,
      packet.pitch,
      packet.headYaw,
      { x: (packet.movement as any).x, y: (packet.movement as any).y, z: (packet.movement as any).z },
      new Map(),
    )
    this.entities.set(entity.id, entity)
    if (this.world) this.world.addEntity(entity)
    this.emit("entitySpawn", entity)
  }

  private processRemoveEntities(packet: play.ClientboundRemoveEntitiesPacket): void {
    for (const id of packet.entityIds) {
      this.entities.delete(id)
      this.world?.removeEntity(id)
      this.emit("entityDespawn", id)
    }
  }

  private processSetEntityData(packet: play.ClientboundSetEntityDataPacket): void {
    const entity = this.entities.get(packet.entityId)
    if (!entity) return
    const reader = new PacketReader(packet.packedItems)
    entity.metadata = decodeMetadata(reader)
  }

  private processMoveEntityPos(packet: play.ClientboundMoveEntityPosPacket): void {
    const entity = this.entities.get(packet.entityId)
    if (!entity) return
    entity.position.x += packet.deltaX / 4096
    entity.position.y += packet.deltaY / 4096
    entity.position.z += packet.deltaZ / 4096
  }

  private processMoveEntityPosRot(packet: play.ClientboundMoveEntityPosRotPacket): void {
    const entity = this.entities.get(packet.entityId)
    if (!entity) return
    entity.position.x += packet.deltaX / 4096
    entity.position.y += packet.deltaY / 4096
    entity.position.z += packet.deltaZ / 4096
    entity.yaw = packet.yaw
    entity.pitch = packet.pitch
  }

  private processMoveEntityRot(packet: play.ClientboundMoveEntityRotPacket): void {
    const entity = this.entities.get(packet.entityId)
    if (!entity) return
    entity.yaw = packet.yaw
    entity.pitch = packet.pitch
  }

  private processTeleportEntity(packet: play.ClientboundTeleportEntityPacket): void {
    const entity = this.entities.get(packet.id)
    if (!entity) return
    const change = packet.change
    const rel = packet.relatives
    if (rel.x) entity.position.x += change.position.x
    else entity.position.x = change.position.x
    if (rel.y) entity.position.y += change.position.y
    else entity.position.y = change.position.y
    if (rel.z) entity.position.z += change.position.z
    else entity.position.z = change.position.z
    if (rel.yRot) entity.yaw += change.yaw
    else entity.yaw = change.yaw
    if (rel.xRot) entity.pitch += change.pitch
    else entity.pitch = change.pitch
  }

  private processContainerContent(packet: play.ClientboundContainerSetContentPacket): void {
    if (packet.windowId === 0) {
      this.inventory.state = packet.stateId
      for (let i = 0; i < packet.slots.length; i++) {
        this.inventory.setSlot(i, packet.slots[i]!)
      }
    }
  }

  private processContainerSlot(packet: play.ClientboundContainerSetSlotPacket): void {
    if (packet.windowId === 0) {
      this.inventory.state = packet.stateId
      this.inventory.setSlot(packet.slot, packet.slotData)
    }
  }

  private processSetEquipment(packet: play.ClientboundSetEquipmentPacket): void {
    this.equipment.set(packet.entityId, packet.slots as EquipmentEntry[])
  }

  private processHeldSlot(packet: play.ClientboundSetHeldSlotPacket): void {
    this.heldItem = packet.slot
    this.emit("heldItemChange", packet.slot)
  }

  private processRespawn(packet: play.ClientboundRespawnPacket): void {
    if (!this.world) return
    this.world.dimension = {
      type: packet.commonPlayerSpawnInfo.dimensionType,
      identifier: packet.commonPlayerSpawnInfo.dimension.toString(),
    }
  }

  private processForgetChunk(packet: play.ClientboundForgetLevelChunkPacket): void {
    if (!this.world) return
    this.world.chunks.delete(chunkKey(packet.chunkPos.x, packet.chunkPos.z))
  }

  private setupHandlers() {
    const conn = this.connection!

    conn.on("packet", (packet: any) => this.emit("packet", packet))
    conn.on("state", (state: State) => this.emit("state", state))
    conn.on("error", (error: Error) => this.emit("error", error))
    conn.on("end", () => this.emit("end"))

    conn.onPacket(login.ClientboundLoginFinishedPacket, (packet: any) => {
      this.profile = packet.profile
      conn.setState(State.Configuration)
      conn.write(new login.ServerboundLoginAcknowledgedPacket())
      conn.write(new configuration.ServerboundClientInformationPacket(
        "en_us", 24, ChatVisibility.Full, true, 0,
        HumanoidArm.Right, false, true, ParticleStatus.All,
      ))
    })

    conn.onPacket(login.ClientboundLoginCompressionPacket, (packet: any) => {
      conn.setCompressionThreshold(packet.threshold)
    })

    conn.onPacket(login.ClientboundLoginDisconnectPacket, (packet: any) => {
      this.emit("disconnect", JSON.stringify(packet.reason))
    })

    conn.onPacket(configuration.ClientboundDisconnectPacket, (packet: any) => {
      this.emit("disconnect", chatComponentFromNbt(packet.reason))
      conn.disconnect()
    })

    conn.onPacket(configuration.ClientboundFinishConfigurationPacket, () => {
      conn.write(new configuration.ServerboundFinishConfigurationPacket())
      conn.setState(State.Play)
    })

    conn.onPacket(play.ClientboundLoginPacket, (packet: play.ClientboundLoginPacket) => {
      this.processLoginPacket(packet)
      conn.write(new play.ServerboundPlayerLoadedPacket())
    })

    conn.onPacket(play.ClientboundPlayerPositionPacket, (packet: play.ClientboundPlayerPositionPacket) => {
      this.processPositionPacket(packet)
    })

    conn.onPacket(play.ClientboundSystemChatPacket, (packet: any) => {
      const text = chatComponentFromNbt(packet.content)
      this.emit("chat", text, null)
    })

    conn.onPacket(play.ClientboundPlayerChatPacket, (packet: play.ClientboundPlayerChatPacket) => {
      const text = packet.unsignedContent
        ? chatComponentFromNbt(packet.unsignedContent)
        : packet.body.content
      this.emit("chat", text, packet.sender)
    })

    conn.onPacket(play.ClientboundDisconnectPacket, (packet: any) => {
      this.emit("disconnect", chatComponentFromNbt(packet.reason))
      conn.disconnect()
    })

    conn.onPacket(play.ClientboundSetHealthPacket, (packet: play.ClientboundSetHealthPacket) => {
      this.processHealthPacket(packet)
    })

    conn.onPacket(play.ClientboundLevelChunkWithLightPacket, (packet: play.ClientboundLevelChunkWithLightPacket) => {
      this.processChunkPacket(packet)
    })

    conn.onPacket(play.ClientboundBlockUpdatePacket, (packet: play.ClientboundBlockUpdatePacket) => {
      this.processBlockUpdate(packet)
    })

    conn.onPacket(play.ClientboundSectionBlocksUpdatePacket, (packet: play.ClientboundSectionBlocksUpdatePacket) => {
      this.processSectionBlocksUpdate(packet)
    })

    conn.onPacket(play.ClientboundAddEntityPacket, (packet: play.ClientboundAddEntityPacket) => {
      this.processAddEntity(packet)
    })

    conn.onPacket(play.ClientboundRemoveEntitiesPacket, (packet: play.ClientboundRemoveEntitiesPacket) => {
      this.processRemoveEntities(packet)
    })

    conn.onPacket(play.ClientboundSetEntityDataPacket, (packet: play.ClientboundSetEntityDataPacket) => {
      this.processSetEntityData(packet)
    })

    conn.onPacket(play.ClientboundMoveEntityPosPacket, (packet: play.ClientboundMoveEntityPosPacket) => {
      this.processMoveEntityPos(packet)
    })

    conn.onPacket(play.ClientboundMoveEntityPosRotPacket, (packet: play.ClientboundMoveEntityPosRotPacket) => {
      this.processMoveEntityPosRot(packet)
    })

    conn.onPacket(play.ClientboundMoveEntityRotPacket, (packet: play.ClientboundMoveEntityRotPacket) => {
      this.processMoveEntityRot(packet)
    })

    conn.onPacket(play.ClientboundTeleportEntityPacket, (packet: play.ClientboundTeleportEntityPacket) => {
      this.processTeleportEntity(packet)
    })

    conn.onPacket(play.ClientboundContainerSetContentPacket, (packet: play.ClientboundContainerSetContentPacket) => {
      this.processContainerContent(packet)
    })

    conn.onPacket(play.ClientboundContainerSetSlotPacket, (packet: play.ClientboundContainerSetSlotPacket) => {
      this.processContainerSlot(packet)
    })

    conn.onPacket(play.ClientboundSetEquipmentPacket, (packet: play.ClientboundSetEquipmentPacket) => {
      this.processSetEquipment(packet)
    })

    conn.onPacket(play.ClientboundSetHeldSlotPacket, (packet: play.ClientboundSetHeldSlotPacket) => {
      this.processHeldSlot(packet)
    })

    conn.onPacket(play.ClientboundRespawnPacket, (packet: play.ClientboundRespawnPacket) => {
      this.processRespawn(packet)
    })

    conn.onPacket(play.ClientboundForgetLevelChunkPacket, (packet: play.ClientboundForgetLevelChunkPacket) => {
      this.processForgetChunk(packet)
    })

    conn.onPacket(play.ClientboundPlayerRotationPacket, (packet: play.ClientboundPlayerRotationPacket) => {
      this.processRotationPacket(packet)
    })
  }

  private startLogin(host: string, port: number) {
    const conn = this.connection!
    conn.write(new handshake.ServerboundIntentionPacket(775, host, port, ClientIntention.Login))
    conn.setState(State.Login)
    conn.write(new login.ServerboundHelloPacket(this.username, randomUUID() as UUID))
  }
}
