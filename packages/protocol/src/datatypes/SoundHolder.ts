import { SoundEvent } from '@dripleaf/registry'
import { Codecs } from '../buffer'

export type SoundEventValue = {
	location: SoundEvent
	fixedRange: number | null
}

const directSoundEventCodec = {
	encode(writer: any, value: SoundEventValue) {
		Codecs.varIntEnum(SoundEvent).encode(writer, value.location)
		writer.writePrefixedOptional(value.fixedRange, (range: number) => writer.writeFloat(range))
	},
	decode(reader: any): SoundEventValue {
		return {
			location: Codecs.varIntEnum(SoundEvent).decode(reader),
			fixedRange: reader.readPrefixedOptional(() => reader.readFloat()),
		}
	},
}

export const soundHolderCodec = Codecs.holder(Codecs.varIntEnum(SoundEvent), directSoundEventCodec)