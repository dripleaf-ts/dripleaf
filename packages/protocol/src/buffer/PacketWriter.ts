import { NbtWriter, type NbtTag } from "@dripleaf/nbt";
import { Identifier } from "@dripleaf/registry";
import { writeLpVec3 } from "./lpvec3";
import { writeVarInt, writeVarLong } from "./varint";
import type { Vec3 } from "vec3";
import type { UUID } from "node:crypto";
import type { Either } from "./utils";
import type { Codec } from "./Codec";

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const LONG_MIN = -(1n << 63n);
const LONG_MAX = (1n << 63n) - 1n;
const UUID_MAX = (1n << 128n) - 1n;
const IDENTIFIER_PATTERN = /^([0-9a-z._-]+:)?[0-9a-z._\-\/]+$/;

export class PacketWriter {
  private readonly chunks: number[] = [];

  private range(name: string, value: number | bigint, min: number | bigint, max: number | bigint) {
    if (value < min || value > max)
      throw new Error(`${name} out of range (${min}..${max}): ${value}`);
  }

  writeByte(value: number, min = -128, max = 127) {
    this.range("Byte", value, min, max);
    this.chunks.push(value & 0xff);
  }

  writeUnsignedByte(value: number) {
    this.range("UnsignedByte", value, 0, 255);
    this.chunks.push(value);
  }

  writeBoolean(value: boolean) {
    this.writeUnsignedByte(value ? 1 : 0);
  }

  writeShort(value: number) {
    this.range("Short", value, -32768, 32767);
    this.chunks.push((value >>> 8) & 0xff, value & 0xff);
  }

  writeUnsignedShort(value: number) {
    this.range("UnsignedShort", value, 0, 65535);
    this.chunks.push((value >>> 8) & 0xff, value & 0xff);
  }

  writeInt(value: number) {
    this.range("Int", value, INT_MIN, INT_MAX);
    this.chunks.push(
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    );
  }

  writeLong(value: bigint) {
    this.range("Long", value, LONG_MIN, LONG_MAX);
    for (let shift = 56n; shift >= 0n; shift -= 8n)
      this.chunks.push(Number((value >> shift) & 0xffn));
  }

  writeFloat(value: number) {
    if (!Number.isFinite(value))
      throw new Error("Float must be finite");

    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, false);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeDouble(value: number) {
    if (!Number.isFinite(value))
      throw new Error("Double must be finite");

    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, false);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeVarInt(value: number) {
    writeVarInt(value, byte => this.writeUnsignedByte(byte));
  }

  writeVarLong(value: bigint) {
    writeVarLong(value, byte => this.writeUnsignedByte(byte));
  }

  writeString(value: string, maxLength = 32767) {
    if (value.length > maxLength)
      throw new Error(`String exceeds ${maxLength} UTF-16 code units`);

    const bytes = new TextEncoder().encode(value);
    if (bytes.length > maxLength * 3)
      throw new Error("Encoded UTF-8 exceeds protocol limit");

    this.writeVarInt(bytes.length);
    this.writeBytes(bytes);
  }

  writeIdentifier(value: string | Identifier) {
    const identifier = Identifier.from(value).toString();
    if (!IDENTIFIER_PATTERN.test(identifier))
      throw new Error(`Invalid identifier: ${identifier}`);

    this.writeString(identifier, 32767);
  }

  writeUUID(value: string | UUID) {
    const normalized = value.replace(/-/g, "").toLowerCase();

    if (!/^[0-9a-f]{32}$/.test(normalized))
      throw new Error(`Invalid UUID: ${value}`);

    const number = BigInt(`0x${normalized}`);
    this.range("UUID", number, 0n, UUID_MAX);

    const mask64 = (1n << 64n) - 1n;
    let msb = (number >> 64n) & mask64;
    let lsb = number & mask64;

    if (msb >= (1n << 63n)) msb -= (1n << 64n);
    if (lsb >= (1n << 63n)) lsb -= (1n << 64n);

    this.writeLong(msb);
    this.writeLong(lsb);
  }

  writeVec3d(pos: Vec3) {
    this.writeDouble(pos.x);
    this.writeDouble(pos.y);
    this.writeDouble(pos.z);
  }

  writeVec3f(pos: Vec3) {
    this.writeFloat(pos.x);
    this.writeFloat(pos.y);
    this.writeFloat(pos.z);
  }

  writeLpVec3(value: Vec3) {
    writeLpVec3(value, byte => this.writeUnsignedByte(byte), encoded => this.writeVarInt(encoded));
  }

  writeBitSet(bits: bigint[]) {
    this.writeVarInt(bits.length);
    for (const word of bits)
      this.writeLong(word);
  }

  writeFixedBitSet(bits: Uint8Array, expectedBytes: number) {
    if (bits.length !== expectedBytes)
      throw new Error(`FixedBitSet expected ${expectedBytes} bytes`);

    this.writeBytes(bits);
  }

  writeByteArray(value: Uint8Array, maxLength = 1048576) {
    if (value.length > maxLength)
      throw new Error(`ByteArray exceeds ${maxLength} bytes`);

    this.writeVarInt(value.length);
    this.writeBytes(value);
  }

  writePrefixedOptional<T>(value: T | null | undefined, write: (value: T) => void) {
    const present = value != null;
    this.writeBoolean(present);
    if (present) write(value);
  }

  writeArray<T>(values: readonly T[], write: (value: T) => void) {
    this.writeVarInt(values.length);
    for (const value of values)
      write(value);
  }

  writeCodec<T>(valueCodec: Codec<T>, value: T) {
    valueCodec.encode(this, value);
  }

  writeBytes(value: Uint8Array) {
    for (const byte of value)
      this.chunks.push(byte);
  }

  writeNbt(value: Omit<NbtTag, "name">) {
    this.writeUnsignedByte(value.type);
    const nbtWriter = new NbtWriter();
    nbtWriter.writePayload(value.type, value.value);
    this.writeBytes(nbtWriter.finish());
  }

  writeOptionalNbt(value: Omit<NbtTag, "name"> | null) {
    if (value == null) {
      this.writeUnsignedByte(0);
      return;
    }

    this.writeNbt(value);
  }

  writeEither<L, R>(
    value: Either<L, R>,
    writeLeft: (value: L) => void,
    writeRight: (value: R) => void
  ) {
    if (value.type === "left") {
      this.writeBoolean(true);
      writeLeft(value.value);
    } else {
      this.writeBoolean(false);
      writeRight(value.value);
    }
  }

  writeUnknown(fieldName: string, _value?: unknown): never {
    throw new Error(`Cannot write unknown packet field: ${fieldName}`);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}
