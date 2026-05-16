import { play } from "@dripleaf/protocol"
import { World, type Dimension } from "@dripleaf/world"
import { Pathfinder } from "@dripleaf/pathfinder"
import { pathWorldFromDripleaf } from "@dripleaf/pathfinder/dripleaf"
import { toPlainText } from "@dripleaf/chat"
import type { ChatComponent } from "@dripleaf/chat"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class PlayPlugin implements ClientPlugin {
  readonly name = "play"

  register(ctx: ClientContext, conn: import("@dripleaf/protocol").Connection): void {
    conn.onPacket(play.ClientboundLoginPacket, (packet) => {
      ctx.entityId = packet.entityId
      ctx.loggedIn = true
      const dim: Dimension = {
        type: packet.commonPlayerSpawnInfo.dimensionType,
        identifier: packet.commonPlayerSpawnInfo.dimension.toString(),
      }
      ctx.world = new World(dim)
      ctx.pathfinder = new Pathfinder(pathWorldFromDripleaf(ctx.world))
      conn.write(new play.ServerboundPlayerLoadedPacket())
      ctx.emit("spawn", packet)
    })

    conn.onPacket(play.ClientboundDisconnectPacket, (packet) => {
      ctx.emit("disconnect", toPlainText(packet.reason))
      conn.disconnect()
    })

    conn.onPacket(play.ClientboundSystemChatPacket, (packet) => {
      ctx.emit("chat", packet.content, null)
    })

    conn.onPacket(play.ClientboundPlayerChatPacket, (packet) => {
      const message = packet.unsignedContent ?? { text: packet.body.content }
      ctx.emit("chat", message, packet.chatType.name)
    })

    conn.onPacket(play.ClientboundDisguisedChatPacket, (packet) => {
      ctx.emit("chat", packet.message, packet.chatType.name)
    })

    conn.onPacket(play.ClientboundSetHealthPacket, (packet) => {
      ctx.health = packet.health
      ctx.food = packet.food
      ctx.saturation = packet.saturation
      ctx.emit("health", packet.health, packet.food, packet.saturation)
    })

    conn.onPacket(play.ClientboundPlayerPositionPacket, (packet) => {
      const rel = packet.relatives
      const pos = packet.change.position
      if (rel & play.Relative.X) ctx.position.x += pos.x
      else ctx.position.x = pos.x
      if (rel & play.Relative.Y) ctx.position.y += pos.y
      else ctx.position.y = pos.y
      if (rel & play.Relative.Z) ctx.position.z += pos.z
      else ctx.position.z = pos.z
      if (rel & play.Relative.Yaw) ctx.yaw += packet.change.yaw
      else ctx.yaw = packet.change.yaw
      if (rel & play.Relative.Pitch) ctx.pitch += packet.change.pitch
      else ctx.pitch = packet.change.pitch
      conn.write(new play.ServerboundAcceptTeleportationPacket(packet.teleportId))
      ctx.emit("move")
    })

    conn.onPacket(play.ClientboundPlayerRotationPacket, (packet) => {
      if (packet.relativeYaw) ctx.yaw += packet.yaw
      else ctx.yaw = packet.yaw
      if (packet.relativePitch) ctx.pitch += packet.pitch
      else ctx.pitch = packet.pitch
      ctx.emit("move")
    })

    conn.onPacket(play.ClientboundEntityPositionSyncPacket, (packet) => {
      const entity = ctx.entities.get(packet.entityId)
      if (!entity) return
      entity.position.x = packet.values.position.x
      entity.position.y = packet.values.position.y
      entity.position.z = packet.values.position.z
      entity.yaw = packet.values.yaw
      entity.pitch = packet.values.pitch
    })
  }
}
