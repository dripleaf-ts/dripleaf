import type { BlockPos } from "@dripleaf/core"
import { PacketReader } from "@dripleaf/protocol"

export const SECTION_SIZE = 4096
export const BIOME_COUNT = 64
export const MIN_SECTION_Y = -4
export const SECTION_COUNT = 24

export type ChunkKey = `${number},${number}`

export interface ChunkDimensionConfig {
  minY: number
  height: number
  sectionCount: number
  minSectionY: number
}

export const OVERWORLD_CHUNK_CONFIG: ChunkDimensionConfig = {
  minY: MIN_SECTION_Y * 16,
  height: SECTION_COUNT * 16,
  sectionCount: SECTION_COUNT,
  minSectionY: MIN_SECTION_Y,
}

export type HeightmapType =
  | "WORLD_SURFACE"
  | "MOTION_BLOCKING"
  | "MOTION_BLOCKING_NO_LEAVES"
  | "OCEAN_FLOOR"

const HEIGHTMAP_TYPES: HeightmapType[] = [
  "WORLD_SURFACE",
  "MOTION_BLOCKING",
  "MOTION_BLOCKING_NO_LEAVES",
  "OCEAN_FLOOR",
]

export function chunkKey(x: number, z: number): ChunkKey {
  return `${x},${z}`
}

export function parseChunkKey(key: ChunkKey): { x: number; z: number } {
  const [x, z, extra] = key.split(",")
  if (x === undefined || z === undefined || extra !== undefined)
    throw new Error(`invalid chunk key: ${key}`)
  const parsedX = Number(x)
  const parsedZ = Number(z)
  if (!Number.isFinite(parsedX) || !Number.isFinite(parsedZ))
    throw new Error(`invalid chunk key: ${key}`)
  return { x: parsedX, z: parsedZ }
}

export function posToIndex(x: number, y: number, z: number): number {
  return (y << 8) | (z << 4) | x
}

export function indexToPos(index: number): { x: number; y: number; z: number } {
  return {
    x: index & 0xf,
    y: (index >> 8) & 0xf,
    z: (index >> 4) & 0xf,
  }
}

function readLong(buffer: Uint8Array, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 8; i++) {
    const byte = offset + i < buffer.length ? buffer[offset + i]! : 0
    value |= BigInt(byte) << BigInt(i * 8)
  }
  return value
}

function writeLong(buffer: Uint8Array, offset: number, value: bigint): void {
  for (let i = 0; i < 8; i++) {
    if (offset + i < buffer.length)
      buffer[offset + i] = Number((value >> BigInt(i * 8)) & 0xffn)
  }
}

function readEntry(buffer: Uint8Array, index: number, bitsPerEntry: number): number {
  if (bitsPerEntry <= 0) return 0
  const valuesPerLong = Math.floor(64 / bitsPerEntry)
  const longIndex = Math.floor(index / valuesPerLong)
  const bitOffset = (index % valuesPerLong) * bitsPerEntry
  const long = readLong(buffer, longIndex * 8)
  return Number((long >> BigInt(bitOffset)) & ((1n << BigInt(bitsPerEntry)) - 1n))
}

function writeEntry(buffer: Uint8Array, index: number, bitsPerEntry: number, value: number): void {
  if (bitsPerEntry <= 0) return
  const valuesPerLong = Math.floor(64 / bitsPerEntry)
  const longIndex = Math.floor(index / valuesPerLong)
  const bitOffset = (index % valuesPerLong) * bitsPerEntry
  const offset = longIndex * 8
  const long = readLong(buffer, offset)
  const mask = (1n << BigInt(bitsPerEntry)) - 1n
  const cleared = long & ~(mask << BigInt(bitOffset))
  const updated = cleared | ((BigInt(value) & mask) << BigInt(bitOffset))
  writeLong(buffer, offset, updated)
}

