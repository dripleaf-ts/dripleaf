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
      ctx.isDead = false
      const dim: Dimension = {
        type: packet.commonPlayerSpawnInfo.dimensionType,
        identifier: packet.commonPlayerSpawnInfo.dimension.toString(),
      }
      ctx.world = new World(dim)
      ctx.pathfinder = new Pathfinder(pathWorldFromDripleaf(ctx.world))
      ctx.gameMode = packet.commonPlayerSpawnInfo.gameType
      ctx.position.x = 0
      ctx.position.y = 0
      ctx.position.z = 0
      ctx.velocity.x = 0
      ctx.velocity.y = 0
      ctx.velocity.z = 0
      conn.write(new play.ServerboundPlayerLoadedPacket())
      ctx.emit("spawn", packet)
    })

    conn.onPacket(play.ClientboundRespawnPacket, (packet) => {
      ctx.isDead = false
      const dim: Dimension = {
        type: packet.commonPlayerSpawnInfo.dimensionType,
        identifier: packet.commonPlayerSpawnInfo.dimension.toString(),
      }
      ctx.world = new World(dim)
      ctx.pathfinder = new Pathfinder(pathWorldFromDripleaf(ctx.world))
      ctx.previousGameMode = ctx.gameMode
      ctx.gameMode = packet.commonPlayerSpawnInfo.gameType
      ctx.position.x = 0
      ctx.position.y = 0
      ctx.position.z = 0
      ctx.velocity.x = 0
      ctx.velocity.y = 0
      ctx.velocity.z = 0
      ctx.emit("gameModeChanged", ctx.gameMode, ctx.previousGameMode)
      ctx.emit("respawn", packet)
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
      if (packet.health <= 0 && !ctx.isDead) {
        ctx.isDead = true
        ctx.emit("death")
      }
      ctx.emit("health", packet.health, packet.food, packet.saturation)
    })

    conn.onPacket(play.ClientboundSetExperiencePacket, (packet) => {
      ctx.experienceLevel = packet.experienceLevel
      ctx.experienceProgress = packet.experienceProgress
      ctx.totalExperience = packet.totalExperience
      ctx.emit("experience", packet.experienceLevel, packet.experienceProgress, packet.totalExperience)
    })

    conn.onPacket(play.ClientboundPlayerAbilitiesPacket, (packet) => {
      ctx.invulnerable = packet.abilities.invulnerable
      ctx.isFlying = packet.abilities.isFlying
      ctx.flyingSpeed = packet.abilities.flyingSpeed
      ctx.walkingSpeed = packet.abilities.walkingSpeed
      ctx.instantBreak = packet.abilities.instabuild
      ctx.emit("abilitiesChanged")
    })

    conn.onPacket(play.ClientboundSetEntityMotionPacket, (packet) => {
      if (packet.entityId === ctx.entityId) {
        ctx.velocity.x = packet.movement.x
        ctx.velocity.y = packet.movement.y
        ctx.velocity.z = packet.movement.z
        ctx.emit("velocity", ctx.velocity)
      }
    })

    conn.onPacket(play.ClientboundExplodePacket, (packet) => {
      if (packet.playerKnockback) {
        ctx.velocity.x += packet.playerKnockback.x
        ctx.velocity.y += packet.playerKnockback.y
        ctx.velocity.z += packet.playerKnockback.z
        ctx.emit("velocity", ctx.velocity)
      }
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
      if (!(rel & play.Relative.X) && !(rel & play.Relative.Y) && !(rel & play.Relative.Z)) {
        ctx.velocity.x = 0
        ctx.velocity.y = 0
        ctx.velocity.z = 0
      }
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

    conn.onPacket(play.ClientboundSetObjectivePacket, (packet) => {
      ctx.emit("scoreboardObjective", packet.method, packet.objectiveName, packet.displayName)
    })

    conn.onPacket(play.ClientboundSetScorePacket, (packet) => {
      ctx.emit("scoreboardScore", packet.objectiveName, packet.owner, packet.score)
    })

    conn.onPacket(play.ClientboundSetDisplayObjectivePacket, (packet) => {
      ctx.emit("scoreboardDisplay", packet.displaySlot, packet.objectiveName)
    })

    conn.onPacket(play.ClientboundBossEventPacket, (packet) => {
      const title = "title" in packet.operation ? packet.operation.title : null
      const health = "health" in packet.operation ? packet.operation.health : 0
      ctx.emit("bossBar", packet.action, packet.uuid, title, health)
    })

    conn.onPacket(play.ClientboundSetTitleTextPacket, (packet) => {
      ctx.emit("title", "title", packet.text, 0, 0, 0)
    })

    conn.onPacket(play.ClientboundSetSubtitleTextPacket, (packet) => {
      ctx.emit("title", "subtitle", packet.text, 0, 0, 0)
    })

    conn.onPacket(play.ClientboundSetTitlesAnimationPacket, (packet) => {
      ctx.emit("title", "times", null, packet.fadeIn, packet.stay, packet.fadeOut)
    })

    conn.onPacket(play.ClientboundClearTitlesPacket, (packet) => {
      ctx.emit("title", "clear", null, 0, 0, 0)
    })

    conn.onPacket(play.ClientboundSetActionBarTextPacket, (packet) => {
      ctx.emit("title", "actionbar", packet.text, 0, 0, 0)
    })

    conn.onPacket(play.ClientboundCommandSuggestionsPacket, (packet) => {
      ctx.emit("tabComplete", packet.transactionId, packet.matches.map((m: any) => m.match))
    })

    conn.onPacket(play.ClientboundBlockDestructionPacket, (packet) => {
      ctx.emit("blockBreakProgress", packet.entityId, packet.position, packet.progress)
    })

    conn.onPacket(play.ClientboundGameEventPacket, (packet) => {
      if (packet.event === 3) {
        ctx.previousGameMode = ctx.gameMode
        ctx.gameMode = packet.value
        ctx.emit("gameModeChanged", ctx.gameMode, ctx.previousGameMode)
      }
    })

    conn.onPacket(play.ClientboundInitializeBorderPacket, (packet) => {
      ctx.worldBorder = {
        centerX: packet.x,
        centerZ: packet.z,
        diameter: packet.oldDiameter,
        targetDiameter: packet.newDiameter,
        speed: packet.speed,
        warningBlocks: packet.warningBlocks,
        warningTime: packet.warningTime,
      }
    })

    conn.onPacket(play.ClientboundSetBorderSizePacket, (packet) => {
      ctx.worldBorder.targetDiameter = packet.size
      ctx.worldBorder.diameter = packet.size
    })

    conn.onPacket(play.ClientboundSetBorderLerpSizePacket, (packet) => {
      ctx.worldBorder.targetDiameter = packet.newSize
      ctx.worldBorder.speed = Number(packet.lerpTime)
    })

    conn.onPacket(play.ClientboundSetBorderCenterPacket, (packet) => {
      ctx.worldBorder.centerX = packet.newCenterX
      ctx.worldBorder.centerZ = packet.newCenterZ
    })

    conn.onPacket(play.ClientboundSetBorderWarningDistancePacket, (packet) => {
      ctx.worldBorder.warningBlocks = packet.warningBlocks
    })

    conn.onPacket(play.ClientboundSetBorderWarningDelayPacket, (packet) => {
      ctx.worldBorder.warningTime = packet.delay
    })
  }
}
