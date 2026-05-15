import { type PacketReader, type PacketWriter, Codecs } from '../../buffer';
import { DripleafPacket, packetCodec } from '../DripleafPacket';
import { ItemStackCodec } from '../common';
import type { UnnamedNbtTag } from '@dripleaf/nbt';

// Protocol 775 format for RecipeBookAdd:
// Each entry is a RecipeDisplayEntry struct + flags byte
// RecipeDisplayEntry:
//   id: VarInt
//   display: RecipeDisplayData (varint enum + variant data)
//   group: VarInt (0 = no group)
//   category: RecipeBookCategory (varint enum)
//   crafting_requirements: optional array of Ingredient (varint-prefixed)

export type RecipeDisplayEntry = {
  id: number;
  display: UnnamedNbtTag; // stored as raw NBT for now
  group: number;
  category: number;
  craftingRequirements: unknown[] | null;
};

export type RecipeBookEntry = {
  contents: RecipeDisplayEntry;
  flags: number;
};

// SlotDisplayData enum variants (varint-prefixed)
// 0=Empty, 1=AnyFuel, 2=WithAnyPotion, 3=OnlyWithComponent, 4=Item,
// 5=ItemStack, 6=Tag, 7=Dyed, 8=SmithingTrim, 9=WithRemainder, 10=Composite
function skipSlotDisplay(reader: PacketReader) {
  const type = reader.readVarInt();
  switch (type) {
    case 0: break; // Empty
    case 1: break; // AnyFuel
    case 2: skipSlotDisplay(reader); break; // WithAnyPotion(contents)
    case 3: skipSlotDisplay(reader); reader.readVarInt(); break; // OnlyWithComponent(contents, component)
    case 4: reader.readVarInt(); break; // Item(item: ItemKind varint)
    case 5: reader.readCodec(ItemStackCodec); break; // ItemStack
    case 6: reader.readIdentifier(); break; // Tag(tag: Identifier)
    case 7: skipSlotDisplay(reader); skipSlotDisplay(reader); break; // Dyed(dye, target)
    case 8: skipSlotDisplay(reader); skipSlotDisplay(reader); reader.readVarInt(); break; // SmithingTrim(base, material, pattern)
    case 9: skipSlotDisplay(reader); skipSlotDisplay(reader); break; // WithRemainder(input, remainder)
    case 10: { // Composite(contents: Vec<SlotDisplayData>)
      const len = reader.readVarInt();
      for (let i = 0; i < len; i++) skipSlotDisplay(reader);
      break;
    }
    default: throw new Error(`Unknown SlotDisplayData variant: ${type}`);
  }
}

// RecipeDisplayData enum variants (varint-prefixed)
// 0=Shapeless, 1=Shaped, 2=Furnace, 3=Stonecutter, 4=Smithing
function skipRecipeDisplay(reader: PacketReader) {
  const type = reader.readVarInt();
  switch (type) {
    case 0: { // Shapeless(ingredients[], result, crafting_station)
      const count = reader.readVarInt();
      for (let i = 0; i < count; i++) skipSlotDisplay(reader);
      skipSlotDisplay(reader); // result
      skipSlotDisplay(reader); // crafting_station
      break;
    }
    case 1: { // Shaped(width, height, ingredients[], result, crafting_station)
      reader.readVarInt(); // width
      reader.readVarInt(); // height
      const count = reader.readVarInt();
      for (let i = 0; i < count; i++) skipSlotDisplay(reader);
      skipSlotDisplay(reader); // result
      skipSlotDisplay(reader); // crafting_station
      break;
    }
    case 2: { // Furnace(ingredient, fuel, result, crafting_station, duration, experience)
      skipSlotDisplay(reader); // ingredient
      skipSlotDisplay(reader); // fuel
      skipSlotDisplay(reader); // result
      skipSlotDisplay(reader); // crafting_station
      reader.readVarInt(); // duration
      reader.readFloat(); // experience
      break;
    }
    case 3: { // Stonecutter(input, result, crafting_station)
      skipSlotDisplay(reader); // input
      skipSlotDisplay(reader); // result
      skipSlotDisplay(reader); // crafting_station
      break;
    }
    case 4: { // Smithing(template, base, addition, result, crafting_station)
      skipSlotDisplay(reader); // template
      skipSlotDisplay(reader); // base
      skipSlotDisplay(reader); // addition
      skipSlotDisplay(reader); // result
      skipSlotDisplay(reader); // crafting_station
      break;
    }
    default: throw new Error(`Unknown RecipeDisplayData variant: ${type}`);
  }
}

function skipIngredient(reader: PacketReader) {
  // HolderSet<ItemKind, Identifier>: varint enum
  // 0 = direct (array of ItemKind varints)
  // 1 = tag (Identifier)
  const type = reader.readVarInt();
  if (type === 0) {
    const count = reader.readVarInt();
    for (let i = 0; i < count; i++) reader.readVarInt();
  } else if (type === 1) {
    reader.readIdentifier();
  }
}

function readEntry(reader: PacketReader): RecipeBookEntry {
  const id = reader.readVarInt();
  skipRecipeDisplay(reader);
  const group = reader.readVarInt();
  const category = reader.readVarInt();
  const hasRequirements = reader.readBoolean();
  if (hasRequirements) {
    const count = reader.readVarInt();
    for (let i = 0; i < count; i++) skipIngredient(reader);
  }
  const flags = reader.readByte();
  return {
    contents: { id, display: { type: 10 as any, value: {} as any }, group, category, craftingRequirements: null },
    flags,
  };
}

function writeEntry(writer: PacketWriter, entry: RecipeBookEntry) {
  writer.writeVarInt(entry.contents.id);
  // We can't write RecipeDisplayData properly without full types
  // This is a placeholder
  writer.writeVarInt(0); // Shapeless
  writer.writeVarInt(0); // 0 ingredients
  writer.writeVarInt(0); // result = Empty
  writer.writeVarInt(0); // crafting_station = Empty
  writer.writeVarInt(entry.contents.group);
  writer.writeVarInt(entry.contents.category);
  writer.writeBoolean(false); // no crafting requirements
  writer.writeByte(entry.flags);
}

export class ClientboundRecipeBookAddPacket extends DripleafPacket {
  static readonly codec = packetCodec({
    encode(writer: PacketWriter, value: ClientboundRecipeBookAddPacket) {
      writer.writeArray(value.entries, entry => writeEntry(writer, entry));
      writer.writeBoolean(value.replace);
    },
    decode(reader: PacketReader): ClientboundRecipeBookAddPacket {
      const entries = reader.readArray(() => readEntry(reader));
      const replace = reader.readBoolean();
      return new ClientboundRecipeBookAddPacket(entries, replace);
    },
  });

  constructor(
    public entries: RecipeBookEntry[],
    public replace: boolean,
  ) {
    super();
  }
}