function neededLongs(bitsPerEntry: number, count: number): number {
  return Math.ceil(count * bitsPerEntry / 64)
}

export function compactData(data: Uint8Array, bitsPerEntry: number): Uint8Array {
  const count = data.length
  const longs = neededLongs(bitsPerEntry, count)
  const buffer = new Uint8Array(longs * 8)
  for (let i = 0; i < count; i++)
    writeEntry(buffer, i, bitsPerEntry, data[i]!)
  return buffer
}

export function uncompactData(data: Uint8Array, bitsPerEntry: number, count: number): number[] {
  const result: number[] = new Array(count)
  for (let i = 0; i < count; i++)
    result[i] = readEntry(data, i, bitsPerEntry)
  return result
}

export type PaletteType = "linear" | "singleton" | "biome"

export interface Palette {
  readonly type: PaletteType
  getState(index: number): number
  setState(index: number, value: number): void
  addState(value: number): number
  getIds(): number[]
  bitsPerEntry(): number
}

export function createLinearPalette(ids?: number[]): Palette {
  const data = ids ? [...ids] : []
  return {
    type: "linear",
    getState(index: number): number {
      return data[index]!
    },
    setState(index: number, value: number): void {
      data[index] = value
    },
    addState(value: number): number {
      const index = data.indexOf(value)
      if (index !== -1) return index
      data.push(value)
      return data.length - 1
    },
    getIds(): number[] {
      return [...data]
    },
    bitsPerEntry(): number {
      const size = data.length
      if (size <= 1) return 0
      return Math.max(4, Math.ceil(Math.log2(size)))
    },
  }
}

export function createSingletonPalette(value: number): Palette {
  return {
    type: "singleton",
    getState(_index: number): number {
      return value
    },
    setState(_index: number, v: number): void {
      value = v
    },
    addState(v: number): number {
      if (v === value) return 0
      throw new Error("cannot add state to singleton palette; convert to linear first")
    },
    getIds(): number[] {
      return [value]
    },
    bitsPerEntry(): number {
      return 0
    },
  }
}

export function createBiomePalette(ids?: number[]): Palette {
  const data = ids ? [...ids] : []
  return {
    type: "biome",
    getState(index: number): number {
      return data[index]!
    },
    setState(index: number, value: number): void {
      data[index] = value
    },
    addState(value: number): number {
      const index = data.indexOf(value)
      if (index !== -1) return index
      data.push(value)
      return data.length - 1
    },
    getIds(): number[] {
      return [...data]
    },
    bitsPerEntry(): number {
      const size = data.length
      if (size <= 1) return 0
      return Math.max(1, Math.ceil(Math.log2(size)))
    },
  }
}

export class ChunkSection {
  y: number
  blockCount: number
  states: Uint8Array
  palette: Palette
  biomes: Uint8Array
  biomePalette: Palette

  constructor(y: number) {
    this.y = y
    this.blockCount = 0
    this.palette = createSingletonPalette(0)
    this.states = new Uint8Array(0)
    this.biomePalette = createSingletonPalette(0)
    this.biomes = new Uint8Array(0)
  }

  getBlock(x: number, y: number, z: number): number {
    const index = posToIndex(x, y, z)
    if (this.palette.type === "singleton")
      return this.palette.getState(0)
    const paletteIndex = readEntry(this.states, index, this.palette.bitsPerEntry())
    return this.palette.getState(paletteIndex)
  }

  getBiome(x: number, y: number, z: number): number {
    const index = (y >> 2) * 16 + (z >> 2) * 4 + (x >> 2)
    if (this.biomePalette.type === "singleton")
      return this.biomePalette.getState(0)
    const paletteIndex = readEntry(this.biomes, index, this.biomePalette.bitsPerEntry())
    return this.biomePalette.getState(paletteIndex)
  }

