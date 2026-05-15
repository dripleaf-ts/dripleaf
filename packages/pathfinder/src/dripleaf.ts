import type { World } from "@dripleaf/world"
import type { PhysicsWorld } from "@dripleaf/physics"

export function pathWorldFromDripleaf(world: World): PhysicsWorld {
  return { getBlock: (pos) => world.getBlock(pos) }
}
