// Protocol 775: Vec3d + float yRot + float xRot + boolean onGround

import { Codecs, type PacketReader, type PacketWriter } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import type { Vec3 } from 'vec3';

export class ServerboundMoveVehiclePacket extends DripleafPacket {
	static readonly codec = packetCodec({
		encode(writer: PacketWriter, value: ServerboundMoveVehiclePacket) {
			writer.writeVec3d(value.position);
			writer.writeFloat(value.yRot);
			writer.writeFloat(value.xRot);
			writer.writeBoolean(value.onGround);
		},
		decode(reader: PacketReader): ServerboundMoveVehiclePacket {
			return new ServerboundMoveVehiclePacket(reader.readVec3d(), reader.readFloat(), reader.readFloat(), reader.readBoolean());
		},
	});

	constructor(
		public position: Vec3,
		public yRot: number,
		public xRot: number,
		public onGround: boolean,
	) {
		super();
	}
}
