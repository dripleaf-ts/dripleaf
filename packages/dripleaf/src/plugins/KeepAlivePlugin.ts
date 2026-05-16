import { State, configuration, play } from "@dripleaf/protocol"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class KeepAlivePlugin implements ClientPlugin {
  readonly name = "keepAlive"

  register(ctx: ClientContext, conn: import("@dripleaf/protocol").Connection): void {
    conn.onPacket(configuration.ClientboundKeepAlivePacket, (packet) => {
      if (conn.state === State.Configuration)
        conn.write(new configuration.ServerboundKeepAlivePacket(packet.keepAliveId))
    })

    conn.onPacket(play.ClientboundKeepAlivePacket, (packet) => {
      conn.write(new play.ServerboundKeepAlivePacket(packet.keepAliveId))
    })
  }
}
