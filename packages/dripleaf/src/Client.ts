import { EventEmitter } from "node:events"
import { connect as tcpConnect } from "node:net"
import { randomUUID } from "node:crypto"
import type { UUID } from "node:crypto"
import { resolveSrv } from "node:dns"
import { Connection, State, ClientIntention, ChatVisibility, HumanoidArm, ParticleStatus } from "@dripleaf/protocol"
import { handshake, login, play, configuration } from "@dripleaf/protocol"
import type { GameProfile } from "@dripleaf/core"

type ClientEvents = {
  spawn: (packet: any) => void
  chat: (message: string, sender: string | null) => void
  disconnect: (reason: string) => void
  error: (error: Error) => void
  end: () => void
  packet: (packet: any) => void
  state: (state: State) => void
}

export class Client {
  private emitter: EventEmitter
  connection: Connection | null = null
  username: string
  profile: GameProfile | null = null
  loggedIn = false

  constructor(username: string) {
    this.emitter = new EventEmitter()
    this.username = username
  }

  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return this
  }

  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
    return this
  }

  private srvHost: string | null = null

  async connect(host: string, port = 25565): Promise<void> {
    const resolved = await this.resolveSrv(host, port)
    return new Promise((resolve, reject) => {
      const socket = tcpConnect(resolved.port, resolved.host, () => {
        this.connection = new Connection(socket, false)
        this.setupHandlers()
        this.startLogin(host, resolved.port)
        resolve()
      })
      socket.on("error", reject)
      socket.setTimeout(10000)
    })
  }

  private isIpAddress(host: string): boolean {
    const ipv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
    const ipv6 = /^\[?([0-9a-fA-F:]+)\]?$/
    return ipv4.test(host) || ipv6.test(host)
  }

  private resolveSrv(host: string, port: number): Promise<{ host: string; port: number }> {
    if (this.isIpAddress(host) || port !== 25565)
      return Promise.resolve({ host, port })

    return new Promise((resolve) => {
      resolveSrv(`_minecraft._tcp.${host}`, (err, records) => {
        if (err || !records || records.length === 0) {
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
    this.connection.write(new play.ServerboundChatPacket(
      message,
      { seconds: 0n, nanos: 0 },
      0n,
      null,
      { offset: 0, acknowledged: new Uint8Array(20) },
    ))
  }

  disconnect(): void {
    this.connection?.disconnect()
  }

  private emit(event: string, ...args: unknown[]) {
    this.emitter.emit(event, ...args)
  }

  private setupHandlers() {
    const conn = this.connection!

    conn.on("packet", (packet: any) => this.emit("packet", packet))
    conn.on("state", (state: State) => this.emit("state", state))
    conn.on("error", (error: Error) => this.emit("error", error))
    conn.on("end", () => this.emit("end"))

    conn.onPacket(login.ClientboundLoginFinishedPacket, (packet: any) => {
      this.profile = packet.profile
      conn.setState(State.Configuration)
      conn.write(new login.ServerboundLoginAcknowledgedPacket())
    })

    conn.onPacket(login.ClientboundLoginCompressionPacket, (packet: any) => {
      conn.setCompressionThreshold(packet.threshold)
    })

    conn.onPacket(login.ClientboundLoginDisconnectPacket, (packet: any) => {
      this.emit("disconnect", JSON.stringify(packet.reason))
    })

    conn.onPacket(configuration.ClientboundFinishConfigurationPacket, () => {
      conn.write(new configuration.ServerboundFinishConfigurationPacket())
      conn.setState(State.Play)
      conn.write(new configuration.ServerboundClientInformationPacket(
        "en_us", 24, ChatVisibility.Full, true, 0,
        HumanoidArm.Right, false, true, ParticleStatus.All,
      ))
    })

    conn.onPacket(play.ClientboundLoginPacket, (packet: any) => {
      this.loggedIn = true
      this.emit("spawn", packet)
    })

    conn.onPacket(play.ClientboundSystemChatPacket, (packet: any) => {
      const text = typeof packet.content === "string" ? packet.content : JSON.stringify(packet.content)
      this.emit("chat", text, null)
    })
  }

  private startLogin(host: string, port: number) {
    const conn = this.connection!
    conn.write(new handshake.ServerboundIntentionPacket(775, host, port, ClientIntention.Login))
    conn.setState(State.Login)
    conn.write(new login.ServerboundHelloPacket(this.username, randomUUID() as UUID))
  }
}
