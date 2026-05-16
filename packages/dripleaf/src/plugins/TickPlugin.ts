import { play } from "@dripleaf/protocol"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"
import { tickPathfinder } from "./PathfinderPlugin"

export class TickPlugin implements ClientPlugin {
  readonly name = "tick"
  #interval: ReturnType<typeof setInterval> | null = null

  register(ctx: ClientContext, conn: import("@dripleaf/protocol").Connection): void {
    this.#interval = setInterval(() => {
      if (!ctx.loggedIn) return
      try {
        conn.write(new play.ServerboundClientTickEndPacket())
        tickPathfinder(ctx, conn)
      } catch (error) {
        console.error("tick error:", error)
      }
    }, 50)
    conn.on("end", () => {
      if (this.#interval) clearInterval(this.#interval)
      this.#interval = null
    })
  }
}