  setBlock(x: number, y: number, z: number, state: number): void {
    const index = posToIndex(x, y, z)
    const oldState = this.getBlock(x, y, z)
    if (oldState === state) return

    const isAir = state === 0
    const wasAir = oldState === 0
    if (wasAir && !isAir) this.blockCount++
    else if (!wasAir && isAir) this.blockCount--

    if (this.palette.type === "singleton") {
      const oldValue = this.palette.getState(0)
      const newPalette = createLinearPalette([oldValue, state])
      const bpe = newPalette.bitsPerEntry()
      const longs = neededLongs(bpe, SECTION_SIZE)
      const buffer = new Uint8Array(longs * 8)
      for (let i = 0; i < SECTION_SIZE; i++)
        writeEntry(buffer, i, bpe, i === index ? 1 : 0)
      this.palette = newPalette
      this.states = buffer
      return
    }

    const oldBpe = this.palette.bitsPerEntry()
    const paletteIndex = this.palette.addState(state)
    const newBpe = this.palette.bitsPerEntry()

    if (newBpe > oldBpe) {
      const longs = neededLongs(newBpe, SECTION_SIZE)
      const buffer = new Uint8Array(longs * 8)
      for (let i = 0; i < SECTION_SIZE; i++) {
        const val = i === index ? paletteIndex : readEntry(this.states, i, oldBpe)
        writeEntry(buffer, i, newBpe, val)
      }
      this.states = buffer
    } else {
      writeEntry(this.states, index, newBpe, paletteIndex)
    }
  }
}

export class ChunkData {
  x: number
  z: number
  config: ChunkDimensionConfig
  sections: (ChunkSection | null)[]
  heightmaps: HeightmapSet

  constructor(x: number, z: number, config: ChunkDimensionConfig = OVERWORLD_CHUNK_CONFIG, heightmaps?: HeightmapSet) {
    this.x = x
    this.z = z
    this.config = config
    this.sections = new Array(config.sectionCount).fill(null)
    this.heightmaps = heightmaps ?? createHeightmapSet()
  }

  getBlock(pos: BlockPos): number | undefined {
    const sectionY = Math.floor(pos.y / 16)
    const sectionIndex = sectionY - this.config.minSectionY
    if (sectionIndex < 0 || sectionIndex >= this.sections.length)
      return undefined
    const section = this.sections[sectionIndex]
    if (!section) return undefined
    return section.getBlock(pos.x & 0xf, pos.y & 0xf, pos.z & 0xf)
  }

  getBiome(pos: BlockPos): number | undefined {
    const sectionY = Math.floor(pos.y / 16)
    const sectionIndex = sectionY - this.config.minSectionY
    if (sectionIndex < 0 || sectionIndex >= this.sections.length)
      return undefined
    const section = this.sections[sectionIndex]
    if (!section) return undefined
    return section.getBiome(pos.x & 0xf, pos.y & 0xf, pos.z & 0xf)
  }

  setBlock(pos: BlockPos, state: number): void {
    const sectionY = Math.floor(pos.y / 16)
    const sectionIndex = sectionY - this.config.minSectionY
    if (sectionIndex < 0 || sectionIndex >= this.sections.length)
      return
    const oldState = this.getBlock(pos) ?? 0
    let section = this.sections[sectionIndex]
    if (!section) {
      section = new ChunkSection(sectionY)
      this.sections[sectionIndex] = section
    }
    section.setBlock(pos.x & 0xf, pos.y & 0xf, pos.z & 0xf, state)
    this.updateHeightmaps(pos, oldState, state)
  }

  getHeight(type: HeightmapType, x: number, z: number): number | undefined {
    return this.heightmaps.get(type, x & 0xf, z & 0xf)
  }

