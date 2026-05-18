import { Connection, play } from "@dripleaf/protocol"
import { BlockPos } from "@dripleaf/core"
import { applyLevelChunk } from "@dripleaf/world"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class WorldPlugin implements ClientPlugin {
  readonly name = "world"

  register(ctx: ClientContext, conn: Connection): void {
    conn.onPacket(play.ClientboundChunkBatchStartPacket, () => {
      ctx.chunkBatchSize = 0
    })

    conn.onPacket(play.ClientboundChunkBatchFinishedPacket, (packet) => {
      ctx.chunkBatchSize = packet.batchSize
      conn.write(new play.ServerboundChunkBatchReceivedPacket(20))
    })

    conn.onPacket(play.ClientboundLevelChunkWithLightPacket, (packet) => {
      if (!ctx.world) return
      try {
        applyLevelChunk(ctx.world.chunks, packet.x, packet.z, packet.chunkData.data, undefined, packet.chunkData.heightmaps)
        ctx.world.cache.invalidateChunk(packet.x, packet.z)
        ctx.world.cache.invalidateSection(packet.x, packet.z)
      } catch (e) {
        console.error("failed to apply chunk:", e)
      }
    })

    conn.onPacket(play.ClientboundBlockUpdatePacket, (packet) => {
      if (!ctx.world) return
      try {
        const p = packet.position
        ctx.world.setBlock(new BlockPos(p.x, p.y, p.z), packet.blockState)
      } catch (e) {
        console.error("failed to apply block update:", e)
      }
    })

    conn.onPacket(play.ClientboundSectionBlocksUpdatePacket, (packet) => {
      if (!ctx.world) return
      try {
        for (const change of packet.blocks) {
          const localX = change.position & 0xf
          const localY = (change.position >> 8) & 0xf
          const localZ = (change.position >> 4) & 0xf
          const x = packet.sectionX * 16 + localX
          const y = packet.sectionY * 16 + localY
          const z = packet.sectionZ * 16 + localZ
          ctx.world.setBlock(new BlockPos(x, y, z), change.blockStateId)
        }
      } catch (e) {
        console.error("failed to apply section blocks update:", e)
      }
    })

    conn.onPacket(play.ClientboundForgetLevelChunkPacket, (packet) => {
      ctx.world?.forgetChunk(packet.chunkPos.x, packet.chunkPos.z)
    })

    conn.onPacket(play.ClientboundRespawnPacket, (packet) => {
      if (!ctx.world) return
      ctx.world.dimension = {
        type: packet.commonPlayerSpawnInfo.dimensionType,
        identifier: packet.commonPlayerSpawnInfo.dimension.toString(),
      }
      ctx.world.clear()
    })
  }
}
