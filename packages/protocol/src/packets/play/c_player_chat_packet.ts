import { PacketReader, PacketWriter, Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import type { UnnamedNbtTag } from '@dripleaf/nbt';

// signature: Option<MessageSignature> = boolean + 256 bytes
// On the wire, Option<MessageSignature> is encoded as:
//   boolean: present
//   if true: 256 bytes of signature data

export type SignedMessageBody = {
  content: string;
  timestamp: bigint;
  salt: bigint;
  lastSeen: LastSeenMessages;
}

export type LastSeenMessages = {
  entries: PackedMessageSignature[];
};

export type PackedMessageSignature =
  | { kind: "signature"; signature: Uint8Array }
  | { kind: "id"; id: number };

export type ChatTypeBound = {
  chatType: number; // Holder varint: 0=direct(DirectChatType), >0=reference(chatTypeIndex-1)
  name: UnnamedNbtTag;
  targetName: UnnamedNbtTag | null;
};

export type FilterMask =
  | { kind: "passThrough" }
  | { kind: "fullyFiltered" }
  | { kind: "partiallyFiltered"; bitSet: bigint[] };

function encodeFilterMask(writer: PacketWriter, mask: FilterMask) {
  switch (mask.kind) {
    case "passThrough":
      writer.writeVarInt(0);
      break;
    case "fullyFiltered":
      writer.writeVarInt(1);
      break;
    case "partiallyFiltered":
      writer.writeVarInt(2);
      Codecs.bitSet.encode(writer, mask.bitSet);
      break;
  }
}

function decodeFilterMask(reader: PacketReader): FilterMask {
  const type = reader.readVarInt();
  switch (type) {
    case 0: return { kind: "passThrough" };
    case 1: return { kind: "fullyFiltered" };
    case 2: return { kind: "partiallyFiltered", bitSet: Codecs.bitSet.decode(reader) };
    default: throw new Error(`Unknown filter mask type: ${type}`);
  }
}

function encodePackedMessageSignature(writer: PacketWriter, sig: PackedMessageSignature) {
  switch (sig.kind) {
    case "signature":
      writer.writeVarInt(0);
      writer.writeBytes(sig.signature);
      break;
    case "id":
      writer.writeVarInt(sig.id + 1);
      break;
  }
}

function decodePackedMessageSignature(reader: PacketReader): PackedMessageSignature {
  const id = reader.readVarInt();
  if (id === 0) {
    return { kind: "signature", signature: reader.readBytes(256) };
  }
  return { kind: "id", id: id - 1 };
}

function encodeLastSeen(writer: PacketWriter, ls: LastSeenMessages) {
  writer.writeArray(ls.entries, entry => encodePackedMessageSignature(writer, entry));
}

function decodeLastSeen(reader: PacketReader): LastSeenMessages {
  const entries = reader.readArray(() => decodePackedMessageSignature(reader));
  return { entries };
}

export class ClientboundPlayerChatPacket extends DripleafPacket {
  static readonly codec = packetCodec({
    encode(writer: PacketWriter, value: ClientboundPlayerChatPacket) {
      writer.writeVarInt(value.globalIndex);
      writer.writeUUID(value.sender);
      writer.writeVarInt(value.index);
      // signature: Option<MessageSignature> - 256 bytes when present
      writer.writeBoolean(value.signature !== null);
      if (value.signature) writer.writeBytes(value.signature);
      // body
      writer.writeString(value.body.content);
      writer.writeLong(value.body.timestamp);
      writer.writeLong(value.body.salt);
      encodeLastSeen(writer, value.body.lastSeen);
      // unsigned content: optional NBT (boolean prefixed)
      writer.writePrefixedOptional(value.unsignedContent, (content) => writer.writeNbt(content));
      // filter mask
      encodeFilterMask(writer, value.filterMask);
      // chat type: Holder<ChatKind, DirectChatType>
      writer.writeVarInt(value.chatType.chatType);
      writer.writeNbt(value.chatType.name);
      writer.writePrefixedOptional(value.chatType.targetName, v => writer.writeNbt(v));
    },
    decode(reader: PacketReader): ClientboundPlayerChatPacket {
      const globalIndex = reader.readVarInt();
      const sender = reader.readUUID();
      const index = reader.readVarInt();
      const signature = reader.readBoolean() ? reader.readBytes(256) : null;
      const content = reader.readString();
      const timestamp = reader.readLong();
      const salt = reader.readLong();
      const lastSeen = decodeLastSeen(reader);
      const body: SignedMessageBody = { content, timestamp, salt, lastSeen };
      const unsignedContent = reader.readPrefixedOptional(() => reader.readNbt());
      const filterMask = decodeFilterMask(reader);
      const chatTypeId = reader.readVarInt();
      const name = reader.readNbt();
      const targetName = reader.readPrefixedOptional(() => reader.readNbt());
      return new ClientboundPlayerChatPacket(
        globalIndex, sender, index, signature, body,
        unsignedContent, filterMask,
        { chatType: chatTypeId, name, targetName },
      );
    },
  });

  constructor(
    public globalIndex: number,
    public sender: string,
    public index: number,
    public signature: Uint8Array | null,
    public body: SignedMessageBody,
    public unsignedContent: UnnamedNbtTag | null,
    public filterMask: FilterMask,
    public chatType: ChatTypeBound,
  ) {
    super();
  }
}
