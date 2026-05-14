import { PacketReader, PacketWriter, Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import type { UnnamedNbtTag } from '@dripleaf/nbt';

export type LastSeenMessages = {
	offset: number;
	acknowledged: bigint[];
};

export type SignedMessageBody = {
	content: string;
	timestamp: bigint;
	salt: bigint;
	lastSeen: LastSeenMessages;
}

export type ChatTypeBound = {
	chatType: number;
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
			writer.writeByte(0);
			break;
		case "fullyFiltered":
			writer.writeByte(1);
			break;
		case "partiallyFiltered":
			writer.writeByte(2);
			Codecs.bitSet.encode(writer, mask.bitSet);
			break;
	}
}

function decodeFilterMask(reader: PacketReader): FilterMask {
	const type = reader.readByte();
	switch (type) {
		case 0: return { kind: "passThrough" };
		case 1: return { kind: "fullyFiltered" };
		case 2: return { kind: "partiallyFiltered", bitSet: Codecs.bitSet.decode(reader) };
		default: throw new Error(`Unknown filter mask type: ${type}`);
	}
}

function encodeLastSeen(writer: PacketWriter, ls: LastSeenMessages) {
	writer.writeVarInt(ls.offset);
	Codecs.fixedBitSet(20).encode(writer, new Uint8Array(ls.acknowledged.flatMap(v => [...Array(8).keys()].map(i => Number((v >> BigInt(i * 8)) & 0xffn)))));
}

function decodeLastSeen(reader: PacketReader): LastSeenMessages {
	const offset = reader.readVarInt();
	const bits = reader.readFixedBitSet(20);
	const acknowledged: bigint[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		let v = 0n;
		for (let j = 0; j < 8; j++)
			v |= BigInt(bits[i + j] ?? 0) << BigInt(j * 8);
		acknowledged.push(v);
	}
	return { offset, acknowledged };
}

export class ClientboundPlayerChatPacket extends DripleafPacket {
	static readonly codec = packetCodec({
		encode(writer: PacketWriter, value: ClientboundPlayerChatPacket) {
			writer.writeVarInt(value.globalIndex);
			writer.writeUUID(value.sender);
			writer.writeVarInt(value.index);
			writer.writePrefixedOptional(value.signature, (sig) => writer.writeByteArray(sig));
			writer.writeString(value.body.content);
			writer.writeLong(value.body.timestamp);
			writer.writeLong(value.body.salt);
			encodeLastSeen(writer, value.body.lastSeen);
			writer.writePrefixedOptional(value.unsignedContent, (content) => writer.writeNbt(content));
			encodeFilterMask(writer, value.filterMask);
			writer.writeVarInt(value.chatType.chatType);
			writer.writeNbt(value.chatType.name);
			writer.writePrefixedOptional(value.chatType.targetName, v => writer.writeNbt(v));
		},
		decode(reader: PacketReader): ClientboundPlayerChatPacket {
			const globalIndex = reader.readVarInt();
			const sender = reader.readUUID();
			const index = reader.readVarInt();
			const signature = reader.readPrefixedOptional(() => reader.readByteArray());
			const content = reader.readString();
			const timestamp = reader.readLong();
			const salt = reader.readLong();
			const lastSeen = decodeLastSeen(reader);
			const body = { content, timestamp, salt, lastSeen };
			const unsignedContent = reader.readPrefixedOptional(() => reader.readNbt());
			const filterMask = decodeFilterMask(reader);
			const chatTypeId = reader.readVarInt();
			const name = reader.readNbt();
			const targetName = reader.readPrefixedOptional(() => reader.readNbt());
			return new ClientboundPlayerChatPacket(globalIndex, sender, index, signature, body, unsignedContent, filterMask, { chatType: chatTypeId, name, targetName });
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
		public chatType: ChatTypeBound
	) {
		super();
	}

}
