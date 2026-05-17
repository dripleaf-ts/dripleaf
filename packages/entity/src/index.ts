import { DataComponentType, EntityType, ItemType } from "@dripleaf/registry"
import { PacketReader, PacketWriter, Codecs, DataComponentPatchCodec } from "@dripleaf/protocol"
import { BlockPos, GlobalPos } from "@dripleaf/core"

export { EntityType, EntityTypeRegistry } from "@dripleaf/registry"

export class Vec3 {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}
}

export enum MetadataType {
  Byte = 0,
  VarInt = 1,
  VarLong = 2,
  Float = 3,
  String = 4,
  Chat = 5,
  OptionalChat = 6,
  Slot = 7,
  Boolean = 8,
  Rotations = 9,
  Position = 10,
  OptionalPosition = 11,
  Direction = 12,
  OptionalLivingEntityReference = 13,
  BlockState = 14,
  OptionalBlockState = 15,
  Particle = 16,
  Particles = 17,
  VillagerData = 18,
  OptionalUnsignedInt = 19,
  Pose = 20,
  CatVariant = 21,
  CatSoundVariant = 22,
  CowVariant = 23,
  CowSoundVariant = 24,
  WolfVariant = 25,
  WolfSoundVariant = 26,
  FrogVariant = 27,
  PigVariant = 28,
  PigSoundVariant = 29,
  ChickenVariant = 30,
  ChickenSoundVariant = 31,
  ZombieNautilusVariant = 32,
  OptionalGlobalPos = 33,
  PaintingVariant = 34,
  SnifferState = 35,
  ArmadilloState = 36,
  CopperGolemState = 37,
  WeatheringCopperState = 38,
  Vector3 = 39,
  Quaternion = 40,
  ResolvableProfile = 41,
  HumanoidArm = 42,
}

export type MetadataEntry = {
  index: number
  type: MetadataType
  value: unknown
}

export type ItemSlot = {
  itemCount: number
  itemId: ItemType
  components: Record<string, unknown>
} | null

export type AttributeModifier = {
  uuid: string
  name: string
  amount: number
  operation: number
}

export type EntityAttribute = {
  key: string
  value: number
  modifiers: AttributeModifier[]
}

export class EntityData {
  constructor(
    public id: number,
    public uuid: string,
    public type: EntityType,
    public position: Vec3,
    public yaw: number,
    public pitch: number,
    public headYaw: number,
    public velocity: Vec3,
    public metadata: Map<number, MetadataEntry>,
  ) {}
}

