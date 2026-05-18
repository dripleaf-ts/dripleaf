import { randomBytes, publicEncrypt, createPublicKey, constants, randomUUID } from "node:crypto"
import type { UUID } from "node:crypto"
import { State, ClientIntention, handshake, login, Connection } from "@dripleaf/protocol"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class ConnectionPlugin implements ClientPlugin {
  readonly name = "connection"

  register(ctx: ClientContext, conn: Connection): void {
    conn.on("packet", (packet: unknown) => ctx.emit("packet", packet))
    conn.on("state", (state: State) => ctx.emit("state", state))
    conn.on("error", (error: Error) => ctx.emit("error", error))
    conn.on("end", () => ctx.emit("end"))

    conn.onPacket(login.ClientboundLoginFinishedPacket, (packet) => {
      ctx.profile = packet.profile
      conn.setState(State.Configuration)
      conn.write(new login.ServerboundLoginAcknowledgedPacket())
    })

    conn.onPacket(login.ClientboundHelloPacket, (packet) => {
      const sharedSecret = randomBytes(16)
      const publicKey = createPublicKey({ key: Buffer.from(packet.publicKey), format: "der", type: "spki" })
      const encryptedSecret = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(sharedSecret))
      const encryptedToken = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(packet.verifyToken))
      conn.write(new login.ServerboundKeyPacket(encryptedSecret, encryptedToken))
      conn.enableEncryption(sharedSecret)
    })

    conn.onPacket(login.ClientboundLoginCompressionPacket, (packet) => {
      conn.setCompressionThreshold(packet.threshold)
    })

    conn.onPacket(login.ClientboundLoginDisconnectPacket, (packet) => {
      ctx.emit("disconnect", JSON.stringify(packet.reason))
    })
  }

  startLogin(conn: Connection, host: string, port: number, username: string): void {
    conn.write(new handshake.ServerboundIntentionPacket(775, host, port, ClientIntention.Login))
    conn.setState(State.Login)
    conn.write(new login.ServerboundHelloPacket(username, randomUUID() as UUID))
  }
}
