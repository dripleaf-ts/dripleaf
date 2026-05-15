import { describe, expect, test } from "bun:test"
import { BlockPos } from "@dripleaf/core"
import { ChunkData, ChunkSection, createSingletonPalette } from "../src/index"

describe("ChunkData", () => {
  test("stores block states in sections", () => {
    const chunk = new ChunkData(0, 0)
    chunk.setBlock(new BlockPos(1, 64, 2), 5)
    expect(chunk.getBlock(new BlockPos(1, 64, 2))).toBe(5)
  })

  test("reads singleton biome palette", () => {
    const section = new ChunkSection(0)
    section.biomePalette = createSingletonPalette(7)
    section.biomes = new Uint8Array(0)
    expect(section.getBiome(0, 0, 0)).toBe(7)
  })
})
