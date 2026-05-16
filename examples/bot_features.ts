import { Client, toPlainText } from "../packages/dripleaf/src/index.ts"
import { BlockPos } from "../packages/core/src/index.ts"

const host = process.argv[2] ?? "localhost"
const port = parseInt(process.argv[3] ?? "25565", 10)
const name = process.argv[4] ?? "DripleafBot"

const bot = new Client(name)

bot.on("spawn", () => {
  console.log("spawned in world")
  console.log("position:", bot.position)
  console.log("health:", bot.health, "food:", bot.food, "saturation:", bot.saturation)

  // Check block at feet
  const feetPos = new BlockPos(Math.floor(bot.position.x), Math.floor(bot.position.y - 1), Math.floor(bot.position.z))
  const block = bot.world?.getBlock(feetPos)
  console.log("block at feet:", block)

  bot.chat("I'm standing on " + (block ? (block.type as string) : "air"))
})

bot.on("move", () => {
  console.log("moved to:", bot.position)
})

bot.on("health", (health, food, saturation) => {
  console.log(`health: ${health}, food: ${food}, saturation: ${saturation}`)
})

bot.on("chat", (message, sender) => {
  const text = toPlainText(message)
  const senderName = sender ? toPlainText(sender) : "server"
  console.log(`chat [${senderName}]:`, text)

  if (text.includes("position")) {
    bot.chat(`My position is ${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)}, ${bot.position.z.toFixed(1)}`)
  }
})

bot.on("error", (err: Error) => {
  console.error("error:", err)
})

bot.on("disconnect", (reason: string) => {
  console.log("disconnect reason:", reason)
})

bot.on("end", () => {
  console.log("disconnected")
  process.exit(0)
})

console.log(`connecting to ${host}:${port} as ${name}...`)
await bot.connect(host, port)