export function decodeMetadata(reader: PacketReader): Map<number, MetadataEntry> {
  const metadata = new Map<number, MetadataEntry>()

  while (reader.remaining > 0) {
    const entryOffset = reader.offset
    const index = reader.readUnsignedByte()

    if (index === 0xff) break

    const type = reader.readVarInt() as MetadataType
    let value: unknown
    try {
      value = readMetadataValue(reader, type)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${message} at metadata offset ${entryOffset}, index ${index}, remaining ${reader.remaining}`)
    }

    metadata.set(index, { index, type, value })
  }

  return metadata
}

function readMetadataValue(reader: PacketReader, type: MetadataType): unknown {
  switch (type) {
    case MetadataType.Byte:
      return reader.readUnsignedByte()

    case MetadataType.VarInt:
      return reader.readVarInt()

    case MetadataType.VarLong:
      return reader.readVarLong()

    case MetadataType.Float:
      return reader.readFloat()

    case MetadataType.String:
      return reader.readString(32767)

    case MetadataType.Chat:
      return reader.readNbt()

    case MetadataType.OptionalChat:
      return reader.readPrefixedOptional(() => reader.readNbt())

    case MetadataType.Slot: {
      const count = reader.readVarInt()
      if (count <= 0) return null
      const itemId = Codecs.varIntEnum(ItemType).decode(reader) as ItemType
      const components = readDataComponentPatch(reader)
      return { itemCount: count, itemId, components } as ItemSlot
    }

    case MetadataType.Boolean:
      return reader.readBoolean()

    case MetadataType.Rotations:
      return [reader.readFloat(), reader.readFloat(), reader.readFloat()] as [number, number, number]

    case MetadataType.Position:
      return BlockPos.unpack(reader.readLong())

    case MetadataType.OptionalPosition: {
      const present = reader.readBoolean()
      return present ? BlockPos.unpack(reader.readLong()) : null
    }

    case MetadataType.Direction:
      return reader.readVarInt()

    case MetadataType.OptionalLivingEntityReference: {
      const present = reader.readBoolean()
      return present ? reader.readVarInt() : null
    }

    case MetadataType.BlockState:
      return reader.readVarInt()

    case MetadataType.OptionalBlockState: {
      const state = reader.readVarInt()
      return state === -1 ? null : state
    }

    case MetadataType.Particle: {
      return readParticle(reader)
    }

    case MetadataType.Particles: {
      return reader.readArray(() => readParticle(reader))
    }

    case MetadataType.VillagerData:
      return [reader.readVarInt(), reader.readVarInt(), reader.readVarInt()] as [number, number, number]

    case MetadataType.OptionalUnsignedInt: {
      const value = reader.readVarInt()
      return value === 0 ? null : value - 1
    }

    case MetadataType.Pose:
    case MetadataType.CatVariant:
    case MetadataType.CatSoundVariant:
    case MetadataType.CowVariant:
    case MetadataType.CowSoundVariant:
    case MetadataType.WolfVariant:
    case MetadataType.WolfSoundVariant:
    case MetadataType.FrogVariant:
    case MetadataType.PigVariant:
    case MetadataType.PigSoundVariant:
    case MetadataType.ChickenVariant:
    case MetadataType.ChickenSoundVariant:
    case MetadataType.ZombieNautilusVariant:
    case MetadataType.PaintingVariant:
    case MetadataType.SnifferState:
    case MetadataType.ArmadilloState:
    case MetadataType.CopperGolemState:
    case MetadataType.WeatheringCopperState:
    case MetadataType.HumanoidArm:
      return reader.readVarInt()

    case MetadataType.OptionalGlobalPos: {
      const present = reader.readBoolean()
      if (!present) return null
      const dimension = reader.readIdentifier()
      const pos = BlockPos.unpack(reader.readLong())
      return new GlobalPos(dimension, pos)
    }

    case MetadataType.Vector3:
      return new Vec3(reader.readFloat(), reader.readFloat(), reader.readFloat())

    case MetadataType.Quaternion:
      return [reader.readFloat(), reader.readFloat(), reader.readFloat(), reader.readFloat()] as [number, number, number, number]

    case MetadataType.ResolvableProfile:
      return reader.readNbt()

    default:
      throw new Error(`Unknown metadata type: ${type}`)
  }
}

function readParticle(reader: PacketReader): { id: number } {
  return { id: reader.readVarInt() }
}

export function encodeMetadata(writer: PacketWriter, metadata: Map<number, MetadataEntry>): void {
  for (const [index, entry] of metadata) {
    writer.writeUnsignedByte(index)
    writer.writeVarInt(entry.type)
    writeMetadataValue(writer, entry)
  }

  writer.writeUnsignedByte(0xff)
}

function writeMetadataValue(writer: PacketWriter, entry: MetadataEntry): void {
  const { type, value } = entry

  switch (type) {
    case MetadataType.Byte:
      writer.writeUnsignedByte(value as number)
      break

    case MetadataType.VarInt:
      writer.writeVarInt(value as number)
      break

    case MetadataType.VarLong:
      writer.writeVarLong(value as bigint)
      break

    case MetadataType.Float:
      writer.writeFloat(value as number)
      break

    case MetadataType.String:
      writer.writeString(value as string)
      break

    case MetadataType.Chat:
      writer.writeNbt(value as any)
      break

    case MetadataType.OptionalChat:
      writer.writePrefixedOptional(value as any, (entry) => writer.writeNbt(entry))
      break

    case MetadataType.Slot: {
      const slot = value as ItemSlot
      if (slot == null) {
        writer.writeVarInt(0)
      } else {
        writer.writeVarInt(slot.itemCount)
        Codecs.varIntEnum(ItemType).encode(writer, slot.itemId)
        writeDataComponentPatch(writer, slot.components)
      }
      break
    }

    case MetadataType.Boolean:
      writer.writeBoolean(value as boolean)
      break

    case MetadataType.Rotations: {
      const [x, y, z] = value as [number, number, number]
      writer.writeFloat(x)
      writer.writeFloat(y)
      writer.writeFloat(z)
      break
    }

    case MetadataType.Position:
      writer.writeLong((value as BlockPos).pack())
      break

    case MetadataType.OptionalPosition: {
      const pos = value as BlockPos | null
      writer.writeBoolean(pos != null)
      if (pos != null) writer.writeLong(pos.pack())
      break
    }

    case MetadataType.Direction:
      writer.writeVarInt(value as number)
      break

    case MetadataType.OptionalLivingEntityReference: {
      const entityId = value as number | null
      writer.writeBoolean(entityId != null)
      if (entityId != null) writer.writeVarInt(entityId)
      break
    }

    case MetadataType.BlockState:
      writer.writeVarInt(value as number)
      break

    case MetadataType.OptionalBlockState: {
      const state = value as number | null
      writer.writeVarInt(state ?? -1)
      break
    }

    case MetadataType.Particle: {
      const particle = value as { id: number }
      writer.writeVarInt(particle.id)
      break
    }

    case MetadataType.Particles: {
      const particles = value as { id: number }[]
      writer.writeArray(particles, (particle) => writer.writeVarInt(particle.id))
      break
    }

    case MetadataType.VillagerData: {
      const [type_, profession, level] = value as [number, number, number]
      writer.writeVarInt(type_)
      writer.writeVarInt(profession)
      writer.writeVarInt(level)
      break
    }

    case MetadataType.OptionalUnsignedInt: {
      const val = value as number | null
      writer.writeVarInt(val == null ? 0 : val + 1)
      break
    }

    case MetadataType.Pose:
    case MetadataType.CatVariant:
    case MetadataType.CatSoundVariant:
    case MetadataType.CowVariant:
    case MetadataType.CowSoundVariant:
    case MetadataType.WolfVariant:
    case MetadataType.WolfSoundVariant:
    case MetadataType.FrogVariant:
    case MetadataType.PigVariant:
    case MetadataType.PigSoundVariant:
    case MetadataType.ChickenVariant:
    case MetadataType.ChickenSoundVariant:
    case MetadataType.ZombieNautilusVariant:
    case MetadataType.PaintingVariant:
    case MetadataType.SnifferState:
    case MetadataType.ArmadilloState:
    case MetadataType.CopperGolemState:
    case MetadataType.WeatheringCopperState:
    case MetadataType.HumanoidArm:
      writer.writeVarInt(value as number)
      break

    case MetadataType.OptionalGlobalPos: {
      const globalPos = value as GlobalPos | null
      writer.writeBoolean(globalPos != null)
      if (globalPos != null) {
        writer.writeIdentifier(globalPos.dimension)
        writer.writeLong(globalPos.pos.pack())
      }
      break
    }

    case MetadataType.ResolvableProfile:
      writer.writeNbt(value as any)
      break

    case MetadataType.Vector3: {
      const vec = value as Vec3
      writer.writeFloat(vec.x)
      writer.writeFloat(vec.y)
      writer.writeFloat(vec.z)
      break
    }

    case MetadataType.Quaternion: {
      const [x, y, z, w] = value as [number, number, number, number]
      writer.writeFloat(x)
      writer.writeFloat(y)
      writer.writeFloat(z)
      writer.writeFloat(w)
      break
    }

    default:
      throw new Error(`Unknown metadata type: ${type}`)
  }
}

function readDataComponentPatch(reader: PacketReader): Record<string, unknown> {
  return DataComponentPatchCodec.decode(reader)
}

function writeDataComponentPatch(writer: PacketWriter, patch: Record<string, unknown>): void {
  DataComponentPatchCodec.encode(writer, patch)
}