  private updateHeightmaps(pos: BlockPos, oldState: number, state: number): void {
    if (oldState === state) return
    const localX = pos.x & 0xf
    const localZ = pos.z & 0xf
    for (const type of HEIGHTMAP_TYPES) {
      const current = this.heightmaps.get(type, localX, localZ)
      if (state !== 0 && (current === undefined || pos.y > current)) {
        this.heightmaps.set(type, localX, localZ, pos.y)
        continue
      }
      if (oldState !== 0 && state === 0 && current === pos.y) {
        const next = this.findHighestBlock(localX, localZ)
        if (next === undefined) this.heightmaps.delete(type, localX, localZ)
        else this.heightmaps.set(type, localX, localZ, next)
      }
    }
  }

  private findHighestBlock(localX: number, localZ: number): number | undefined {
    for (let sectionIndex = this.sections.length - 1; sectionIndex >= 0; sectionIndex--) {
      const section = this.sections[sectionIndex]
      if (!section || section.blockCount === 0) continue
      for (let localY = 15; localY >= 0; localY--) {
        if (section.getBlock(localX, localY, localZ) !== 0)
          return (section.y * 16) + localY
      }
    }
    return undefined
  }
}

export interface HeightmapSet {
  get(type: HeightmapType, x: number, z: number): number | undefined
  set(type: HeightmapType, x: number, z: number, y: number): void
  delete(type: HeightmapType, x: number, z: number): void
}

class MutableHeightmapSet implements HeightmapSet {
  readonly #maps = new Map<HeightmapType, Int32Array>()
  readonly #present = new Map<HeightmapType, Uint8Array>()

  constructor(entries?: Partial<Record<HeightmapType, ArrayLike<number>>>) {
    for (const [type, values] of Object.entries(entries ?? {}) as [HeightmapType, ArrayLike<number>][]) {
      const map = new Int32Array(256)
      const present = new Uint8Array(256)
      for (let i = 0; i < Math.min(256, values.length); i++) {
        map[i] = values[i]!
        present[i] = 1
      }
      this.#maps.set(type, map)
      this.#present.set(type, present)
    }
  }

  get(type: HeightmapType, x: number, z: number): number | undefined {
    const index = ((z & 0xf) << 4) | (x & 0xf)
    if (!this.#present.get(type)?.[index]) return undefined
    return this.#maps.get(type)?.[index]
  }

  set(type: HeightmapType, x: number, z: number, y: number): void {
    const index = ((z & 0xf) << 4) | (x & 0xf)
    let map = this.#maps.get(type)
    if (!map) {
      map = new Int32Array(256)
      this.#maps.set(type, map)
    }
    let present = this.#present.get(type)
    if (!present) {
      present = new Uint8Array(256)
      this.#present.set(type, present)
    }
    map[index] = y
    present[index] = 1
  }

  delete(type: HeightmapType, x: number, z: number): void {
    const index = ((z & 0xf) << 4) | (x & 0xf)
    const present = this.#present.get(type)
    if (present) present[index] = 0
  }
}

export function createHeightmapSet(entries?: Partial<Record<HeightmapType, ArrayLike<number>>>): HeightmapSet {
  return new MutableHeightmapSet(entries)
}

export type ChunkHeightmapEntry = {
  type: number | string
  data: bigint[] | number[]
}

function readHeightmapEntry(entry: ChunkHeightmapEntry): [HeightmapType, number[]] | undefined {
  const type = typeof entry.type === "string"
    ? entry.type
    : HEIGHTMAP_TYPES[entry.type]
  if (!type || !HEIGHTMAP_TYPES.includes(type as HeightmapType))
    return undefined
  const words = entry.data.map(BigInt)
  const values: number[] = []
  const bitsPerEntry = 9
  const mask = (1n << BigInt(bitsPerEntry)) - 1n
  for (let i = 0; i < 256; i++) {
    const bitIndex = i * bitsPerEntry
    const wordIndex = Math.floor(bitIndex / 64)
    const bitOffset = bitIndex % 64
    let value = (words[wordIndex] ?? 0n) >> BigInt(bitOffset)
    const spill = bitOffset + bitsPerEntry - 64
    if (spill > 0)
      value |= (words[wordIndex + 1] ?? 0n) << BigInt(bitsPerEntry - spill)
    values.push(Number(value & mask))
  }
  return [type as HeightmapType, values]
}

export function parseHeightmaps(entries: ChunkHeightmapEntry[] = []): HeightmapSet {
  const parsed: Partial<Record<HeightmapType, number[]>> = {}
  for (const entry of entries) {
    const heightmap = readHeightmapEntry(entry)
    if (heightmap) parsed[heightmap[0]] = heightmap[1]
  }
  return createHeightmapSet(parsed)
}

export function swappedLongs(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 8) {
    for (let j = 0; j < 8; j++)
      out[i + j] = bytes[i + 7 - j]!
  }
  return out
}

