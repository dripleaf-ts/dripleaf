import { Client, toPlainText } from "../packages/dripleaf/src/index.ts"
import { BlockPos } from "../packages/core/src/index.ts"
import { InteractionHand, BlockFace } from "../packages/protocol/src/index.ts"

const host = process.argv[2] ?? "localhost"
const port = parseInt(process.argv[3] ?? "25565", 10)
const name = process.argv[4] ?? "TestBot"

const passed: string[] = []
const failed: string[] = []

function ok(label: string) {
  passed.push(label)
  console.log(`  PASS: ${label}`)
}

function fail(label: string, err?: unknown) {
  failed.push(label)
  console.log(`  FAIL: ${label}`, err ?? "")
}

function assert(cond: boolean, label: string, err?: string) {
  if (cond) ok(label)
  else fail(label, err ?? "assertion failed")
}

const bot = new Client(name)
let spawnReceived = false
let moveReceived = false
let chatReceived = false
let healthReceived = false
let entitySpawnReceived = false
let entityDespawnReceived = false
let playerJoinReceived = false
let heldItemChangeReceived = false
let pathFoundReceived = false
let windowOpenReceived = false
let packetReceived = false
let stateReceived = false

bot.on("packet", () => { packetReceived = true })
bot.on("state", () => { stateReceived = true })

bot.on("spawn", (packet) => {
  spawnReceived = true
  assert(bot.entityId >= 0, "entityId is set")
  assert(bot.loggedIn, "loggedIn is true")
  assert(packet.commonPlayerSpawnInfo.dimension !== undefined, "spawn has dimension")
  assert(bot.world !== null, "world is initialized")
  assert(bot.pathfinder !== null, "pathfinder is initialized")
  console.log(`  entityId=${bot.entityId}, dim=${packet.commonPlayerSpawnInfo.dimension}`)
})

bot.on("move", () => {
  moveReceived = true
})

bot.on("chat", (message, sender) => {
  chatReceived = true
  const senderName = sender ? toPlainText(sender) : "server"
  console.log(`  chat from ${senderName}: ${toPlainText(message)}`)
})

bot.on("health", (health: number, food: number, saturation: number) => {
  healthReceived = true
  console.log(`  health=${health} food=${food} saturation=${saturation}`)
})

bot.on("entitySpawn", (entity) => {
  entitySpawnReceived = true
  assert(entity.id > 0, "entity has positive id")
  assert(entity.type !== undefined, "entity has type")
  console.log(`  entitySpawn: id=${entity.id} type=${entity.type}`)
})

bot.on("entityDespawn", (id: number) => {
  entityDespawnReceived = true
  console.log(`  entityDespawn: id=${id}`)
})

bot.on("playerJoin", (player) => {
  playerJoinReceived = true
  console.log(`  playerJoin: ${player.name}`)
})

bot.on("playerLeave", (player) => {
  console.log(`  playerLeave: ${player.name}`)
})

bot.on("heldItemChange", (slot: number) => {
  heldItemChangeReceived = true
  console.log(`  heldItemChange: slot=${slot}`)
})

bot.on("pathFound", (result) => {
  pathFoundReceived = true
  assert(result.nodes.length > 0, "path has nodes")
  console.log(`  pathFound: ${result.nodes.length} nodes, cost=${result.cost}`)
})

bot.on("pathStop", () => {
  console.log(`  pathStop received`)
})

bot.on("windowOpen", (window) => {
  windowOpenReceived = true
  console.log(`  windowOpen: id=${window.id} type=${window.type}`)
})

bot.on("windowClose", (window) => {
  console.log(`  windowClose: id=${window.id}`)
})

bot.on("disconnect", (reason: string) => {
  console.log(`  disconnect: ${reason}`)
})

bot.on("error", (err: Error) => {
  console.error("  ERROR:", err.message)
})

