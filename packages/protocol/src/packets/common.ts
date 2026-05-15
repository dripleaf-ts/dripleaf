import { NbtTagType, type NbtValue, type UnnamedNbtTag } from "@dripleaf/nbt";
import { ItemStack, ItemStackData, type ItemStack as ItemStackType } from "@dripleaf/inventory";
import { DataComponentType, DebugSubscription, ItemType } from "@dripleaf/registry";
import { codec, Codecs } from "../buffer";
import type { Either, PacketReader, PacketWriter } from "../buffer";

export enum ServerLinkType {
	BugReport = 0,
	CommunityGuidelines = 1,
	Support = 2,
	Status = 3,
	Feedback = 4,
	Community = 5,
	Website = 6,
	Forums = 7,
	News = 8,
	Announcements = 9
}

export type ServerLink = {
	label: Either<ServerLinkType, UnnamedNbtTag>;
	url: string;
}

function anyToNbtValue(value: unknown): NbtValue {
	if (value === null || value === undefined) return 0 as NbtValue
	if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") return value as NbtValue
	if (typeof value === "boolean") return (value ? 1 : 0) as NbtValue
	if (Array.isArray(value)) return value.map(anyToNbtValue) as NbtValue
	if (typeof value === "object") {
		const compound: Record<string, NbtValue> = {}
		for (const [k, v] of Object.entries(value as Record<string, unknown>))
			compound[k] = anyToNbtValue(v)
		return compound as NbtValue
	}
	return String(value) as NbtValue
}

function nbtValueToAny(value: NbtValue): unknown {
	if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") return value
	if (value instanceof Uint8Array) return value
	if (Array.isArray(value)) return value.map(nbtValueToAny)
	if (typeof value === "object" && "elementType" in value && "items" in value)
		return (value as any).items.map(nbtValueToAny)
	const result: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(value as Record<string, unknown>))
		result[k] = nbtValueToAny(v as NbtValue)
	return result
}

const componentTypeCodec = Codecs.varIntEnum(DataComponentType)

const DataComponentPatchCodec = codec<Record<string, unknown>>({
	encode(writer, patch) {
		const entries = Object.entries(patch)
		const positive = entries.filter(([, v]) => v !== null && v !== undefined)
		const negative = entries.filter(([, v]) => v === null || v === undefined)

		writer.writeVarInt(positive.length)
		writer.writeVarInt(negative.length)

		for (const [key, value] of positive) {
			componentTypeCodec.encode(writer, key as any)
			writer.writeNbt({
				type: NbtTagType.Compound,
				value: anyToNbtValue(value) as any,
			})
		}

		for (const [key] of negative) {
			componentTypeCodec.encode(writer, key as any)
		}
	},
	decode(reader) {
		const patch: Record<string, unknown> = {}
		const positiveCount = reader.readVarInt()
		const negativeCount = reader.readVarInt()

		for (let i = 0; i < positiveCount; i++) {
			const type = componentTypeCodec.decode(reader)
			const nbt = reader.readNbt()
			patch[type as string] = nbtValueToAny(nbt.value)
		}

		for (let i = 0; i < negativeCount; i++) {
			const type = componentTypeCodec.decode(reader)
			patch[type as string] = null
		}

		return patch
	},
})

export const ItemStackCodec = codec<ItemStackType>({
	encode(writer, value) {
		if (!value || value.type === "empty") {
			writer.writeVarInt(0)
			return
		}

		writer.writeVarInt(value.item.count)
		Codecs.varIntEnum(ItemType).encode(writer, value.item.kind)
		DataComponentPatchCodec.encode(writer, value.item.component_patch)
	},
	decode(reader) {
		const count = reader.readVarInt()
		if (count <= 0) return ItemStack.Empty

		const kind = Codecs.varIntEnum(ItemType).decode(reader)
		const patch = DataComponentPatchCodec.decode(reader)

		return ItemStack.Present(new ItemStackData(kind, count, patch))
	},
});

export type DebugUpdatePayload = {
	subscription: DebugSubscription
	payload: Uint8Array
}

export enum SoundSource {
	Master,
	Music,
	Records,
	Weather,
	Blocks,
	Hostile,
	Neutral,
	Players,
	Ambient,
	Voice,
	UI
}

export enum Difficulty {
	Peaceful,
	Easy,
	Normal,
	Hard,
}

export enum ClientCommandAction {
	PerformRespawn = 0,
	RequestStats = 1,
	RequestGameruleValues = 2,
}