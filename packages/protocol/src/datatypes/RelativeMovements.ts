import { codec, type PacketReader, type PacketWriter } from "../buffer"

export class RelativeMovements {
	static readonly codec = codec<RelativeMovements>({
		encode(writer: PacketWriter, value: RelativeMovements) {
			let bits = 0
			if (value.x) bits |= 1 << 0
			if (value.y) bits |= 1 << 1
			if (value.z) bits |= 1 << 2
			if (value.yRot) bits |= 1 << 3
			if (value.xRot) bits |= 1 << 4
			if (value.deltaX) bits |= 1 << 5
			if (value.deltaY) bits |= 1 << 6
			if (value.deltaZ) bits |= 1 << 7
			if (value.rotateDelta) bits |= 1 << 8
			writer.writeInt(bits)
		},
		decode(reader: PacketReader): RelativeMovements {
			const bits = reader.readInt()
			return new RelativeMovements(
				(bits & (1 << 0)) !== 0,
				(bits & (1 << 1)) !== 0,
				(bits & (1 << 2)) !== 0,
				(bits & (1 << 3)) !== 0,
				(bits & (1 << 4)) !== 0,
				(bits & (1 << 5)) !== 0,
				(bits & (1 << 6)) !== 0,
				(bits & (1 << 7)) !== 0,
				(bits & (1 << 8)) !== 0,
			)
		},
	})

	constructor(
		public x: boolean,
		public y: boolean,
		public z: boolean,
		public yRot: boolean,
		public xRot: boolean,
		public deltaX: boolean,
		public deltaY: boolean,
		public deltaZ: boolean,
		public rotateDelta: boolean,
	) {}
}