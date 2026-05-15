// Protocol 775 format: category (VarInt enum)

import { Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';

export enum RecipeBookCategory {
	Crafting = 0,
	Furnace = 1,
	BlastFurnace = 2,
	Smoker = 3,
	Campfire = 4,
}

export class ServerboundRecipeBookSeenRecipePacket extends DripleafPacket {
	static readonly codec = packetCodec(ServerboundRecipeBookSeenRecipePacket, {
		category: Codecs.varIntEnum(RecipeBookCategory),
	});

	constructor(
		public category: RecipeBookCategory,
	) {
		super();
	}
}