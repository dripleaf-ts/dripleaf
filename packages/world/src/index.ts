import { BlockPos, ChunkPos } from "@dripleaf/core"
import { type BlockData, stateToBlock } from "@dripleaf/block"
import type { EntityData } from "@dripleaf/entity"
import { ChunkData, chunkKey } from "@dripleaf/chunk"
import { DimensionType, DimensionTypeRegistry, WorldgenBiome, WorldgenBiomeRegistry } from "@dripleaf/registry"

export {
  ChunkData,
  ChunkSection,
  SECTION_COUNT,
  SECTION_SIZE,
  BIOME_COUNT,
  MIN_SECTION_Y,
  applyLevelChunk,
  chunkKey,
  compactData,
  createBiomePalette,
  createLinearPalette,
  createSingletonPalette,
  indexToPos,
  parseChunkSections,
  posToIndex,
  swappedLongs,
  uncompactData,
  type Palette,
  type PaletteType,
} from "@dripleaf/chunk"
export { DimensionType, DimensionTypeRegistry, WorldgenBiome, WorldgenBiomeRegistry }

export type Dimension = {
  type: DimensionType
  identifier: string
}

export type FindBlocksOptions = {
  min?: BlockPos
  max?: BlockPos
  limit?: number
}

export class World {
  dimension: Dimension
  chunks: Map<number, ChunkData>
  entities: Map<number, EntityData>

  constructor(dimension: Dimension) {
    this.dimension = dimension
    this.chunks = new Map()
    this.entities = new Map()
  }

  getBlock(pos: BlockPos): BlockData | undefined {
    const chunk = this.getChunkForBlock(pos)
    if (!chunk) return undefined
    const state = chunk.getBlock(pos)
    if (state === undefined) return undefined
    return stateToBlock(state)
  }

  getBlockState(pos: BlockPos): number | undefined {
    return this.getChunkForBlock(pos)?.getBlock(pos)
  }

  setBlock(pos: BlockPos, state: number): void {
    const chunkX = Math.floor(pos.x / 16)
    const chunkZ = Math.floor(pos.z / 16)
    const key = chunkKey(chunkX, chunkZ)
    let chunk = this.chunks.get(key)
    if (!chunk) {
      chunk = new ChunkData(chunkX, chunkZ)
      this.chunks.set(key, chunk)
    }
    chunk.setBlock(pos, state)
  }

  addEntity(entity: EntityData): void {
    this.entities.set(entity.id, entity)
  }

  removeEntity(id: number): void {
    this.entities.delete(id)
  }

  getChunk(pos: ChunkPos): ChunkData | undefined {
    return this.chunks.get(chunkKey(pos.x, pos.z))
  }

  getChunkForBlock(pos: BlockPos): ChunkData | undefined {
    const chunkX = Math.floor(pos.x / 16)
    const chunkZ = Math.floor(pos.z / 16)
    return this.chunks.get(chunkKey(chunkX, chunkZ))
  }

  getBiome(pos: BlockPos): number | undefined {
    return this.getChunkForBlock(pos)?.getBiome(pos)
  }

  forgetChunk(x: number, z: number): void {
    this.chunks.delete(chunkKey(x, z))
  }

  findBlocks(predicate: (state: number, pos: BlockPos) => boolean, options: FindBlocksOptions = {}): BlockPos[] {
    const result: BlockPos[] = []
    const limit = options.limit ?? Number.POSITIVE_INFINITY
    const min = options.min
    const max = options.max

    for (const chunk of this.chunks.values()) {
      const baseX = chunk.x * 16
      const baseZ = chunk.z * 16
      for (const section of chunk.sections) {
        if (!section) continue
        const baseY = section.y * 16
        for (let y = 0; y < 16; y++) {
          const worldY = baseY + y
          if ((min && worldY < min.y) || (max && worldY > max.y)) continue
          for (let z = 0; z < 16; z++) {
            const worldZ = baseZ + z
            if ((min && worldZ < min.z) || (max && worldZ > max.z)) continue
            for (let x = 0; x < 16; x++) {
              const worldX = baseX + x
              if ((min && worldX < min.x) || (max && worldX > max.x)) continue
              const pos = new BlockPos(worldX, worldY, worldZ)
              const state = section.getBlock(x, y, z)
              if (!predicate(state, pos)) continue
              result.push(pos)
              if (result.length >= limit) return result
            }
          }
        }
      }
    }

    return result
  }
}

export class CachedWorld {
  readonly #source: { getBlock(pos: BlockPos): BlockData | undefined }
  readonly #blocks = new Map<string, BlockData | undefined>()

  constructor(source: { getBlock(pos: BlockPos): BlockData | undefined }) {
    this.#source = source
  }

  getBlock(pos: BlockPos): BlockData | undefined {
    const key = `${pos.x},${pos.y},${pos.z}`
    if (!this.#blocks.has(key))
      this.#blocks.set(key, this.#source.getBlock(pos))
    return this.#blocks.get(key)
  }

  invalidate(pos?: BlockPos): void {
    if (!pos) {
      this.#blocks.clear()
      return
    }
    this.#blocks.delete(`${pos.x},${pos.y},${pos.z}`)
  }
}
