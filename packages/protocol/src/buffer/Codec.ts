import type { NbtTag } from "@dripleaf/nbt";
import type { Identifier } from "@dripleaf/registry";
import type { UUID } from "node:crypto";
import type { Vec3 } from "vec3";
import type { PacketReader } from "./PacketReader";
import type { PacketWriter } from "./PacketWriter";

export interface Codec<T> {
  encode(writer: PacketWriter, value: T): void;
  decode(reader: PacketReader): T;
}

export type Holder<TReference, TDirect = TReference> =
  | { kind: "reference"; value: TReference }
  | { kind: "direct"; value: TDirect };

export type StructCodecShape<T extends object> = {
  [TKey in keyof T]?: Codec<T[TKey]>;
};

type StructCodecEntry<T extends object> = readonly [keyof T & string, Codec<T[keyof T]>];

type EnumLike = Record<string, string | number>;
type EnumValue<TEnum extends EnumLike> = TEnum[Extract<keyof TEnum, string>];

function getEnumValues<TEnum extends EnumLike>(enumObject: TEnum): EnumValue<TEnum>[] {
  return Object.keys(enumObject)
    .filter(key => Number.isNaN(Number(key)))
    .map(key => enumObject[key as keyof TEnum] as EnumValue<TEnum>);
}

