import { ItemStack, ItemStackData, type ItemStack as ItemStackType } from "@dripleaf/inventory";
import { DebugSubscription, ItemType } from "@dripleaf/registry";
import { codec, Codecs } from "../buffer";
import type { Either, PacketReader, PacketWriter } from "../buffer";
import type { ChatComponent } from "@dripleaf/chat";

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
	label: Either<ServerLinkType, ChatComponent>;
	url: string;
}

import { DataComponentPatchCodec } from "../datatypes/DataComponentPatch"

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