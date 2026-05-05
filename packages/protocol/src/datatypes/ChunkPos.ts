import { codec, type PacketReader, type PacketWriter } from "../buffer";

export class ChunkPos {
  static readonly codec = codec<ChunkPos>({
    encode(writer: PacketWriter, value: ChunkPos) {
      writer.writeLong(value.pack());
    },
    decode(reader: PacketReader): ChunkPos {
      const packed = reader.readLong();
      return ChunkPos.unpack(packed);
    },
  });

  constructor(
    public x: number,
    public z: number
  ) {}

  pack(): bigint {
    return (BigInt(this.x) & 4294967295n) | ((BigInt(this.z) & 4294967295n) << 32n);
  }

  static unpack(packed: bigint): ChunkPos {
    const x = Number(packed & 4294967295n);
    const z = Number((packed >> 32n) & 4294967295n);
    return new ChunkPos(x, z);
  }
}