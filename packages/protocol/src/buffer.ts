const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const LONG_MIN = -(1n << 63n);
const LONG_MAX = (1n << 63n) - 1n;
const UUID_MAX = (1n << 128n) - 1n;

export class PacketWriter {
  private readonly chunks: number[] = [];

  private range(name: string, v: number | bigint, min: number | bigint, max: number | bigint) {
    if (v < min || v > max)
      throw new Error(`${name} out of range (${min}..${max}): ${v}`);
  }

  writeByte(value: number) {
    this.range("Byte", value, -128, 127);
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
    for (let s = 56n; s >= 0n; s -= 8n)
      this.chunks.push(Number((value >> s) & 0xffn));
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
    this.range("VarInt", value, INT_MIN, INT_MAX);

    let current = value >>> 0;
    while (true) {
      if ((current & ~0x7f) === 0) {
        this.writeUnsignedByte(current);
        return;
      }
      this.writeUnsignedByte((current & 0x7f) | 0x80);
      current >>>= 7;
    }
  }

  writeVarLong(value: bigint) {
    this.range("VarLong", value, LONG_MIN, LONG_MAX);

    let current = BigInt.asUintN(64, value);

    while (true) {
      if ((current & ~0x7fn) === 0n) {
        this.writeUnsignedByte(Number(current));
        return;
      }

      this.writeUnsignedByte(Number((current & 0x7fn) | 0x80n));
      current >>= 7n;
    }
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

  writeIdentifier(value: string) {
    // todo: make this a better check. somehow, i really cba rn
    if (!value.includes(":")) throw new Error(`Invalid identifier: ${value}`);
    this.writeString(value, 32767);
  }

  writeUUID(value: bigint) {
    this.range("UUID", value, 0n, UUID_MAX);

    for (let s = 120n; s >= 0n; s -= 8n)
      this.writeUnsignedByte(Number((value >> s) & 0xffn));
  }

  writePosition(x: number, y: number, z: number) {
    this.range("Position.x", x, -33554432, 33554431);
    this.range("Position.z", z, -33554432, 33554431);
    this.range("Position.y", y, -2048, 2047);

    const packed =
      (BigInt(x & 0x3ffffff) << 38n) |
      (BigInt(z & 0x3ffffff) << 12n) |
      BigInt(y & 0xfff);

    this.writeLong(packed);
  }

  writeAngle(degrees: number) {
    if (!Number.isFinite(degrees))
      throw new Error("Invalid angle");

    degrees %= 360;
    if (degrees < 0) degrees += 360;

    this.writeUnsignedByte(Math.floor(degrees * 256 / 360));
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

  writeByteArray(value: Uint8Array) {
    this.writeVarInt(value.length);
    this.writeBytes(value);
  }

  writePrefixedOptional<T>(value: T | null | undefined, write: (v: T) => void) {
    const present = value != null;
    this.writeBoolean(present);
    if (present) write(value as T);
  }

  writeArray<T>(values: T[], write: (v: T) => void) {
    this.writeVarInt(values.length);
    for (const value of values)
      write(value);
  }

  writeBytes(value: Uint8Array) {
    for (const byte of value)
      this.chunks.push(byte);
  }

  writeUnknown(fieldName: string, _value?: unknown): never {
    throw new Error(`Cannot write unknown packet field: ${fieldName}`);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

export class PacketReader {
  offset = 0;

  constructor(readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readByte(): number {
    const v = this.readUnsignedByte();
    return v > 127 ? v - 256 : v;
  }

  readUnsignedByte(): number {
    if (this.remaining < 1)
      throw new Error("Unexpected end of packet");

    return this.bytes[this.offset++]!;
  }

  readBoolean(): boolean {
    const v = this.readUnsignedByte();

    if (v !== 0 && v !== 1)
      throw new Error(`Invalid boolean ${v}`);

    return !!v;
  }

  readShort(): number {
    const value =
      (this.readUnsignedByte() << 8) |
      this.readUnsignedByte();

    return value & 0x8000
      ? value - 0x10000
      : value;
  }

  readUnsignedShort(): number {
    return (
      (this.readUnsignedByte() << 8) |
      this.readUnsignedByte()
    );
  }

  readInt(): number {
    return (
      (this.readUnsignedByte() << 24) |
      (this.readUnsignedByte() << 16) |
      (this.readUnsignedByte() << 8) |
      this.readUnsignedByte()
    );
  }

  readLong(): bigint {
    let value = 0n;

    for (let i = 0; i < 8; i++)
      value = (value << 8n) | BigInt(this.readUnsignedByte());

    return value & 0x8000000000000000n
      ? value - 0x10000000000000000n
      : value;
  }

  readFloat(): number {
    const bytes = this.readBytes(4);
    return new DataView(
      bytes.buffer,
      bytes.byteOffset,
      4,
    ).getFloat32(0, false);
  }

  readDouble(): number {
    const bytes = this.readBytes(8);
    return new DataView(
      bytes.buffer,
      bytes.byteOffset,
      8,
    ).getFloat64(0, false);
  }

  readVarInt(): number {
    let value = 0;
    let shift = 0;

    while (shift < 35) {
      const byte = this.readUnsignedByte();

      value |= (byte & 0x7f) << shift;

      if ((byte & 0x80) === 0)
        return value | 0;

      shift += 7;
    }

    throw new Error("VarInt too large");
  }

  readVarLong(): bigint {
    let value = 0n;
    let shift = 0n;

    while (shift < 70n) {
      const byte = BigInt(this.readUnsignedByte());

      value |= (byte & 0x7fn) << shift;

      if ((byte & 0x80n) === 0n)
        return BigInt.asIntN(64, value);

      shift += 7n;
    }

    throw new Error("VarLong too large");
  }

  readString(maxLength = 32767): string {
    const byteLength = this.readVarInt();

    if (byteLength > maxLength * 3)
      throw new Error("Encoded string exceeds protocol limit");

    const value = new TextDecoder().decode(
      this.readBytes(byteLength)
    );

    if (value.length > maxLength)
      throw new Error(`Decoded string exceeds ${maxLength}`);

    return value;
  }

  readIdentifier(): string {
    return this.readString(32767);
  }

  readUUID(): bigint {
    let value = 0n;

    for (let i = 0; i < 16; i++)
      value = (value << 8n) | BigInt(this.readUnsignedByte());

    return value;
  }

  readPosition() {
    const value = this.readLong();

    let x = Number(value >> 38n);
    let y = Number(value & 0xfffn);
    let z = Number((value >> 12n) & 0x3ffffffn);

    if (x >= 1 << 25) x -= 1 << 26;
    if (y >= 1 << 11) y -= 1 << 12;
    if (z >= 1 << 25) z -= 1 << 26;

    return { x, y, z };
  }

  readAngle(): number {
    return this.readUnsignedByte() * 360 / 256;
  }

  readBitSet(): bigint[] {
    const length = this.readVarInt();
    return Array.from(
      { length },
      () => this.readLong(),
    );
  }

  readFixedBitSet(byteLength: number): Uint8Array {
    return this.readBytes(byteLength);
  }

  readByteArray(): Uint8Array {
    return this.readBytes(this.readVarInt());
  }

  readArray<T>(read: () => T): T[] {
    const length = this.readVarInt();

    return Array.from(
      { length },
      () => read(),
    );
  }

  readPrefixedOptional<T>(read: () => T): T | null {
    return this.readBoolean()
      ? read()
      : null;
  }

  readBytes(length: number): Uint8Array {
    if (this.remaining < length)
      throw new Error("Unexpected end of packet");

    const value = this.bytes.slice(
      this.offset,
      this.offset + length,
    );

    this.offset += length;
    return value;
  }

  readRemaining(): Uint8Array {
    return this.readBytes(this.remaining);
  }

  readUnknown(fieldName: string): never {
    throw new Error(`Cannot read unknown packet field: ${fieldName}`);
  }
}
