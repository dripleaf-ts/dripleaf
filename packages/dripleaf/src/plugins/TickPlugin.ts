import { Connection, play } from "@dripleaf/protocol"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class TickPlugin implements ClientPlugin {
  readonly name = "tick"
  #interval: ReturnType<typeof setInterval> | null = null
  #tickCount = 0

  register(ctx: ClientContext, conn: Connection): void {
    this.#interval = setInterval(() => {
      if (!ctx.loggedIn) return
      try {
        conn.write(new play.ServerboundClientTickEndPacket())

        if (ctx.attackCooldown > 0) ctx.attackCooldown--

        this.#tickCount++
        if (this.#tickCount % 20 === 0) {
          conn.write(new play.ServerboundMovePlayerStatusOnlyPacket(ctx.onGround, false))
        }
      } catch (error) {
        console.error("tick error:", error)
      }
    }, 50)
    conn.on("end", () => {
      if (this.#interval) clearInterval(this.#interval)
      this.#interval = null
      this.#tickCount = 0
    })
  }
}
