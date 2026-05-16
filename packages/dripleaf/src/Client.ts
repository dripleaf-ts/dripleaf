import { EventEmitter } from "node:events"
import { connect as tcpConnect } from "node:net"
import { resolveSrv } from "node:dns"
import { Vec3 } from "vec3"
import { Connection, State, InteractionHand, BlockFace, play } from "@dripleaf/protocol"
import type { GameProfile } from "@dripleaf/core"
import { BlockPos } from "@dripleaf/core"
import { Window, simulateClick, ClickType } from "@dripleaf/inventory"
import { RegistryManager } from "@dripleaf/registry"
import type { World } from "@dripleaf/world"
import type { EntityData } from "@dripleaf/entity"
import type { Pathfinder, PathResult } from "@dripleaf/pathfinder"
import type { ClientContext, EquipmentEntry } from "./context"
import { defaultPlugins, ConnectionPlugin, goto as gotoPath, stopPathfinding, startMining, finishMining, stopMining } from "./plugins"
import type { ChatComponent } from "@dripleaf/chat"

type ClientEvents = {
  spawn: (packet: play.ClientboundLoginPacket) => void
  respawn: (packet: play.ClientboundRespawnPacket) => void
  chat: (message: ChatComponent, sender: ChatComponent | null) => void
  disconnect: (reason: string) => void
  error: (error: Error) => void
  end: () => void
  packet: (packet: unknown) => void
  state: (state: State) => void
  move: () => void
  health: (health: number, food: number, saturation: number) => void
  experience: (level: number, progress: number, total: number) => void
  gameModeChanged: (gameMode: number, previousGameMode: number) => void
  abilitiesChanged: () => void
  death: () => void
  velocity: (velocity: { x: number; y: number; z: number }) => void
  heldItemChange: (slot: number) => void
  entitySpawn: (entity: EntityData) => void
  entityDespawn: (entityId: number) => void
  windowOpen: (window: Window) => void
  windowClose: (window: Window) => void
  playerJoin: (player: { uuid: string; name: string }) => void
  playerLeave: (player: { uuid: string; name: string }) => void
  pathFound: (result: PathResult) => void
  pathStop: () => void
  scoreboardObjective: (action: number, name: string, displayName: ChatComponent | null) => void
  scoreboardScore: (objectiveName: string, itemName: string, value: number | null) => void
  scoreboardDisplay: (position: number, objectiveName: string) => void
  bossBar: (action: number, uuid: string, title: ChatComponent | null, health: number) => void
  title: (action: string, text: ChatComponent | null, fadeIn: number, stay: number, fadeOut: number) => void
  tabComplete: (id: number, matches: string[]) => void
  blockBreakProgress: (entityId: number, position: BlockPos, stage: number) => void
}

export class Client {
  private emitter = new EventEmitter()
  private ctx: ClientContext
  private connectionPlugin = new ConnectionPlugin()

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

  gameMode = 0
  previousGameMode = -1
  isFlying = false
  flyingSpeed = 0.05
  walkingSpeed = 0.1
  invulnerable = false
  instantBreak = false

  experienceLevel = 0
  experienceProgress = 0
  totalExperience = 0

  velocity = { x: 0, y: 0, z: 0 }
  isDead = false

  attackCooldown = 0
  attackCooldownMax = 20

  worldBorder = {
    centerX: 0,
    centerZ: 0,
    diameter: 29999984,
    targetDiameter: 29999984,
    speed: 0,
    warningBlocks: 0,
    warningTime: 0,
  }

  world: World | null = null
  entities: Map<number, EntityData> = new Map()
  players = new Map<string, { uuid: string; name: string }>()

  inventory: Window
  windows = new Map<number, Window>()
  currentWindowId: number | null = null
  heldItem = 0
  equipment: Map<number, EquipmentEntry[]> = new Map()

  pathfinder: Pathfinder | null = null
  readonly registries = new RegistryManager()

  constructor(username: string) {
    this.username = username
    this.inventory = new Window(0, "inventory", "Inventory", 46)
    this.ctx = this.createContext()
  }