function createIdentityPalette(bpe: number): Palette {
  return {
    type: "linear",
    getState(index: number): number {
      return index
    },
    setState(_index: number, _value: number): void {},
    addState(value: number): number {
      return value
    },
    getIds(): number[] {
      return []
    },
    bitsPerEntry(): number {
      return bpe
    },
  }
}

export function parseChunkSections(data: Uint8Array, count = SECTION_COUNT, minSectionY = MIN_SECTION_Y): (ChunkSection | null)[] {
  const reader = new PacketReader(data)
  const sections: (ChunkSection | null)[] = []

  for (let i = 0; i < count; i++) {
    try {
      const section = new ChunkSection(minSectionY + i)

      if (reader.remaining <= 0) {
        sections.push(null)
        continue
      }

      section.blockCount = reader.readUnsignedShort()
      const bpe = reader.readUnsignedByte()

      if (bpe === 0) {
        const state = reader.readVarInt()
        section.palette = createSingletonPalette(state)
        section.states = new Uint8Array(0)
      } else if (bpe <= 8) {
        const paletteLen = reader.readVarInt()
        const ids: number[] = []
        for (let j = 0; j < paletteLen; j++) ids.push(reader.readVarInt())
        section.palette = createLinearPalette(ids)
        const dataLongs = reader.readVarInt()
        section.states = swappedLongs(reader.readBytes(dataLongs * 8))
      } else {
        const dataLongs = reader.readVarInt()
        section.palette = createIdentityPalette(bpe)
        section.states = swappedLongs(reader.readBytes(dataLongs * 8))
      }

      const biomeBits = reader.readUnsignedByte()

      if (biomeBits === 0) {
        section.biomePalette = createSingletonPalette(reader.readVarInt())
        section.biomes = new Uint8Array(0)
      } else {
        const paletteLen = reader.readVarInt()
        const ids: number[] = []
        for (let j = 0; j < paletteLen; j++) ids.push(reader.readVarInt())
        section.biomePalette = createBiomePalette(ids)
        const dataLongs = reader.readVarInt()
        section.biomes = swappedLongs(reader.readBytes(dataLongs * 8))
      }

      sections.push(section)
    } catch {
      sections.push(null)
    }
  }

  return sections
}

export function applyLevelChunk(
  chunks: Map<ChunkKey, ChunkData>,
  x: number,
  z: number,
  data: Uint8Array,
  config: ChunkDimensionConfig = OVERWORLD_CHUNK_CONFIG,
  heightmaps?: ChunkHeightmapEntry[],
): void {
  const key = chunkKey(x, z)
  let chunk = chunks.get(key)
  if (!chunk) {
    chunk = new ChunkData(x, z, config)
    chunks.set(key, chunk)
  }
  chunk.config = config
  if (chunk.sections.length !== config.sectionCount)
    chunk.sections = new Array(config.sectionCount).fill(null)
  chunk.heightmaps = parseHeightmaps(heightmaps)
  const sections = parseChunkSections(data, config.sectionCount, config.minSectionY)
  for (let i = 0; i < config.sectionCount; i++)
    chunk.sections[i] = sections[i]!
}
