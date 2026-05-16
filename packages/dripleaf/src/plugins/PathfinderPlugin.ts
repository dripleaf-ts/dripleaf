import { BlockPos } from "@dripleaf/core"
import { play } from "@dripleaf/protocol"
import { Pathfinder, feetBlockFromPosition } from "@dripleaf/pathfinder"
import { pathWorldFromDripleaf } from "@dripleaf/pathfinder/dripleaf"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class PathfinderPlugin implements ClientPlugin {
  readonly name = "pathfinder"

  register(_ctx: ClientContext, _conn: import("@dripleaf/protocol").Connection): void {}
}

export function goto(ctx: ClientContext, target: BlockPos): void {
  if (!ctx.world) throw new Error("No world")
  if (!ctx.pathfinder)
    ctx.pathfinder = new Pathfinder(pathWorldFromDripleaf(ctx.world))
  const result = ctx.pathfinder.goto(feetBlockFromPosition(ctx.position), target)
  ctx.emit("pathFound", result)
}

export function stopPathfinding(ctx: ClientContext): void {
  ctx.pathfinder?.stop()
  ctx.emit("pathStop")
}

export function tickPathfinder(ctx: ClientContext, conn: import("@dripleaf/protocol").Connection): boolean {
  if (!ctx.pathfinder || ctx.pathfinder.isDone()) return false
  const waypoint = ctx.pathfinder.nextWaypoint()
  if (!waypoint) return false

  const dx = waypoint.x + 0.5 - ctx.position.x
  const dy = waypoint.y - ctx.position.y
  const dz = waypoint.z + 0.5 - ctx.position.z
  const horizontal = Math.hypot(dx, dz)

  if (horizontal < 0.25 && Math.abs(dy) < 0.5) {
    ctx.pathfinder.advance()
    return true
  }

  const yaw = (-Math.atan2(dx, dz) * 180) / Math.PI
  const speed = 0.25
  const nx = ctx.position.x + (dx / (horizontal || 1)) * speed
  const nz = ctx.position.z + (dz / (horizontal || 1)) * speed
  const ny = ctx.position.y + Math.sign(dy) * Math.min(0.25, Math.abs(dy))

  conn.write(new play.ServerboundMovePlayerPosPacket(nx, ny, nz, ctx.onGround, false))
  ctx.position.x = nx
  ctx.position.y = ny
  ctx.position.z = nz
  ctx.yaw = yaw
  return true
}
