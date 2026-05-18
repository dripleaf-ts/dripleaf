import { Connection, DripleafPacket, State, configuration, play } from "@dripleaf/protocol"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

function safeWrite(conn: Connection, packet: DripleafPacket) {
  try {
    conn.write(packet)
  } catch (error) {
    console.error("keepalive write error:", error)
  }
}

export class KeepAlivePlugin implements ClientPlugin {
  readonly name = "keepAlive"

  register(ctx: ClientContext, conn: Connection): void {
    conn.onPacket(configuration.ClientboundKeepAlivePacket, (packet) => {
      if (conn.state === State.Configuration)
        safeWrite(conn, new configuration.ServerboundKeepAlivePacket(packet.keepAliveId))
    })

    conn.onPacket(configuration.ClientboundPingPacket, (packet) => {
      safeWrite(conn, new configuration.ServerboundPongPacket(packet.pingId))
    })

    conn.onPacket(play.ClientboundKeepAlivePacket, (packet) => {
      safeWrite(conn, new play.ServerboundKeepAlivePacket(packet.keepAliveId))
    })

    conn.onPacket(play.ClientboundPingPacket, (packet) => {
      safeWrite(conn, new play.ServerboundPongPacket(packet.id))
    })
  }
}
