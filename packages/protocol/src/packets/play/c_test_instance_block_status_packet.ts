import { Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import type { UnnamedNbtTag } from '@dripleaf/nbt';
import type { Vec3 } from 'vec3';

export class ClientboundTestInstanceBlockStatusPacket extends DripleafPacket {
	static readonly codec = packetCodec(ClientboundTestInstanceBlockStatusPacket, {
		status: Codecs.nbt,
		size: Codecs.prefixedOptional(Codecs.vec3d),
	});

	constructor(
		public status: UnnamedNbtTag,
		public size: Vec3 | null,
	) {
		super();
	}

}
