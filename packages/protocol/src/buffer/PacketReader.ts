import { NbtReader, NbtTagType, type NbtTag } from "@dripleaf/nbt";
import { Identifier } from "@dripleaf/registry";
import { readLpVec3 } from "./lpvec3";
import { decodeVarInt, decodeVarLong } from "./varint";
import { Vec3 } from "vec3";
import type { UUID } from "node:crypto";
import { Either } from "./utils";
import type { Codec } from "./Codec";

const IDENTIFIER_PATTERN = /^([0-9a-z._-]+:)?[0-9a-z._\-\/]+$/;

export class PacketReader {
  offset = 0;

  constructor(readonly bytes: Uint8Array) {}

  clone(): PacketReader {
    const clone = new PacketReader(this.bytes);
    clone.offset = this.offset;
    return clone;
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readByte(min = -128, max = 127): number {
    let value = this.readUnsignedByte();
    if (value > 127) value -= 256;
    if (value < min || value > max)
      throw new Error(`Byte out of range (${min}..${max}): ${value}`);
    return value;
  }

  readUnsignedByte(): number {
    if (this.remaining < 1)
      throw new Error("Unexpected end of packet");

    return this.bytes[this.offset++]!;
  }

  readBoolean(): boolean {
    const value = this.readUnsignedByte();
    if (value !== 0 && value !== 1)
      throw new Error(`Invalid boolean ${value}`);
    return value === 1;
  }

  readShort(): number {
    const value = (this.readUnsignedByte() << 8) | this.readUnsignedByte();
    return value & 0x8000 ? value - 0x10000 : value;
  }

  readUnsignedShort(): number {
    return (this.readUnsignedByte() << 8) | this.readUnsignedByte();
  }

  readInt(): number {
    const value =
      (this.readUnsignedByte() << 24) |
      (this.readUnsignedByte() << 16) |
      (this.readUnsignedByte() << 8) |
      this.readUnsignedByte();

    return value | 0;
  }

  readLong(): bigint {
    let value = 0n;
    for (let index = 0; index < 8; index++)
      value = (value << 8n) | BigInt(this.readUnsignedByte());

    return value & 0x8000000000000000n
      ? value - 0x10000000000000000n
      : value;
  }

  readFloat(): number {
    const bytes = this.readBytes(4);
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, false);
  }

  readDouble(): number {
    const bytes = this.readBytes(8);
    return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, false);
  }

  readVarInt(): number {
    const [value, offset] = decodeVarInt(this.bytes, this.offset);
    this.offset = offset;
    return value;
  }

  readVarLong(): bigint {
    const [value, offset] = decodeVarLong(this.bytes, this.offset);
    this.offset = offset;
    return value;
  }

  readString(maxLength = 32767): string {
    const byteLength = this.readVarInt();
    if (byteLength > maxLength * 3)
      throw new Error("Encoded string exceeds protocol limit");

    const value = new TextDecoder().decode(this.readBytes(byteLength));
    if (value.length > maxLength)
      throw new Error(`Decoded string exceeds ${maxLength}`);

    return value;
  }

  readIdentifier(): Identifier {
    const value = this.readString(32767);
    if (!IDENTIFIER_PATTERN.test(value))
      throw new Error(`Invalid identifier: ${value}`);
    return Identifier.from(value);
  }

  readUUID(): UUID {
    const msb = this.readLong();
    const lsb = this.readLong();

    const value =
      ((msb & ((1n << 64n) - 1n)) << 64n) |
      (lsb & ((1n << 64n) - 1n));

    const hex = value.toString(16).padStart(32, "0");

    return (
      hex.slice(0, 8) + "-" +
      hex.slice(8, 12) + "-" +
      hex.slice(12, 16) + "-" +
      hex.slice(16, 20) + "-" +
      hex.slice(20)
    ) as UUID;
  }
  
  readVec3d(): Vec3 {
    const x = this.readDouble();
    const y = this.readDouble();
    const z = this.readDouble();
    return new Vec3(x, y, z);
  }

  readVec3f(): Vec3 {
    const x = this.readFloat();
    const y = this.readFloat();
    const z = this.readFloat();
    return new Vec3(x, y, z);
  }

  readLpVec3(): Vec3 {
    const [value, offset] = readLpVec3(this.bytes, this.offset);
    this.offset = offset;
    return value;
  }

  readBitSet(): bigint[] {
    const length = this.readVarInt();
    return Array.from({ length }, () => this.readLong());
  }

  readFixedBitSet(byteLength: number): Uint8Array {
    return this.readBytes(byteLength);
  }

  readByteArray(maxLength = 1048576): Uint8Array {
    const length = this.readVarInt();
    if (length > maxLength)
      throw new Error(`ByteArray length ${length} exceeds maximum ${maxLength}`);
    return this.readBytes(length);
  }

  readPrefixedOptional<T>(read: () => T): T | null {
    return this.readBoolean() ? read() : null;
  }

  readArray<T>(read: () => T): T[] {
    const length = this.readVarInt();
    return Array.from({ length }, () => read());
  }

  readCodec<T>(valueCodec: Codec<T>): T {
    return valueCodec.decode(this);
  }

  readBytes(length: number): Uint8Array {
    if (length < 0)
      throw new Error(`Invalid byte length ${length}`);
    if (this.remaining < length)
      throw new Error("Unexpected end of packet");

    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readNbt(): Omit<NbtTag, "name"> {
    const type = this.readUnsignedByte();
    if (!(type in NbtTagType) || type === NbtTagType.End)
      throw new Error(`Invalid anonymous NBT root type ${type}`);

    const nbtReader = new NbtReader(this.bytes.subarray(this.offset));
    const value = nbtReader.readPayload(type as Exclude<NbtTagType, NbtTagType.End>);
    this.offset += nbtReader.offset;
    return {
      type: type as Exclude<NbtTagType, NbtTagType.End>,
      value,
    };
  }

  readOptionalNbt(): Omit<NbtTag, "name"> | null {
    const type = this.readUnsignedByte();
    if (type === NbtTagType.End)
      return null;
    if (!(type in NbtTagType))
      throw new Error(`Invalid anonymous NBT root type ${type}`);

    const nbtReader = new NbtReader(this.bytes.subarray(this.offset));
    const value = nbtReader.readPayload(type as Exclude<NbtTagType, NbtTagType.End>);
    this.offset += nbtReader.offset;
    return {
      type: type as Exclude<NbtTagType, NbtTagType.End>,
      value,
    };
  }

  readEither<L, R>(
    readLeft: () => L,
    readRight: () => R
  ): Either<L, R> {
    return this.readBoolean()
      ? Either.left(readLeft())
      : Either.right(readRight());
  }

  readRemaining(): Uint8Array {
    return this.readBytes(this.remaining);
  }

  readUnknown(fieldName: string): never {
    throw new Error(`Cannot read unknown packet field: ${fieldName}`);
  }
}