export const Codecs = {
  bool: primitive<boolean>((writer, value) => writer.writeBoolean(value), reader => reader.readBoolean()),
  byte: primitive<number>((writer, value) => writer.writeByte(value), reader => reader.readByte()),
  unsignedByte: primitive<number>((writer, value) => writer.writeUnsignedByte(value), reader => reader.readUnsignedByte()),
  short: primitive<number>((writer, value) => writer.writeShort(value), reader => reader.readShort()),
  unsignedShort: primitive<number>((writer, value) => writer.writeUnsignedShort(value), reader => reader.readUnsignedShort()),
  int: primitive<number>((writer, value) => writer.writeInt(value), reader => reader.readInt()),
  long: primitive<bigint>((writer, value) => writer.writeLong(value), reader => reader.readLong()),
  float: primitive<number>((writer, value) => writer.writeFloat(value), reader => reader.readFloat()),
  double: primitive<number>((writer, value) => writer.writeDouble(value), reader => reader.readDouble()),
  varInt: primitive<number>((writer, value) => writer.writeVarInt(value), reader => reader.readVarInt()),
  varLong: primitive<bigint>((writer, value) => writer.writeVarLong(value), reader => reader.readVarLong()),
  containerId: primitive<number>((writer, value) => writer.writeByte(value), reader => reader.readByte()),
  string(maxLength = 32767): Codec<string> {
    return primitive<string>((writer, value) => writer.writeString(value, maxLength), reader => reader.readString(maxLength));
  },
  identifier: primitive<Identifier>((writer, value) => writer.writeIdentifier(value), reader => reader.readIdentifier()),
  uuid: primitive<UUID>((writer, value) => writer.writeUUID(value), reader => reader.readUUID()),
  nbt: primitive<Omit<NbtTag, "name">>((writer, value) => writer.writeNbt(value), reader => reader.readNbt()),
  byteArray(maxLength = 1048576): Codec<Uint8Array> {
    return primitive<Uint8Array>((writer, value) => writer.writeByteArray(value, maxLength), reader => reader.readByteArray(maxLength));
  },
  vec3d: primitive<Vec3>((writer, value) => writer.writeVec3d(value), reader => reader.readVec3d()),
  vec3f: primitive<Vec3>((writer, value) => writer.writeVec3f(value), reader => reader.readVec3f()),
  lpVec3: primitive<Vec3>((writer, value) => writer.writeLpVec3(value), reader => reader.readLpVec3()),
  bitSet: primitive<bigint[]>((writer, value) => writer.writeBitSet(value), reader => reader.readBitSet()),
  fixedBitSet(byteLength: number): Codec<Uint8Array> {
    return primitive<Uint8Array>((writer, value) => writer.writeFixedBitSet(value, byteLength), reader => reader.readFixedBitSet(byteLength));
  },
  varIntEnum<TEnum extends EnumLike>(enumObject: TEnum): Codec<EnumValue<TEnum>> {
    const values = getEnumValues(enumObject);
    const valueToIndex = new Map<string | number, number>();

    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (typeof value === "string" || typeof value === "number")
        valueToIndex.set(value, index);
    }

    return primitive<EnumValue<TEnum>>((writer, value) => {
      const encoded = valueToIndex.get(value as string | number);
      if (encoded === undefined)
        throw new Error(`Unknown enum value: ${String(value)}`);
      writer.writeVarInt(encoded);
    }, reader => {
      const index = reader.readVarInt();
      const value = values[index];
      if (value === undefined)
        throw new Error(`Unknown enum index: ${index}`);
      return value as EnumValue<TEnum>;
    });
  },
  byteEnum<TEnum extends EnumLike>(enumObject: TEnum): Codec<EnumValue<TEnum>> {
    const values = getEnumValues(enumObject);
    const valueToIndex = new Map<string | number, number>();

    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (typeof value === "string" || typeof value === "number")
        valueToIndex.set(value, index);
    }

    return primitive<EnumValue<TEnum>>((writer, value) => {
      const encoded = valueToIndex.get(value as string | number);
      if (encoded === undefined)
        throw new Error(`Unknown enum value: ${String(value)}`);
      writer.writeByte(encoded);
    }, reader => {
      const index = reader.readByte();
      const value = values[index];
      if (value === undefined)
        throw new Error(`Unknown enum index: ${index}`);
      return value as EnumValue<TEnum>;
    });
  },
  unsignedByteEnum<TEnum extends EnumLike>(enumObject: TEnum): Codec<EnumValue<TEnum>> {
    const values = getEnumValues(enumObject);
    const valueToIndex = new Map<string | number, number>();

    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (typeof value === "string" || typeof value === "number")
        valueToIndex.set(value, index);
    }

    return primitive<EnumValue<TEnum>>((writer, value) => {
      const encoded = valueToIndex.get(value as string | number);
      if (encoded === undefined)
        throw new Error(`Unknown enum value: ${String(value)}`);
      writer.writeUnsignedByte(encoded);
    }, reader => {
      const index = reader.readUnsignedByte();
      const value = values[index];
      if (value === undefined)
        throw new Error(`Unknown enum index: ${index}`);
      return value as EnumValue<TEnum>;
    });
  },
  boolMask(bit: number): Codec<boolean> {
    return primitive<boolean>(
      (writer, value) => writer.writeUnsignedByte(value ? bit : 0),
      reader => (reader.readUnsignedByte() & bit) !== 0,
    );
  },
  array<T>(itemCodec: Codec<T>): Codec<T[]> {
    return primitive<T[]>((writer, value) => writer.writeArray(value, entry => itemCodec.encode(writer, entry)), reader => reader.readArray(() => itemCodec.decode(reader)));
  },
  map<K, V>(keyCodec: Codec<K>, valueCodec: Codec<V>): Codec<Map<K, V>> {
    return primitive<Map<K, V>>(
      (writer, value) => {
        writer.writeVarInt(value.size);
        for (const [key, entry] of value) {
          keyCodec.encode(writer, key);
          valueCodec.encode(writer, entry);
        }
      },
      reader => {
        const size = reader.readVarInt();
        const value = new Map<K, V>();
        for (let index = 0; index < size; index++)
          value.set(keyCodec.decode(reader), valueCodec.decode(reader));
        return value;
      },
    );
  },
  boundedMap<K, V>(keyCodec: Codec<K>, valueCodec: Codec<V>, maxSize: number): Codec<Map<K, V>> {
    return primitive<Map<K, V>>(
      (writer, value) => {
        if (value.size > maxSize)
          throw new Error(`Map exceeded max size: ${value.size}`);
        writer.writeVarInt(value.size);
        for (const [key, entry] of value) {
          keyCodec.encode(writer, key);
          valueCodec.encode(writer, entry);
        }
      },
      reader => {
        const size = reader.readVarInt();
        if (size > maxSize)
          throw new Error(`Map exceeded max size: ${size}`);
        const value = new Map<K, V>();
        for (let index = 0; index < size; index++)
          value.set(keyCodec.decode(reader), valueCodec.decode(reader));
        return value;
      },
    );
  },
  prefixedOptional<T>(valueCodec: Codec<T>): Codec<T | null> {
    return primitive<T | null>((writer, value) => writer.writePrefixedOptional(value, entry => valueCodec.encode(writer, entry)), reader => reader.readPrefixedOptional(() => valueCodec.decode(reader)));
  },
  conditionalOptional<T>(options: {
    valueCodec: Codec<T>;
    shouldEncode: (value: T | null) => boolean;
    shouldDecode: (reader: PacketReader) => boolean;
  }): Codec<T | null> {
    return primitive<T | null>(
      (writer, value) => {
        if (!options.shouldEncode(value))
          return;
        if (value == null)
          throw new Error("Conditional optional codec expected a value to encode");
        options.valueCodec.encode(writer, value);
      },
      reader => {
        if (!options.shouldDecode(reader))
          return null;
        return options.valueCodec.decode(reader);
      },
    );
  },
  holder<TReference extends string | number, TDirect = TReference>(referenceCodec: Codec<TReference>, directCodec: Codec<TDirect>): Codec<Holder<TReference, TDirect>> {
    return primitive<Holder<TReference, TDirect>>(
      (writer, value) => {
        if (value.kind === "reference") {
          writer.writeVarInt(getEnumIndex(referenceCodec, value.value) + 1);
          return;
        }

        writer.writeVarInt(0);
        directCodec.encode(writer, value.value);
      },
      reader => {
        const id = reader.readVarInt();
        if (id === 0)
          return { kind: "direct", value: directCodec.decode(reader) };

        const reference = getEnumValue(referenceCodec, id - 1);
        return { kind: "reference", value: reference };
      },
    );
  },
  holderRegistry<TReference extends string | number>(referenceCodec: Codec<TReference>): Codec<Holder<TReference>> {
    return primitive<Holder<TReference>>(
      (writer, value) => {
        if (value.kind !== "reference")
          throw new Error("Registry holder codec only supports reference holders");
        writer.writeVarInt(getEnumIndex(referenceCodec, value.value) + 1);
      },
      reader => {
        const id = reader.readVarInt();
        if (id === 0)
          throw new Error("Registry holder codec does not support direct holders");
        return { kind: "reference", value: getEnumValue(referenceCodec, id - 1) };
      },
    );
  },
  holderEither<TReference extends string | number, TDirect>(referenceCodec: Codec<TReference>, directCodec: Codec<TDirect>): Codec<Holder<TReference, TDirect>> {
    return primitive<Holder<TReference, TDirect>>(
      (writer, value) => {
        if (value.kind === "reference") {
          writer.writeBoolean(true);
          referenceCodec.encode(writer, value.value);
          return;
        }

        writer.writeBoolean(false);
        directCodec.encode(writer, value.value);
      },
      reader => {
        if (reader.readBoolean())
          return { kind: "reference", value: referenceCodec.decode(reader) };
        return { kind: "direct", value: directCodec.decode(reader) };
      },
    );
  },
} as const;

