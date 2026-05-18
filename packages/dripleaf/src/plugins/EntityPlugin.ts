import { Connection, PacketReader, play } from "@dripleaf/protocol"
import { EntityData, Vec3, decodeMetadata } from "@dripleaf/entity"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class EntityPlugin implements ClientPlugin {
  readonly name = "entity"

  register(ctx: ClientContext, conn: Connection): void {
    conn.onPacket(play.ClientboundAddEntityPacket, (packet) => {
      const entity = new EntityData(
        packet.entityId,
        packet.entityUuid,
        packet.type,
        new Vec3(packet.x, packet.y, packet.z),
        packet.yaw,
        packet.pitch,
        packet.headYaw,
        packet.movement,
        new Map(),
      )
      ctx.entities.set(entity.id, entity)
      ctx.world?.addEntity(entity)
      ctx.emit("entitySpawn", entity)
    })

    conn.onPacket(play.ClientboundRemoveEntitiesPacket, (packet) => {
      for (const id of packet.entityIds) {
        ctx.entities.delete(id)
        ctx.world?.removeEntity(id)
        ctx.emit("entityDespawn", id)
      }
    })

    conn.onPacket(play.ClientboundSetEntityDataPacket, (packet) => {
      const entity = ctx.entities.get(packet.entityId)
      if (!entity) return
      const newMetadata = decodeMetadata(new PacketReader(packet.packedItems))
      for (const [key, value] of newMetadata) {
        entity.metadata.set(key, value)
      }
    })

    conn.onPacket(play.ClientboundMoveEntityPosPacket, (packet) => {
      const entity = ctx.entities.get(packet.entityId)
      if (!entity) return
      entity.position.x += packet.deltaX / 4096
      entity.position.y += packet.deltaY / 4096
      entity.position.z += packet.deltaZ / 4096
    })

    conn.onPacket(play.ClientboundMoveEntityPosRotPacket, (packet) => {
      const entity = ctx.entities.get(packet.entityId)
      if (!entity) return
      entity.position.x += packet.deltaX / 4096
      entity.position.y += packet.deltaY / 4096
      entity.position.z += packet.deltaZ / 4096
      entity.yaw = packet.yaw
      entity.pitch = packet.pitch
    })

    conn.onPacket(play.ClientboundMoveEntityRotPacket, (packet) => {
      const entity = ctx.entities.get(packet.entityId)
      if (!entity) return
      entity.yaw = packet.yaw
      entity.pitch = packet.pitch
    })

    conn.onPacket(play.ClientboundTeleportEntityPacket, (packet) => {
      const entity = ctx.entities.get(packet.id)
      if (!entity) return
      const change = packet.change
      const rel = packet.relatives
      if (rel.x) entity.position.x += change.position.x
      else entity.position.x = change.position.x
      if (rel.y) entity.position.y += change.position.y
      else entity.position.y = change.position.y
      if (rel.z) entity.position.z += change.position.z
      else entity.position.z = change.position.z
      if (rel.yRot) entity.yaw += change.yaw
      else entity.yaw = change.yaw
      if (rel.xRot) entity.pitch += change.pitch
      else entity.pitch = change.pitch
    })

    conn.onPacket(play.ClientboundRotateHeadPacket, (packet) => {
      const entity = ctx.entities.get(packet.entityId)
      if (!entity) return
      entity.headYaw = packet.headYaw
    })

    conn.onPacket(play.ClientboundAnimatePacket, (packet) => {
      ctx.emit("entityAnimate", packet.entityId, packet.animation)
    })
  }
}
