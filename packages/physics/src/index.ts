import { BlockType } from "@dripleaf/registry"
import { BlockPos } from "@dripleaf/core"

export type BlockLike = {
  type: BlockType | string
  properties: Record<string, string | boolean | number>
}

export type BlockClassification = {
  passable: boolean
  solid: boolean
  standable: boolean
  water: boolean
}

export function classifyBlock(block: BlockLike | undefined): BlockClassification {
  if (!block) return { passable: false, solid: false, standable: false, water: false }

  const { type, properties: p } = block
  const typeName = String(type)

  if (type === BlockType.Air || typeName === "air")
    return { passable: true, solid: false, standable: false, water: false }

  const water = type === BlockType.Water || typeName === "water" || p.waterlogged === true
  const dangerous =
    type === BlockType.Lava ||
    typeName === "lava" ||
    type === BlockType.Fire ||
    type === BlockType.SoulFire ||
    type === BlockType.SweetBerryBush ||
    type === BlockType.PowderSnow

  const slab = p.type === "top" || p.type === "bottom" || p.type === "double"
  const stair = typeName.endsWith("_stairs")
  const fullCube = !slab && !stair && type !== BlockType.Snow && !typeName.includes("flower") && !typeName.includes("sign")

  const passable = !fullCube && !water && !dangerous
  const solid = (fullCube || p.type === "top" || p.type === "double") && type !== BlockType.MagmaBlock
  const standable = solid || slab || stair

  return { passable, solid, standable, water }
}

export type PhysicsWorld = {
  getBlock(pos: BlockPos): BlockLike | undefined
}

export function isPassableAt(world: PhysicsWorld, pos: BlockPos): boolean {
  const feet = classifyBlock(world.getBlock(pos))
  const head = classifyBlock(world.getBlock(new BlockPos(pos.x, pos.y + 1, pos.z)))
  return feet.passable && head.passable
}

export function isStandableAt(world: PhysicsWorld, pos: BlockPos): boolean {
  const below = classifyBlock(world.getBlock(new BlockPos(pos.x, pos.y - 1, pos.z)))
  return below.standable && isPassableAt(world, pos)
}
