import { DataComponentType } from "@dripleaf/registry";
import { type PacketReader, type PacketWriter, Codecs } from "../buffer";

function readHolderRef(reader: PacketReader): number {
	return reader.readVarInt()
}

function writeHolderRef(writer: PacketWriter, id: number): void {
	writer.writeVarInt(id)
}

function readHolder<T>(reader: PacketReader, readDirect: () => T): T | number {
	const id = reader.readVarInt()
	if (id === 0) return readDirect()
	return id - 1
}

function skipHolderSet(reader: PacketReader): void {
	const rawCount = reader.readVarInt()
	if (rawCount === 0) {
		reader.readIdentifier()
	} else {
		const count = rawCount - 1
		for (let i = 0; i < count; i++) reader.readVarInt()
	}
}

function readSoundEvent(reader: PacketReader): unknown {
	const id = reader.readVarInt()
	if (id === 0) {
		reader.readIdentifier()
		if (reader.readBoolean()) reader.readFloat()
	}
	return id
}

function skipBlockPredicate(reader: PacketReader): void {
	if (reader.readBoolean()) skipHolderSet(reader)
	if (reader.readBoolean()) {
		const count = reader.readVarInt()
		for (let i = 0; i < count; i++) {
			reader.readString()
			const hasMin = reader.readBoolean()
			if (hasMin) reader.readString()
			const hasMax = reader.readBoolean()
			if (hasMax) reader.readString()
		}
	}
	if (reader.readBoolean()) reader.readNbt()
	skipComponentMatchers(reader)
}

function skipComponentMatchers(reader: PacketReader): void {
	const exactCount = reader.readVarInt()
	for (let i = 0; i < exactCount; i++) {
		Codecs.varIntEnum(DataComponentType).decode(reader)
		skipComponentValue(reader)
	}
}

function skipFilterableString(reader: PacketReader, maxLen: number): void {
	reader.readString(maxLen)
	if (reader.readBoolean()) reader.readString(maxLen)
}

function skipFilterableComponent(reader: PacketReader): void {
	reader.readNbt()
	if (reader.readBoolean()) reader.readNbt()
}

function skipItemStackTemplate(reader: PacketReader): void {
	const holderId = reader.readVarInt()
	if (holderId === 0) {
		reader.readString()
	}
	const count = reader.readVarInt()
	if (count <= 0) return
	readDataComponentPatch(reader)
}

function skipOptionalItemStackTemplate(reader: PacketReader): void {
	if (reader.readBoolean()) skipItemStackTemplate(reader)
}

function readDataComponentPatch(reader: PacketReader): Record<string, unknown> {
	const positiveCount = reader.readVarInt()
	const negativeCount = reader.readVarInt()
	const patch: Record<string, unknown> = {}
	for (let i = 0; i < positiveCount; i++) {
		const type = Codecs.varIntEnum(DataComponentType).decode(reader) as string
		patch[type] = skipComponentValue(reader)
	}
	for (let i = 0; i < negativeCount; i++) {
		const type = Codecs.varIntEnum(DataComponentType).decode(reader) as string
		patch[type] = null
	}
	return patch
}

function writeDataComponentPatch(writer: PacketWriter, patch: Record<string, unknown>): void {
	const entries = Object.entries(patch)
	const positive = entries.filter(([, v]) => v !== null && v !== undefined)
	const negative = entries.filter(([, v]) => v === null || v === undefined)

	writer.writeVarInt(positive.length)
	writer.writeVarInt(negative.length)

	for (const [key] of positive) {
		Codecs.varIntEnum(DataComponentType).encode(writer, key as any)
	}
	for (const [key] of negative) {
		Codecs.varIntEnum(DataComponentType).encode(writer, key as any)
	}
}

