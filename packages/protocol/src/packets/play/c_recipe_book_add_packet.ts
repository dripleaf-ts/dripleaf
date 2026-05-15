import { type PacketReader, type PacketWriter, Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';

export type RecipeBookEntry = {
  id: number;
  body: Uint8Array;
  flags: number;
};

function readEntry(reader: PacketReader): RecipeBookEntry {
  const id = reader.readVarInt();
  const bodyStart = reader.offset;
  skipRecipeDisplay(reader);
  reader.readVarInt();
  reader.readVarInt();
  if (reader.readBoolean()) {
    const count = reader.readVarInt();
    for (let i = 0; i < count; i++) skipIngredient(reader);
  }
  const bodyEnd = reader.offset;
  const flags = reader.readByte();
  return {
    id,
    body: reader.bytes.slice(bodyStart, bodyEnd),
    flags,
  };
}

function writeEntry(writer: PacketWriter, entry: RecipeBookEntry) {
  writer.writeVarInt(entry.id);
  writer.writeBytes(entry.body);
  writer.writeByte(entry.flags);
}

function skipSlotDisplay(reader: PacketReader) {
  const type = reader.readVarInt();
  switch (type) {
    case 0: break;
    case 1: break;
    case 2: skipSlotDisplay(reader); break;
    case 3: skipSlotDisplay(reader); reader.readVarInt(); break;
    case 4: reader.readVarInt(); break;
    case 5: reader.readCodec(Codecs.nbt); break;
    case 6: reader.readIdentifier(); break;
    case 7: skipSlotDisplay(reader); skipSlotDisplay(reader); break;
    case 8: skipSlotDisplay(reader); skipSlotDisplay(reader); reader.readVarInt(); break;
    case 9: skipSlotDisplay(reader); skipSlotDisplay(reader); break;
    case 10: {
      const len = reader.readVarInt();
      for (let i = 0; i < len; i++) skipSlotDisplay(reader);
      break;
    }
    default: throw new Error(`Unknown SlotDisplayData variant: ${type}`);
  }
}

function skipRecipeDisplay(reader: PacketReader) {
  const type = reader.readVarInt();
  switch (type) {
    case 0: {
      const count = reader.readVarInt();
      for (let i = 0; i < count; i++) skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      break;
    }
    case 1: {
      reader.readVarInt();
      reader.readVarInt();
      const count = reader.readVarInt();
      for (let i = 0; i < count; i++) skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      break;
    }
    case 2: {
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      reader.readVarInt();
      reader.readFloat();
      break;
    }
    case 3: {
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      break;
    }
    case 4: {
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      skipSlotDisplay(reader);
      break;
    }
    default: throw new Error(`Unknown RecipeDisplayData variant: ${type}`);
  }
}

function skipIngredient(reader: PacketReader) {
  const type = reader.readVarInt();
  if (type === 0) {
    const count = reader.readVarInt();
    for (let i = 0; i < count; i++) reader.readVarInt();
  } else if (type === 1) {
    reader.readIdentifier();
  }
}

export class ClientboundRecipeBookAddPacket extends DripleafPacket {
  static readonly codec = packetCodec({
    encode(writer: PacketWriter, value: ClientboundRecipeBookAddPacket) {
      writer.writeArray(value.entries, entry => writeEntry(writer, entry));
      writer.writeBoolean(value.replace);
    },
    decode(reader: PacketReader): ClientboundRecipeBookAddPacket {
      const entries = reader.readArray(() => readEntry(reader));
      const replace = reader.readBoolean();
      return new ClientboundRecipeBookAddPacket(entries, replace);
    },
  });

  constructor(
    public entries: RecipeBookEntry[],
    public replace: boolean,
  ) {
    super();
  }
}
