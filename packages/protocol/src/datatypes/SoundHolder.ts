import type { SoundEventValue } from "@dripleaf/core"
import { SoundEventRegistry } from "@dripleaf/registry"
import { type Codec, type PacketReader, type PacketWriter } from "../buffer"
import type { Holder } from "../buffer"

export type { SoundEventValue }

const soundEventHolderCodec: Codec<Holder<string, SoundEventValue>> = {
  encode(writer: PacketWriter, value: Holder<string, SoundEventValue>) {
    if (value.kind !== "reference")
      throw new Error("Sound event holder must be a reference in protocol 775");
    const entry = SoundEventRegistry.get(value.value as any);
    if (!entry)
      throw new Error(`Unknown sound event: ${value.value}`);
    writer.writeVarInt(entry.protocolId + 1);
  },
  decode(reader: PacketReader): Holder<string, SoundEventValue> {
    const idx = reader.readVarInt();
    const entry = SoundEventRegistry.getByProtocolId(idx - 1);
    if (!entry)
      return { kind: "reference", value: `sound_${idx}` } as Holder<string, SoundEventValue>;
    return { kind: "reference", value: entry.key } as Holder<string, SoundEventValue>;
  },
};

export const soundHolderCodec = soundEventHolderCodec
