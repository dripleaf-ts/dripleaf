// Protocol 775: BlockPos pos + boolean includeData

import { BlockPos } from '@dripleaf/core';
import { BlockPosCodec } from '../../datatypes/BlockPos';
import { Codecs, type PacketReader, type PacketWriter } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';

export class ServerboundPickItemFromBlockPacket extends DripleafPacket {
	static readonly codec = packetCodec({
		encode(writer: PacketWriter, value: ServerboundPickItemFromBlockPacket) {
			BlockPosCodec.encode(writer, value.pos);
			writer.writeBoolean(value.includeData);
		},
		decode(reader: PacketReader): ServerboundPickItemFromBlockPacket {
			return new ServerboundPickItemFromBlockPacket(BlockPosCodec.decode(reader), reader.readBoolean());
		},
	});

	constructor(
		public pos: BlockPos,
		public includeData: boolean,
	) {
		super();
	}
}