export function codec<T>(value: Codec<T>): Codec<T>;
export function codec<T extends object>(type: new (...args: any[]) => T, shape: StructCodecShape<T>): Codec<T>;
export function codec<T extends object>(
  typeOrValue: Codec<T> | (new (...args: any[]) => T),
  shape?: StructCodecShape<T>,
): Codec<T> {
  if (shape)
    return structCodec(typeOrValue as new (...args: any[]) => T, shape);
  return typeOrValue as Codec<T>;
}

function primitive<T>(encode: (writer: PacketWriter, value: T) => void, decode: (reader: PacketReader) => T): Codec<T> {
  return { encode, decode };
}

function getEnumIndex<TReference extends string | number>(codec: Codec<TReference>, value: TReference): number {
  const writer = {
    value: -1,
    writeVarInt(encoded: number) {
      this.value = encoded;
    },
  } as { value: number; writeVarInt: (encoded: number) => void } & PacketWriter;
  codec.encode(writer, value);
  if (writer.value < 0)
    throw new Error(`Holder reference codec must encode as varint enum for value ${String(value)}`);
  return writer.value;
}

function getEnumValue<TReference extends string | number>(codec: Codec<TReference>, index: number): TReference {
  const reader = {
    readVarInt() {
      return index;
    },
  } as { readVarInt: () => number } & PacketReader;
  return codec.decode(reader);
}

function structCodec<T extends object>(type: new (...args: any[]) => T, shape: StructCodecShape<T>): Codec<T> {
  const entries = Object.entries(shape) as unknown as StructCodecEntry<T>[];

  return {
    encode(writer: PacketWriter, value: T) {
      for (const [key, valueCodec] of entries)
        valueCodec.encode(writer, value[key]);
    },
    decode(reader: PacketReader): T {
      const values = entries.map(([, valueCodec]) => valueCodec.decode(reader));
      return new type(...values);
    },
  };
}
