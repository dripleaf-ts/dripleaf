import { BlockPos, ChunkPos } from "@dripleaf/core"
import { DimensionType, DimensionTypeRegistry, WorldgenBiome, WorldgenBiomeRegistry } from "@dripleaf/registry"

export { DimensionType, DimensionTypeRegistry, WorldgenBiome, WorldgenBiomeRegistry }

export type Dimension = {
  type: DimensionType
  identifier: string
}

export type ChunkSectionData = {
  blockCount: number
  palette: number[]
  blockStates: Uint8Array
}

export type ChunkData = {
  pos: ChunkPos
  sections: (ChunkSectionData | null)[]
  biomes: Uint8Array
  heightmaps: Record<string, bigint[]>
}

export type World = {
  dimension: Dimension
  chunks: Map<number, ChunkData>
  getBlock(pos: BlockPos): number | undefined
  setBlock(pos: BlockPos, state: number): void
}

export function createWorld(dimension: Dimension): World {
  const chunks = new Map<number, ChunkData>()

  function chunkKey(pos: ChunkPos): number {
    return (pos.x * 31 + pos.z) | 0
  }

  return {
    dimension,
    chunks,
    getBlock(pos: BlockPos) {
      const cx = pos.x >> 4
      const cz = pos.z >> 4
      const chunk = chunks.get(chunkKey(new ChunkPos(cx, cz)))
      if (!chunk) return undefined
      return 0
    },
    setBlock(pos: BlockPos, state: number) {
    },
  }
}
