import { Client } from "../packages/dripleaf/src/index.ts"

const host = process.argv[2] ?? "localhost"
const port = parseInt(process.argv[3] ?? "25565", 10)
const name = process.argv[4] ?? "DripleafBot"

const bot = new Client(name)

bot.on("spawn", () => {
  console.log("spawned in world")
  bot.chat("Hello from dripleaf!")
})

bot.on("chat", (message: string) => {
  console.log("chat:", message)
})

bot.on("error", (err: Error) => {
  console.error("error:", err)
})

bot.on("end", () => {
  console.log("disconnected")
  process.exit(0)
})

console.log(`connecting to ${host}:${port} as ${name}...`)
await bot.connect(host, port)
