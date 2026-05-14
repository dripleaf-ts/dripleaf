import { Codecs, type PacketReader, type PacketWriter } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import type { UnnamedNbtTag } from '@dripleaf/nbt';

export type DisguisedChatTypeBound = {
	chatType: number;
	name: UnnamedNbtTag;
	targetName: UnnamedNbtTag | null;
};

export class ClientboundDisguisedChatPacket extends DripleafPacket {
	static readonly codec = packetCodec({
		encode(writer: PacketWriter, value: ClientboundDisguisedChatPacket) {
			writer.writeNbt(value.message);
			writer.writeVarInt(value.chatType.chatType);
			writer.writeNbt(value.chatType.name);
			writer.writePrefixedOptional(value.chatType.targetName, v => writer.writeNbt(v));
		},
		decode(reader: PacketReader): ClientboundDisguisedChatPacket {
			const message = reader.readNbt();
			const chatTypeId = reader.readVarInt();
			const name = reader.readNbt();
			const targetName = reader.readPrefixedOptional(() => reader.readNbt());
			return new ClientboundDisguisedChatPacket(message, { chatType: chatTypeId, name, targetName });
		},
	});

	constructor(
		public message: UnnamedNbtTag,
		public chatType: DisguisedChatTypeBound,
	) {
		super();
	}
}