function skipConsumeEffect(reader: PacketReader): void {
	const typeId = reader.readVarInt()
	switch (typeId) {
		case 0:
			readHolderRef(reader)
			break
		case 1:
			readHolderRef(reader)
			break
		case 2:
			skipConsumeEffect(reader)
			skipConsumeEffect(reader)
			break
		case 3:
			skipConsumeEffect(reader)
			reader.readFloat()
			break
		case 4:
			readHolderRef(reader)
			reader.readVarInt()
			reader.readVarInt()
			reader.readBoolean()
			reader.readBoolean()
			reader.readBoolean()
			skipConsumeEffect(reader)
			break
		case 5:
			reader.readNbt()
			break
		default:
			throw new Error(`Unknown consume effect type: ${typeId}`)
	}
}

function skipMobEffectInstance(reader: PacketReader): void {
	readHolderRef(reader)
	reader.readVarInt()
	reader.readVarInt()
	reader.readBoolean()
	reader.readBoolean()
	reader.readBoolean()
	if (reader.readBoolean()) {
		skipMobEffectInstance(reader)
	}
}

function skipComponentValue(reader: PacketReader): unknown {
	const id = reader.readVarInt()
	const type = id
	switch (type) {
		case 0: // custom_data - NBT Compound
			return reader.readNbt()
		case 1: // max_stack_size
			return reader.readVarInt()
		case 2: // max_damage
			return reader.readVarInt()
		case 3: // damage
			return reader.readVarInt()
		case 4: // unbreakable - unit, no data
			return null
		case 5: // custom_name - Text Component (NBT)
			return reader.readNbt()
		case 6: // minimum_attack_charge
			return reader.readFloat()
		case 7: // damage_type - Holder<DamageType>
			return readHolder(reader, () => { reader.readString(); reader.readString(); reader.readFloat(); reader.readFloat(); return 0 })
		case 8: // item_name - Text Component (NBT)
			return reader.readNbt()
		case 9: // item_model - Identifier
			return reader.readIdentifier()
		case 10: { // lore - list of Text Components (NBT)
			const count = reader.readVarInt()
			const lines: unknown[] = []
			for (let i = 0; i < count; i++) lines.push(reader.readNbt())
			return lines
		}
		case 11: // rarity - VarInt enum
			return reader.readVarInt()
		case 12: { // enchantments - map of Holder<Enchantment> to VarInt level
			const size = reader.readVarInt()
			for (let i = 0; i < size; i++) {
				readHolderRef(reader)
				reader.readVarInt()
			}
			return undefined
		}
		case 13: { // can_place_on - list of BlockPredicate
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) skipBlockPredicate(reader)
			return undefined
		}
		case 14: { // can_break - list of BlockPredicate
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) skipBlockPredicate(reader)
			return undefined
		}
		case 15: { // attribute_modifiers
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) {
				readHolderRef(reader)
				reader.readString()
				reader.readDouble()
				reader.readVarInt()
				reader.readVarInt()
				const displayType = reader.readVarInt()
				if (displayType === 2) reader.readNbt()
			}
			return undefined
		}
		case 16: { // custom_model_data
			const floatCount = reader.readVarInt()
			for (let i = 0; i < floatCount; i++) reader.readFloat()
			const flagCount = reader.readVarInt()
			for (let i = 0; i < flagCount; i++) reader.readBoolean()
			const stringCount = reader.readVarInt()
			for (let i = 0; i < stringCount; i++) reader.readString()
			const colorCount = reader.readVarInt()
			for (let i = 0; i < colorCount; i++) reader.readInt()
			return undefined
		}
		case 17: { // tooltip_display
			reader.readBoolean()
			const hiddenCount = reader.readVarInt()
			for (let i = 0; i < hiddenCount; i++) reader.readVarInt()
			return undefined
		}
		case 18: // repair_cost
			return reader.readVarInt()
		case 19: // creative_slot_lock - unit, no data
			return null
		case 20: // enchantment_glint_override
			return reader.readBoolean()
		case 21: // intangible_projectile - NBT (empty compound)
			return reader.readNbt()
		case 22: { // food
			reader.readVarInt()
			reader.readFloat()
			reader.readBoolean()
			return undefined
		}
		case 23: { // consumable
			reader.readFloat()
			reader.readVarInt()
			readSoundEvent(reader)
			reader.readBoolean()
			const effectCount = reader.readVarInt()
			for (let i = 0; i < effectCount; i++) skipConsumeEffect(reader)
			return undefined
		}
		case 24: // use_remainder - ItemStackTemplate
			skipItemStackTemplate(reader)
			return undefined
		case 25: { // use_cooldown
			reader.readFloat()
			if (reader.readBoolean()) reader.readIdentifier()
			return undefined
		}
		case 26: // damage_resistant - HolderSet<DamageType>
			skipHolderSet(reader)
			return undefined
		case 27: { // tool
			const ruleCount = reader.readVarInt()
			for (let i = 0; i < ruleCount; i++) {
				skipHolderSet(reader)
				if (reader.readBoolean()) reader.readFloat()
				if (reader.readBoolean()) reader.readBoolean()
			}
			reader.readFloat()
			reader.readVarInt()
			reader.readBoolean()
			return undefined
		}
		case 28: { // weapon
			reader.readVarInt()
			reader.readFloat()
			return undefined
		}
		case 29: { // attack_range
			reader.readFloat()
			reader.readFloat()
			reader.readFloat()
			reader.readFloat()
			reader.readFloat()
			reader.readBoolean()
			return undefined
		}
		case 30: // enchantable
			return reader.readVarInt()
		case 31: { // equippable
			reader.readVarInt()
			readSoundEvent(reader)
			if (reader.readBoolean()) reader.readIdentifier()
			if (reader.readBoolean()) reader.readIdentifier()
			if (reader.readBoolean()) skipHolderSet(reader)
			reader.readBoolean()
			reader.readBoolean()
			reader.readBoolean()
			reader.readBoolean()
			reader.readBoolean()
			readSoundEvent(reader)
			return undefined
		}
		case 32: // repairable - HolderSet<Item>
			skipHolderSet(reader)
			return undefined
		case 33: // glider - unit, no data
			return null
		case 34: // tooltip_style
			return reader.readIdentifier()
		case 35: { // death_protection
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) skipConsumeEffect(reader)
			return undefined
		}
		case 36: { // blocks_attacks
			reader.readFloat()
			reader.readFloat()
			const reductionCount = reader.readVarInt()
			for (let i = 0; i < reductionCount; i++) {
				if (reader.readBoolean()) skipHolderSet(reader)
				reader.readFloat()
				reader.readFloat()
			}
			reader.readFloat()
			reader.readFloat()
			reader.readFloat()
			if (reader.readBoolean()) reader.readIdentifier()
			if (reader.readBoolean()) readSoundEvent(reader)
			if (reader.readBoolean()) readSoundEvent(reader)
			return undefined
		}
		case 37: { // piercing_weapon
			reader.readFloat()
			return undefined
		}
		case 38: { // kinetic_weapon
			reader.readFloat()
			return undefined
		}
		case 39: // swing_animation - VarInt enum
			return reader.readVarInt()
		case 40: // additional_trade_cost
			return reader.readVarInt()
		case 41: { // stored_enchantments - map of Holder<Enchantment> to VarInt level
			const size = reader.readVarInt()
			for (let i = 0; i < size; i++) {
				readHolderRef(reader)
				reader.readVarInt()
			}
			return undefined
		}
		case 42: // dye - VarInt enum
			return reader.readVarInt()
		case 43: // dyed_color - Int RGB
			return reader.readInt()
		case 44: // map_color - Int RGB
			return reader.readInt()
		case 45: // map_id
			return reader.readVarInt()
		case 46: // map_decorations - NBT
			return reader.readNbt()
		case 47: // map_post_processing - VarInt enum
			return reader.readVarInt()
		case 48: { // charged_projectiles - list of ItemStackTemplate
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) skipItemStackTemplate(reader)
			return undefined
		}
		case 49: { // bundle_contents - list of ItemStackTemplate
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) skipItemStackTemplate(reader)
			return undefined
		}
		case 50: { // potion_contents
			if (reader.readBoolean()) readHolderRef(reader)
			if (reader.readBoolean()) reader.readInt()
			const effectCount = reader.readVarInt()
			for (let i = 0; i < effectCount; i++) skipMobEffectInstance(reader)
			if (reader.readBoolean()) reader.readString()
			return undefined
		}
		case 51: // potion_duration_scale
			return reader.readFloat()
		case 52: { // suspicious_stew_effects
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) {
				readHolderRef(reader)
				reader.readVarInt()
			}
			return undefined
		}
		case 53: { // writable_book_content
			const pageCount = reader.readVarInt()
			for (let i = 0; i < pageCount; i++) skipFilterableString(reader, 1024)
			return undefined
		}
		case 54: { // written_book_content
			skipFilterableString(reader, 32)
			reader.readString()
			reader.readVarInt()
			const pageCount = reader.readVarInt()
			for (let i = 0; i < pageCount; i++) skipFilterableComponent(reader)
			reader.readBoolean()
			return undefined
		}
		case 55: { // trim
			readHolder(reader, () => {
				reader.readString()
				reader.readNbt()
				return 0
			})
			readHolder(reader, () => {
				reader.readIdentifier()
				reader.readNbt()
				reader.readBoolean()
				return 0
			})
			return undefined
		}
		case 56: // debug_stick_state - NBT
			return reader.readNbt()
		case 57: { // entity_data - VarInt entity type + NBT
			reader.readVarInt()
			return reader.readNbt()
		}
		case 58: // bucket_entity_data - NBT
			return reader.readNbt()
		case 59: { // block_entity_data - VarInt block entity type + NBT
			reader.readVarInt()
			return reader.readNbt()
		}
		case 60: { // instrument
			readHolder(reader, () => {
				readSoundEvent(reader)
				reader.readFloat()
				reader.readFloat()
				reader.readNbt()
				reader.readVarInt()
				return 0
			})
			return undefined
		}
		case 61: { // provides_trim_material - Holder<TrimMaterial>
			readHolder(reader, () => {
				reader.readString()
				reader.readNbt()
				return 0
			})
			return undefined
		}
		case 62: // ominous_bottle_amplifier
			return reader.readVarInt()
		case 63: { // jukebox_playable
			readHolder(reader, () => {
				readSoundEvent(reader)
				reader.readNbt()
				reader.readFloat()
				reader.readVarInt()
				return 0
			})
			return undefined
		}
		case 64: // provides_banner_patterns - HolderSet<BannerPattern>
			skipHolderSet(reader)
			return undefined
		case 65: // recipes - NBT
			return reader.readNbt()
		case 66: { // lodestone_tracker
			if (reader.readBoolean()) {
				reader.readIdentifier()
				reader.readInt()
				reader.readInt()
				reader.readInt()
			}
			reader.readBoolean()
			return undefined
		}
		case 67: { // firework_explosion
			reader.readVarInt()
			const colorCount = reader.readVarInt()
			for (let i = 0; i < colorCount; i++) reader.readInt()
			const fadeColorCount = reader.readVarInt()
			for (let i = 0; i < fadeColorCount; i++) reader.readInt()
			reader.readBoolean()
			reader.readBoolean()
			return undefined
		}
		case 68: { // fireworks
			reader.readVarInt()
			const explosionCount = reader.readVarInt()
			for (let i = 0; i < explosionCount; i++) {
				reader.readVarInt()
				const cc = reader.readVarInt()
				for (let j = 0; j < cc; j++) reader.readInt()
				const fc = reader.readVarInt()
				for (let j = 0; j < fc; j++) reader.readInt()
				reader.readBoolean()
				reader.readBoolean()
			}
			return undefined
		}
		case 69: { // profile
			reader.readBoolean()
			if (reader.readBoolean()) reader.readString(16)
			if (reader.readBoolean()) {
				const msb = reader.readLong()
				const lsb = reader.readLong()
			}
			const propCount = reader.readVarInt()
			for (let i = 0; i < propCount; i++) {
				reader.readString()
				reader.readString()
				if (reader.readBoolean()) reader.readString()
			}
			return undefined
		}
		case 70: // note_block_sound - Identifier
			return reader.readIdentifier()
		case 71: { // banner_patterns
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) {
				readHolderRef(reader)
				reader.readVarInt()
			}
			return undefined
		}
		case 72: // base_color - VarInt enum
			return reader.readVarInt()
		case 73: { // pot_decorations
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) reader.readVarInt()
			return undefined
		}
		case 74: { // container
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) {
				skipOptionalItemStackTemplate(reader)
			}
			return undefined
		}
		case 75: { // block_state - map of string to string
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) {
				reader.readString()
				reader.readString()
			}
			return undefined
		}
		case 76: { // bees
			const count = reader.readVarInt()
			for (let i = 0; i < count; i++) {
				reader.readVarInt()
				reader.readNbt()
				reader.readVarInt()
				reader.readVarInt()
			}
			return undefined
		}
		case 77: // lock - NBT (String inside compound)
			return reader.readNbt()
		case 78: // container_loot - NBT
			return reader.readNbt()
		case 79: // break_sound - Holder<SoundEvent>
			return readHolder(reader, () => { reader.readIdentifier(); if (reader.readBoolean()) reader.readFloat(); return 0 })
		case 80: // use_effects - VarInt enum
			return reader.readVarInt()
		case 81: // villager/variant - Holder
			return readHolderRef(reader)
		case 82: // wolf/variant - Holder
			return readHolderRef(reader)
		case 83: // wolf/sound_variant - Holder
			return readHolderRef(reader)
		case 84: // wolf/collar - VarInt enum
			return reader.readVarInt()
		case 85: // fox/variant - VarInt enum
			return reader.readVarInt()
		case 86: // salmon/size - VarInt enum
			return reader.readVarInt()
		case 87: // parrot/variant - VarInt enum
			return reader.readVarInt()
		case 88: // tropical_fish/pattern - VarInt enum
			return reader.readVarInt()
		case 89: // tropical_fish/base_color - VarInt enum
			return reader.readVarInt()
		case 90: // tropical_fish/pattern_color - VarInt enum
			return reader.readVarInt()
		case 91: // mooshroom/variant - VarInt enum
			return reader.readVarInt()
		case 92: // rabbit/variant - VarInt enum
			return reader.readVarInt()
		case 93: // pig/variant - Holder
			return readHolderRef(reader)
		case 94: // pig/sound_variant - Holder
			return readHolderRef(reader)
		case 95: // cow/variant - Holder
			return readHolderRef(reader)
		case 96: // cow/sound_variant - Holder
			return readHolderRef(reader)
		case 97: // chicken/variant - Holder
			return readHolderRef(reader)
		case 98: // chicken/sound_variant - Holder
			return readHolderRef(reader)
		case 99: // zombie_nautilus/variant - Holder
			return readHolderRef(reader)
		case 100: // frog/variant - Holder
			return readHolderRef(reader)
		case 101: // horse/variant - Holder
			return readHolderRef(reader)
		case 102: // painting/variant - Holder
			return readHolderRef(reader)
		case 103: // llama/variant - VarInt enum
			return reader.readVarInt()
		case 104: // axolotl/variant - VarInt enum
			return reader.readVarInt()
		case 105: // cat/variant - Holder
			return readHolderRef(reader)
		case 106: // cat/sound_variant - Holder
			return readHolderRef(reader)
		case 107: // cat/collar - VarInt enum
			return reader.readVarInt()
		case 108: // sheep/color - VarInt enum
			return reader.readVarInt()
		case 109: // shulker/color - VarInt enum
			return reader.readVarInt()
		default:
			throw new Error(`Unknown data component type: ${type}`)
	}
}

export const DataComponentPatchCodec = {
	encode(writer: PacketWriter, patch: Record<string, unknown>): void {
		writeDataComponentPatch(writer, patch)
	},
	decode(reader: PacketReader): Record<string, unknown> {
		return readDataComponentPatch(reader)
	},
}