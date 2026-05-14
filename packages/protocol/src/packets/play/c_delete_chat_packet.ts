import { Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';

export class ClientboundDeleteChatPacket extends DripleafPacket {
	static readonly codec = packetCodec(ClientboundDeleteChatPacket, {
		signature: Codecs.conditionalOptional({
			valueCodec: Codecs.byteArray(256),
			shouldEncode: value => value != null,
			shouldDecode: reader => reader.remaining >= 256,
		}),
	});

	constructor(
		public signature: Uint8Array | null
	) {
		super();
	}
}