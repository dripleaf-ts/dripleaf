import { Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import { particleCodec, type ParticleOptions } from '../../datatypes';

export class ClientboundLevelParticlesPacket extends DripleafPacket {
	static readonly codec = packetCodec(ClientboundLevelParticlesPacket, {
		overrideLimiter: Codecs.bool,
		alwaysShow: Codecs.bool,
		x: Codecs.double,
		y: Codecs.double,
		z: Codecs.double,
		xDist: Codecs.float,
		yDist: Codecs.float,
		zDist: Codecs.float,
		maxSpeed: Codecs.float,
		count: Codecs.int,
		particle: particleCodec,
	});

	constructor(
		public overrideLimiter: boolean,
		public alwaysShow: boolean,
		public x: number,
		public y: number,
		public z: number,
		public xDist: number,
		public yDist: number,
		public zDist: number,
		public maxSpeed: number,
		public count: number,
		public particle: ParticleOptions,
	) {
		super();
	}
}