import type { UnnamedNbtTag } from "@dripleaf/nbt";
import { ItemStack, ItemStackData, type ItemStack as ItemStackType } from "@dripleaf/inventory";
import { DebugSubscription, ItemType } from "@dripleaf/registry";
import { codec, Codecs } from "../buffer";
import type { Either } from "../buffer";

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

export const ItemStackCodec = codec<ItemStackType>({
	encode(writer, value) {
		if (value.type === "empty") {
			writer.writeVarInt(0)
			return
		}

		writer.writeVarInt(value.item.count)
		Codecs.varIntEnum(ItemType).encode(writer, value.item.kind)
		writer.writeVarInt(0)
		writer.writeVarInt(0)
	},
	decode(reader) {
		const count = reader.readVarInt()
		if (count <= 0) return ItemStack.Empty

		const kind = Codecs.varIntEnum(ItemType).decode(reader)
		const componentsWithData = reader.readVarInt()
		const componentsWithoutData = reader.readVarInt()
		for (let index = 0; index < componentsWithData; index++)
			throw new Error("Data component decoding not implemented yet")
		for (let index = 0; index < componentsWithoutData; index++)
			throw new Error("Data component removal decoding not implemented yet")

		return ItemStack.Present(new ItemStackData(kind, count))
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