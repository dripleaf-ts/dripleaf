import { describe, expect, test } from "bun:test"
import { BlockType } from "@dripleaf/registry"
import { BlockPos } from "@dripleaf/core"
import type { BlockLike, PhysicsWorld } from "@dripleaf/physics"
import { findPath, blockPosGoal } from "../src/index"

function mockWorld(blocks: Map<string, BlockLike>): PhysicsWorld {
  return {
    getBlock(pos: BlockPos) {
      return blocks.get(`${pos.x},${pos.y},${pos.z}`)
    },
  }
}

const stone: BlockLike = { type: BlockType.Stone, properties: {} }
const air: BlockLike = { type: BlockType.Air, properties: {} }

describe("findPath", () => {
  test("finds path on flat ground", () => {
    const blocks = new Map<string, BlockLike>()
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        blocks.set(`${x},0,${z}`, stone)
        blocks.set(`${x},1,${z}`, air)
        blocks.set(`${x},2,${z}`, air)
      }
    }
    const world = mockWorld(blocks)
    const result = findPath(new BlockPos(0, 1, 0), blockPosGoal(new BlockPos(4, 1, 4)), world)
    expect(result.partial).toBe(false)
    expect(result.nodes.length).toBeGreaterThan(1)
    expect(result.nodes[result.nodes.length - 1]).toEqual(new BlockPos(4, 1, 4))
  })
})
