import type { UnnamedNbtTag } from '@dripleaf/nbt'
import { Codecs, type PacketReader, type PacketWriter } from '../buffer'

export type Dialog = UnnamedNbtTag

export const dialogCodec = {
	encode(writer: PacketWriter, value: Dialog) {
		writer.writeNbt(value)
	},
	decode(reader: PacketReader): Dialog {
		return reader.readNbt()
	},
}

export const dialogHolderCodec = Codecs.holderEither(Codecs.string(32767), dialogCodec)
