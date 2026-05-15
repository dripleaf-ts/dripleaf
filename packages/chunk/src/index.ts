import type { BlockPos } from "@dripleaf/core"
import { PacketReader } from "@dripleaf/protocol"

export const SECTION_SIZE = 4096
export const BIOME_COUNT = 64
export const MIN_SECTION_Y = -4
export const SECTION_COUNT = 24

export function chunkKey(x: number, z: number): number {
  return (x * 31 + z) | 0
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
  for (let i = 0; i < 8; i++)
    value |= BigInt(buffer[offset + i]!) << BigInt(i * 8)
  return value
}

function writeLong(buffer: Uint8Array, offset: number, value: bigint): void {
  for (let i = 0; i < 8; i++)
    buffer[offset + i] = Number((value >> BigInt(i * 8)) & 0xffn)
}

function readEntry(buffer: Uint8Array, index: number, bitsPerEntry: number): number {
  const valuesPerLong = Math.floor(64 / bitsPerEntry)
  const longIndex = Math.floor(index / valuesPerLong)
  const bitOffset = (index % valuesPerLong) * bitsPerEntry
  const long = readLong(buffer, longIndex * 8)
  return Number((long >> BigInt(bitOffset)) & ((1n << BigInt(bitsPerEntry)) - 1n))
}

function writeEntry(buffer: Uint8Array, index: number, bitsPerEntry: number, value: number): void {
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
  sections: (ChunkSection | null)[]
  heightmaps: Record<string, Uint8Array>

  constructor(x: number, z: number) {
    this.x = x
    this.z = z
    this.sections = new Array(SECTION_COUNT).fill(null)
    this.heightmaps = {}
  }

  getBlock(pos: BlockPos): number | undefined {
    const sectionY = Math.floor(pos.y / 16)
    const sectionIndex = sectionY - MIN_SECTION_Y
    if (sectionIndex < 0 || sectionIndex >= this.sections.length)
      return undefined
    const section = this.sections[sectionIndex]
    if (!section) return undefined
    return section.getBlock(pos.x & 0xf, pos.y & 0xf, pos.z & 0xf)
  }

  getBiome(pos: BlockPos): number | undefined {
    const sectionY = Math.floor(pos.y / 16)
    const sectionIndex = sectionY - MIN_SECTION_Y
    if (sectionIndex < 0 || sectionIndex >= this.sections.length)
      return undefined
    const section = this.sections[sectionIndex]
    if (!section) return undefined
    return section.getBiome(pos.x & 0xf, pos.y & 0xf, pos.z & 0xf)
  }

  setBlock(pos: BlockPos, state: number): void {
    const sectionY = Math.floor(pos.y / 16)
    const sectionIndex = sectionY - MIN_SECTION_Y
    if (sectionIndex < 0 || sectionIndex >= this.sections.length)
      return
    let section = this.sections[sectionIndex]
    if (!section) {
      section = new ChunkSection(sectionY)
      this.sections[sectionIndex] = section
    }
    section.setBlock(pos.x & 0xf, pos.y & 0xf, pos.z & 0xf, state)
  }
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

export function parseChunkSections(data: Uint8Array, count = SECTION_COUNT): (ChunkSection | null)[] {
  const reader = new PacketReader(data)
  const sections: (ChunkSection | null)[] = []

  for (let i = 0; i < count; i++) {
    const section = new ChunkSection(MIN_SECTION_Y + i)

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
  }

  return sections
}

export function applyLevelChunk(chunks: Map<number, ChunkData>, x: number, z: number, data: Uint8Array): void {
  const key = chunkKey(x, z)
  let chunk = chunks.get(key)
  if (!chunk) {
    chunk = new ChunkData(x, z)
    chunks.set(key, chunk)
  }
  const sections = parseChunkSections(data, SECTION_COUNT)
  for (let i = 0; i < SECTION_COUNT; i++)
    chunk.sections[i] = sections[i]!
}