  private createContext(): ClientContext {
    const client = this
    return {
      get username() { return client.username },
      get connection() { return client.connection },
      set connection(v) { client.connection = v },
      get profile() { return client.profile },
      set profile(v) { client.profile = v },
      get loggedIn() { return client.loggedIn },
      set loggedIn(v) { client.loggedIn = v },
      get entityId() { return client.entityId },
      set entityId(v) { client.entityId = v },
      get position() { return client.position },
      get yaw() { return client.yaw },
      set yaw(v) { client.yaw = v },
      get pitch() { return client.pitch },
      set pitch(v) { client.pitch = v },
      get onGround() { return client.onGround },
      set onGround(v) { client.onGround = v },
      get health() { return client.health },
      set health(v) { client.health = v },
      get food() { return client.food },
      set food(v) { client.food = v },
      get saturation() { return client.saturation },
      set saturation(v) { client.saturation = v },
      get world() { return client.world },
      set world(v) { client.world = v },
      get entities() { return client.entities },
      get inventory() { return client.inventory },
      get windows() { return client.windows },
      get currentWindowId() { return client.currentWindowId },
      set currentWindowId(v) { client.currentWindowId = v },
      get heldItem() { return client.heldItem },
      set heldItem(v) { client.heldItem = v },
      sequence: 0,
      get equipment() { return client.equipment },
      get registries() { return client.registries },
      chunkBatchSize: 0,
      get pathfinder() { return client.pathfinder },
      set pathfinder(v) { client.pathfinder = v },
      mining: null,
      get players() { return client.players },
      get gameMode() { return client.gameMode },
      set gameMode(v) { client.gameMode = v },
      get previousGameMode() { return client.previousGameMode },
      set previousGameMode(v) { client.previousGameMode = v },
      get isFlying() { return client.isFlying },
      set isFlying(v) { client.isFlying = v },
      get flyingSpeed() { return client.flyingSpeed },
      set flyingSpeed(v) { client.flyingSpeed = v },
      get walkingSpeed() { return client.walkingSpeed },
      set walkingSpeed(v) { client.walkingSpeed = v },
      get invulnerable() { return client.invulnerable },
      set invulnerable(v) { client.invulnerable = v },
      get instantBreak() { return client.instantBreak },
      set instantBreak(v) { client.instantBreak = v },
      get experienceLevel() { return client.experienceLevel },
      set experienceLevel(v) { client.experienceLevel = v },
      get experienceProgress() { return client.experienceProgress },
      set experienceProgress(v) { client.experienceProgress = v },
      get totalExperience() { return client.totalExperience },
      set totalExperience(v) { client.totalExperience = v },
      get velocity() { return client.velocity },
      set velocity(v) { client.velocity = v },
      get isDead() { return client.isDead },
      set isDead(v) { client.isDead = v },
      get attackCooldown() { return client.attackCooldown },
      set attackCooldown(v) { client.attackCooldown = v },
      get attackCooldownMax() { return client.attackCooldownMax },
      set attackCooldownMax(v) { client.attackCooldownMax = v },
      get worldBorder() { return client.worldBorder },
      set worldBorder(v) { client.worldBorder = v },
      emitter: this.emitter,
      emit: (event, ...args) => client.emit(event, ...args),
    }
  }

  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return this
  }

  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
    return this
  }

  blockAt(pos: BlockPos) {
    return this.world?.getBlock(pos)
  }

  getWindow(windowId = this.currentWindowId ?? 0): Window {
    if (windowId === 0) return this.inventory
    return this.windows.get(windowId) ?? this.inventory
  }

  async connect(host: string, port = 25565): Promise<void> {
    const resolved = await this.resolveSrv(host, port)
    return new Promise((resolve, reject) => {
      const socket = tcpConnect(resolved.port, resolved.host, () => {
        this.connection = new Connection(socket, false)
        this.setupHandlers()
        this.connectionPlugin.startLogin(this.connection, host, resolved.port, this.username)
        resolve()
      })
      socket.on("error", reject)
      socket.setTimeout(10000)
    })
  }

  private isIpAddress(host: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[?([0-9a-fA-F:]+)\]?$/.test(host)
  }

  private resolveSrv(host: string, port: number): Promise<{ host: string; port: number }> {
    if (this.isIpAddress(host) || port !== 25565)
      return Promise.resolve({ host, port })
    return new Promise((resolve) => {
      resolveSrv(`_minecraft._tcp.${host}`, (err, records) => {
        if (err || !records?.length) {
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
        { seconds: BigInt(Math.floor(Date.now() / 1000)) },
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
    this.look((-Math.atan2(dx, dz) * 180) / Math.PI, (-Math.atan2(dy, h) * 180) / Math.PI)
  }

  swingArm(hand: InteractionHand = InteractionHand.MainHand): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundSwingPacket(hand))
  }

  attack(entityId: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundAttackPacket(entityId))
  }

  mine(x: number, y: number, z: number, face = BlockFace.Up): void {
    if (!this.connection) throw new Error("Not connected")
    startMining(this.ctx, this.connection, x, y, z, face)
  }

  stopMine(): void {
    if (!this.connection) return
    stopMining(this.ctx, this.connection)
  }

  dig(x: number, y: number, z: number, face = BlockFace.Up): void {
    if (!this.connection) throw new Error("Not connected")
    startMining(this.ctx, this.connection, x, y, z, face)
    finishMining(this.ctx, this.connection)
  }

  placeBlock(x: number, y: number, z: number, face: BlockFace): void {
    this.blockInteract(x, y, z, face)
  }

  blockInteract(x: number, y: number, z: number, face: BlockFace): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundUseItemOnPacket(
      InteractionHand.MainHand,
      {
        blockPos: new BlockPos(x, y, z),
        direction: face,
        location: new Vec3(this.position.x, this.position.y, this.position.z),
        inside: false,
        worldBorder: false,
      },
      this.ctx.sequence++,
    ))
  }

  clickSlot(slot: number, button = 0, clickType: ClickType = ClickType.Pickup, windowId?: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    const window = this.getWindow(windowId)
    const result = simulateClick(window, slot, button, clickType)
    if (!result) throw new Error("Invalid click")
    this.connection.write(new play.ServerboundContainerClickPacket(
      window.id,
      window.state,
      slot,
      button,
      clickType,
      result.changedSlots,
      result.carriedItem,
    ))
  }

  closeWindow(windowId?: number): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    const id = windowId ?? this.currentWindowId
    if (id === null || id === 0) return
    this.connection.write(new play.ServerboundContainerClosePacket(id))
  }

  respawn(): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundClientCommandPacket(0 as any))
  }

  interactEntity(entityId: number, hand: InteractionHand = InteractionHand.MainHand, location?: { x: number; y: number; z: number }): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    const loc = location ?? { x: this.position.x, y: this.position.y, z: this.position.z }
    this.connection.write(new play.ServerboundInteractPacket(entityId, hand, new Vec3(loc.x, loc.y, loc.z), false))
    this.connection.write(new play.ServerboundInteractPacket(entityId, hand, new Vec3(loc.x, loc.y, loc.z), false))
  }

  useItem(hand: InteractionHand = InteractionHand.MainHand): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundUseItemPacket(hand, this.ctx.sequence++, this.yaw, this.pitch))
  }

  setFlying(flying: boolean): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundPlayerAbilitiesPacket(flying))
    this.isFlying = flying
  }

  setCreativeModeSlot(slot: number, itemId: number, count: number, components?: any): void {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    this.connection.write(new play.ServerboundSetCreativeModeSlotPacket(slot, {
      type: "present",
      item: { kind: itemId, count, component_patch: components ?? {} },
    }))
  }

  tabComplete(text: string): Promise<string[]> {
    if (!this.connection || !this.loggedIn) throw new Error("Not connected")
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 2147483647)
      const handler = (packet: any) => {
        if (packet.transactionId === id) {
          this.emitter.off("tabComplete", handler)
          resolve(packet.matches.map((m: any) => m.match))
        }
      }
      this.emitter.on("tabComplete", handler)
      this.connection!.write(new play.ServerboundCommandSuggestionPacket(id, text))
      setTimeout(() => {
        this.emitter.off("tabComplete", handler)
        resolve([])
      }, 5000)
    })
  }

  goto(x: number, y: number, z: number): void {
    gotoPath(this.ctx, new BlockPos(x, y, z))
  }

  stopPathfinding(): void {
    stopPathfinding(this.ctx)
  }

  disconnect(): void {
    this.connection?.disconnect()
  }

  private emit(event: string, ...args: unknown[]) {
    this.emitter.emit(event, ...args)
  }

  private setupHandlers(): void {
    const conn = this.connection!
    this.connectionPlugin.register(this.ctx, conn)
    for (const plugin of defaultPlugins)
      plugin.register(this.ctx, conn)
  }
}
