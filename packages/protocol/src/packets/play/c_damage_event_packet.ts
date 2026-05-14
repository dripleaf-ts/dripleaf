import { Codecs, PacketReader, PacketWriter } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import { Vec3 } from 'vec3';

function encodeOptionalEntityId(writer: PacketWriter, value: number | null) {
	writer.writeVarInt(value != null ? value + 1 : 0);
}

function decodeOptionalEntityId(reader: PacketReader): number | null {
	const id = reader.readVarInt();
	return id === 0 ? null : id - 1;
}

export class ClientboundDamageEventPacket extends DripleafPacket {
	static readonly codec = packetCodec({
		encode(writer: PacketWriter, value: ClientboundDamageEventPacket) {
			writer.writeVarInt(value.entityId);
			writer.writeVarInt(value.sourceTypeId);
			encodeOptionalEntityId(writer, value.sourceCauseId);
			encodeOptionalEntityId(writer, value.sourceDirectId);
			Codecs.prefixedOptional(Codecs.vec3d).encode(writer, value.sourcePosition);
		},
		decode(reader: PacketReader): ClientboundDamageEventPacket {
			const entityId = reader.readVarInt();
			const sourceTypeId = reader.readVarInt();
			const sourceCauseId = decodeOptionalEntityId(reader);
			const sourceDirectId = decodeOptionalEntityId(reader);
			const sourcePosition = Codecs.prefixedOptional(Codecs.vec3d).decode(reader);
			return new ClientboundDamageEventPacket(entityId, sourceTypeId, sourceCauseId, sourceDirectId, sourcePosition);
		},
	});

	constructor(
		public entityId: number,
		public sourceTypeId: number,
		public sourceCauseId: number | null,
		public sourceDirectId: number | null,
		public sourcePosition: Vec3 | null,
	) {
		super();
	}
}