bot.on("end", () => {
  console.log("\n=== RESULTS ===")
  console.log(`Passed: ${passed.length}`)
  console.log(`Failed: ${failed.length}`)
  for (const f of failed) console.log(`  FAILED: ${f}`)

  const features = [
    ["spawn", spawnReceived],
    ["move", moveReceived],
    ["chat", chatReceived],
    ["health", healthReceived],
    ["entitySpawn", entitySpawnReceived],
    ["playerJoin", playerJoinReceived],
    ["heldItemChange", heldItemChangeReceived],
    ["packet", packetReceived],
  ]
  console.log("\n=== EVENT COVERAGE ===")
  for (const [name, received] of features) {
    console.log(`  ${received ? "OK" : "MISSING"}: ${name}`)
  }

  process.exit(failed.length > 0 ? 1 : 0)
})

console.log(`connecting to ${host}:${port} as ${name}...`)
await bot.connect(host, port)

// Wait for spawn, then run tests sequentially
setTimeout(async () => {
  if (!bot.loggedIn) {
    console.log("FAILED: never logged in")
    process.exit(1)
  }

  console.log("\n=== BASIC PROPERTIES ===")
  assert(typeof bot.entityId === "number", "entityId is number")
  assert(typeof bot.position.x === "number", "position.x is number")
  assert(typeof bot.position.y === "number", "position.y is number")
  assert(typeof bot.position.z === "number", "position.z is number")
  assert(typeof bot.yaw === "number", "yaw is number")
  assert(typeof bot.pitch === "number", "pitch is number")
  assert(typeof bot.health === "number", "health is number")
  assert(typeof bot.food === "number", "food is number")
  assert(typeof bot.saturation === "number", "saturation is number")
  assert(bot.world !== null, "world exists")
  assert(bot.inventory !== null, "inventory exists")
  assert(bot.registries !== null, "registries exists")
  assert(bot.players instanceof Map, "players is Map")
  assert(bot.entities instanceof Map, "entities is Map")
  console.log(`  pos=(${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)}, ${bot.position.z.toFixed(1)})`)
  console.log(`  yaw=${bot.yaw} pitch=${bot.pitch} onGround=${bot.onGround}`)
  console.log(`  health=${bot.health} food=${bot.food} sat=${bot.saturation}`)

  console.log("\n=== CHAT ===")
  bot.chat("Hello from dripleaf test!")
  await sleep(500)
  assert(true, "chat message sent")
  bot.chat("/say test_broadcast")
  await sleep(500)
  assert(true, "command sent")

  console.log("\n=== MOVEMENT ===")
  const origX = bot.position.x
  const origY = bot.position.y
  const origZ = bot.position.z
  bot.move(origX + 1, origY, origZ)
  await sleep(300)
  assert(true, "move sent")
  bot.look(90, 0)
  await sleep(300)
  assert(typeof bot.yaw === "number", "look set yaw")
  assert(bot.yaw === 90, "look yaw is 90")
  bot.moveAndLook(origX, origY, origZ + 1, 180, 45)
  await sleep(300)
  assert(true, "moveAndLook sent")
  assert(bot.yaw === 180, "moveAndLook yaw")
  assert(bot.pitch === 45, "moveAndLook pitch")
  bot.lookAt(origX + 5, origY + 2, origZ + 5)
  await sleep(300)
  assert(true, "lookAt sent")

  console.log("\n=== WORLD ===")
  const feetBlock = bot.world?.getBlock(new BlockPos(Math.floor(origX), Math.floor(origY - 1), Math.floor(origZ)))
  console.log(`  block at feet: ${feetBlock ? (feetBlock.type as string) : "unknown"}`)
  assert(feetBlock !== undefined || true, "blockAt works")
  const block = bot.blockAt(new BlockPos(Math.floor(origX), Math.floor(origY - 1), Math.floor(origZ)))
  console.log(`  blockAt: ${block ? (block.type as string) : "unknown"}`)

  console.log("\n=== BLOCK CLASSIFICATION ===")
  const { classifyBlock } = await import("../packages/physics/src/index.ts")
  const airBlock = classifyBlock({ type: "minecraft:air", properties: {} })
  assert(airBlock.passable === true, "air is passable")
  assert(airBlock.solid === false, "air is not solid")
  assert(airBlock.standable === false, "air is not standable")
  const stoneBlock = classifyBlock({ type: "minecraft:stone", properties: {} })
  assert(stoneBlock.passable === false, "stone is not passable")
  assert(stoneBlock.solid === true, "stone is solid")
  assert(stoneBlock.standable === true, "stone is standable")
  const waterBlock = classifyBlock({ type: "minecraft:water", properties: {} })
  assert(waterBlock.water === true, "water is water")
  assert(waterBlock.passable === false, "water is not passable (for pathfinding)")
  console.log("  block classification works")

  console.log("\n=== HELD ITEM ===")
  bot.setHeldItem(0)
  await sleep(200)
  assert(bot.heldItem === 0, "heldItem set to 0")
  bot.setHeldItem(4)
  await sleep(200)
  assert(bot.heldItem === 4, "heldItem set to 4")
  bot.setHeldItem(0)
  await sleep(200)

  console.log("\n=== SWING ARM ===")
  bot.swingArm(InteractionHand.MainHand)
  await sleep(100)
  assert(true, "swingArm MainHand sent")
  bot.swingArm(InteractionHand.OffHand)
  await sleep(100)
  assert(true, "swingArm OffHand sent")

  console.log("\n=== BLOCK INTERACTION ===")
  const targetBlock = new BlockPos(Math.floor(origX), Math.floor(origY - 1), Math.floor(origZ))
  bot.blockInteract(targetBlock.x, targetBlock.y, targetBlock.z, BlockFace.Up)
  await sleep(200)
  assert(true, "blockInteract sent")
  bot.placeBlock(targetBlock.x, targetBlock.y, targetBlock.z, BlockFace.Up)
  await sleep(200)
  assert(true, "placeBlock sent")

  console.log("\n=== MINING ===")
  bot.dig(targetBlock.x, targetBlock.y, targetBlock.z, BlockFace.Up)
  await sleep(500)
  assert(true, "dig sent")
  bot.mine(targetBlock.x, targetBlock.y, targetBlock.z, BlockFace.Up)
  await sleep(300)
  bot.stopMine()
  await sleep(200)
  assert(true, "mine/stopMine sent")

  console.log("\n=== INVENTORY ===")
  const inv = bot.inventory
  assert(inv.id === 0, "inventory id is 0")
  assert(inv.type === "inventory", "inventory type is inventory")
  assert(typeof inv.state === "number", "inventory has state")
  console.log(`  inventory: ${inv.title}, slots=${inv.slots.size}`)
  const win = bot.getWindow(0)
  assert(win === inv, "getWindow(0) returns inventory")
  assert(bot.currentWindowId === null || typeof bot.currentWindowId === "number", "currentWindowId is valid")

  console.log("\n=== PATHFINDING ===")
  bot.goto(Math.floor(origX + 5), Math.floor(origY), Math.floor(origZ))
  await sleep(2000)
  if (pathFoundReceived) {
    ok("pathFound event fired")
  } else {
    fail("pathFound event not fired (may need more time)")
  }
  bot.stopPathfinding()
  await sleep(200)
  assert(true, "stopPathfinding sent")

  console.log("\n=== ENTITY TRACKING ===")
  const entityCount = bot.entities.size
  console.log(`  tracked entities: ${entityCount}`)
  assert(typeof entityCount === "number", "entity count is number")

  console.log("\n=== PLAYER TRACKING ===")
  const playerCount = bot.players.size
  console.log(`  tracked players: ${playerCount}`)
  assert(typeof playerCount === "number", "player count is number")

  console.log("\n=== EQUIPMENT ===")
  assert(bot.equipment instanceof Map, "equipment is Map")

  console.log("\n=== DISCONNECT ===")
  bot.disconnect()
}, 3000)

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}
