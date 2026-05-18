import { BlockPos } from "@dripleaf/core"
import { BlockFace, Connection, InteractionHand, play } from "@dripleaf/protocol"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class MiningPlugin implements ClientPlugin {
  readonly name = "mining"

  register(ctx: ClientContext, _conn: Connection): void {}
}

export function startMining(
  ctx: ClientContext,
  conn: Connection,
  x: number,
  y: number,
  z: number,
  face: BlockFace = BlockFace.Up,
): void {
  const pos = new BlockPos(x, y, z)
  if (ctx.mining) {
    conn.write(new play.ServerboundPlayerActionPacket(
      play.PlayerAction.AbortDestroyBlock,
      ctx.mining.pos,
      ctx.mining.face,
      0,
    ))
  }
  ctx.mining = { pos, face }
  conn.write(new play.ServerboundPlayerActionPacket(
    play.PlayerAction.StartDestroyBlock,
    pos,
    face,
    ctx.sequence++,
  ))
  conn.write(new play.ServerboundSwingPacket(InteractionHand.MainHand))
}

export function finishMining(ctx: ClientContext, conn: Connection): void {
  if (!ctx.mining) return
  conn.write(new play.ServerboundPlayerActionPacket(
    play.PlayerAction.StopDestroyBlock,
    ctx.mining.pos,
    ctx.mining.face,
    ctx.sequence++,
  ))
  ctx.mining = null
}

export function stopMining(ctx: ClientContext, conn: Connection): void {
  if (!ctx.mining) return
  conn.write(new play.ServerboundPlayerActionPacket(
    play.PlayerAction.AbortDestroyBlock,
    ctx.mining.pos,
    ctx.mining.face,
    0,
  ))
  ctx.mining = null
}
