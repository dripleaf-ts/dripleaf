import { connect } from "node:net"
import { Connection, State, ClientIntention } from "@dripleaf/protocol"
import { handshake, status } from "@dripleaf/protocol"

const host = process.argv[2] ?? "localhost"
const port = parseInt(process.argv[3] ?? "25565", 10)

const socket = connect(port, host, () => {
  const conn = new Connection(socket, false)

  conn.onPacket(status.ClientboundStatusResponsePacket, (packet) => {
    console.log("server info:", JSON.stringify(packet, null, 2))
    conn.write(new status.ServerboundPingRequestPacket(BigInt(Date.now())))
  })

  conn.onPacket(status.ClientboundPongResponsePacket, () => {
    console.log("pong!")
    conn.disconnect()
  })

  conn.on("error", (err) => console.error("error:", err))

  conn.write(new handshake.ServerboundIntentionPacket(775, host, port, ClientIntention.Status))
  conn.setState(State.Status)
  conn.write(new status.ServerboundStatusRequestPacket())
})
