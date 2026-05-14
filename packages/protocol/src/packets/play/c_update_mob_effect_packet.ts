import { Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';

export type MobEffectFlags = {
	isAmbient: boolean;
	isVisible: boolean;
	showIcon: boolean;
	blend: boolean;
};

export class ClientboundUpdateMobEffectPacket extends DripleafPacket {
	static readonly codec = packetCodec(ClientboundUpdateMobEffectPacket, {
		entityId: Codecs.varInt,
		effect: Codecs.varInt,
		effectAmplifier: Codecs.varInt,
		effectDurationTicks: Codecs.varInt,
		flags: Codecs.byte,
	});

	constructor(
		public entityId: number,
		public effect: number,
		public effectAmplifier: number,
		public effectDurationTicks: number,
		public flags: number,
	) {
		super();
	}
}