import type { SoundEventValue } from "@dripleaf/core"
import { type Codec, type PacketReader, type PacketWriter } from "../buffer"
import type { Holder } from "../buffer"

export type { SoundEventValue }

const soundEventHolderCodec: Codec<Holder<string, SoundEventValue>> = {
  encode(writer: PacketWriter, value: Holder<string, SoundEventValue>) {
    if (value.kind !== "reference")
      throw new Error("Sound event holder must be a reference in protocol 775");
    writer.writeVarInt(0);
  },
  decode(reader: PacketReader): Holder<string, SoundEventValue> {
    const idx = reader.readVarInt();
    return { kind: "reference", value: `sound_${idx}` } as Holder<string, SoundEventValue>;
  },
};

export const soundHolderCodec = soundEventHolderCodec
