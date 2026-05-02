import type { NbtCompound, NbtTag, UnnamedNbtTag } from "@dripleaf/nbt"
import { 
  DataComponentType,
  Identifier,
  type Attribute, 
  type VillagerType as VillagerType,
  type BlockEntityType, 
  type BlockType, 
  type Enchantment, 
  type EntityType, 
  type MapDecorationType, 
  type MobEffect, 
  type Potion, 
  type DamageType as RegistryDamageType, 
  type SoundEvent, 
  type TrimMaterial, 
  type TrimPattern, 
  type Instrument as RegistryInstrument, 
  type JukeboxSong, 
  type BannerPattern, 
  type WolfVariant as RegistryWolfVariant,
  type WolfSoundVariant as RegistryWolfSoundVariant,
  type PigVariant as RegistryPigVariant,
  type PigSoundVariant as RegistryPigSoundVariant,
  type CowVariant as RegistryCowVariant,
  type CowSoundVariant as RegistryCowSoundVariant,
  type ChickenVariant as RegistryChickenVariant,
  type ChickenSoundVariant as RegistryChickenSoundVariant,
  type FrogVariant as RegistryFrogVariant,
  type CatVariant as RegistryCatVariant,
  type CatSoundVariant as RegistryCatSoundVariant,
  type PaintingVariant as RegistryPaintingVariant,
  type ZombieNautilusVariant as RegistryZombieNautilusVariant,
  ItemType
} from "@dripleaf/registry"
import type { ItemKind, ItemStack } from "../ItemStack"
import type { Vec3 } from "vec3"

export type CustomData = NbtTag // todo: confirm this with mojang source

export type MaxStackSize = number

export type MaxDamage = number

export type Damage = number

export type Unbreakable = boolean;

export type UseEffects = {
  canSprint: boolean
  interactVibrations: boolean
  speedMultiplier: number
}

export type CustomName = UnnamedNbtTag // todo: @dripleaf/chat

export type MinimumAttackCharge = number;

export type DamageType = RegistryDamageType;

export type ItemName = UnnamedNbtTag // todo: @dripleaf/chat

export type ItemModel = Identifier;

export type Lore = UnnamedNbtTag[] // todo: @dripleaf/chat

export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
}

export type ItemEnchantments = Record<Enchantment, number>;

export type Enchantments = ItemEnchantments;

export type BlockStateValueMatcher = {
  value: string
} | {
  min: string | null
  max: string | null
}

// name from azalea/azalea-inventory/src/components/mod.rs - because it is shorter than the mojang one :sob:
export type BlockStatePropertyMatcher = {
  name: string
  value_matcher: BlockStateValueMatcher
}

export type BlockPredicate = {
  blocks?: BlockType[] | null,
  properties?: Record<string, string> | null
}

export type AdventureModePredicate = BlockPredicate[];

export type CanPlaceOn = AdventureModePredicate;

export type CanBreak = AdventureModePredicate;

export enum AttributeModifierOperation {
  AddValue = 0,
  AddMultipledBase = 1,
  AddMultipledTotal = 2,
}

export type AttributeModifier = {
  id: Identifier;
  amount: number;
  operation: AttributeModifierOperation;
}

type AttributeModifierDisplay =
  | { type: "default" }
  | { type: "hidden" }
  | {
    type: "override";
    text: UnnamedNbtTag; // todo: @dripleaf/chat 
  };

export enum EquipmentSlotGroup {
  Any = "any",
  MainHand = "main_hand",
  OffHand = "off_hand",
  Hand = "hand",
  Feet = "feet",
  Legs = "legs",
  Chest = "chest",
  Head = "head",
  Armor = "armor",
  Body = "body",
  Saddle = "saddle",
}

export type AttributeModifiersEntry = {
  attribute: Attribute;
  modifier: AttributeModifier;
  slot: EquipmentSlotGroup;
  display: AttributeModifierDisplay;
}

export type AttributeModifiers = {
  modifiers: AttributeModifiersEntry[];
}

export type CustomModelData = {
  floats: number[];
  flags: boolean[];
  strings: string[];
  colors: number[];
}

export type TooltipDisplay = {
  hideTooltip: boolean;
  hiddenComponents: DataComponentType[];
}

export type RepairCost = number;

export type CreativeSlotLock = unknown; // note: its called unit with nothing in it in mojang source :sob:

export type EnchantmentGlintOverride = boolean;

export type IntangibleProjectile = unknown; // note: its called unit with nothing in it in mojang source :sob:

export type Food = {
  nutrition: number;
  saturation: number;
  canAlwaysEat: boolean;
};

export enum ItemUseAnimation {
  None = "none",
  Eat = "eat",
  Drink = "drink",
  Block = "block",
  Bow = "bow",
  Trident = "trident",
  Crossbow = "crossbow",
  Spyglass = "spyglass",
  TootHorn = "toot_horn",
  Brush = "brush",
  Bundle = "bundle",
  Spear = "spear",
}

export type MobEffectInstance = {
  id: MobEffect;
  duration: number;
  amplifier: number;
  ambient: boolean;
  visible: boolean;
  showIcon: boolean;
}

export type ConsumeEffect =
  | {
    type: "apply_effects",
    effects: MobEffectInstance[],
    probablity: number,
  }
  | {
    type: "remove_effects",
    effects: MobEffect[],
  }
  | {
    type: "clear_all_effects"
  }
  | {
    type: "teleport_randomly",
    diameter: number
  }
  | {
    type: "play_sound",
    sound: SoundEvent
  }

export type Consumable = {
  consumeSeconds: number;
  animation: ItemUseAnimation;
  sound: SoundEvent;
  hasConsumeParticles: boolean;
  onConsumeEffects: ConsumeEffect[];
}

export type UseRemainder = ItemStack;

export type UseCooldown = {
  seconds: number;
  cooldownGroup: Identifier;
}

export type DamageResistant = DamageType[];

export type ToolRule = {
  blocks: BlockType[];
  speed: number | null;
  correctForDrops: boolean | null;
}

export type Tool = {
  rules: ToolRule[];
  defaultMiningSpeed: number;
  damagePerBlock: number;
  canDestroyBlocksInCreative: boolean;
}

export type Weapon = {
  itemDamagePerAttack: number;
  disableBlockingForSeconds: number;
}

export type AttackRange = {
  minReach: number;
  maxReach: number;
  minCreativeReach: number;
  maxCreativeReach: number;
  hitboxMargin: number;
  mobFactor: number;
}

export type Enchantable = number;

enum EquipmentSlot {
  Mainhand,
  Offhand,
  Feet,
  Legs,
  Chest,
  Head,
  Body,
  Saddle,
}

export type Equippable = {
  slot: EquipmentSlot;
  equipSound: SoundEvent;
  assetId: Identifier | null;
  cameraOverlay: Identifier | null;
  allowedEntities: EntityType[] | null;
  dispensable: boolean;
  swappable: boolean;
  damageOnHurt: boolean;
  equipOnInteract: boolean;
  canBeSheared: boolean;
  shearingSound: SoundEvent;
}

export type Repairable = ItemKind[];

export type Glider = unknown; // note: its called unit with nothing in it in mojang source :sob:

export type TooltipStyle = Identifier;

export type DeathProtection = ConsumeEffect[];

export type DamageReduction = {
  horizontalBlockingAngle: number;
  type: DamageType[] | null;
  base: number;
  factor: number;
}

export type ItemDamageFunction = {
  threshold: number;
  base: number;
  factor: number;
}

export type BlocksAttacks = {
  blockDelaySeconds: number;
  disableCooldownScale: number;
  damageReductions: DamageReduction[];
  itemDamage: ItemDamageFunction;
  bypassedBy: DamageType[] | null;
  blockSound: SoundEvent | null;
  disableSound: SoundEvent | null;
}

export type PiercingWeapon = {
  dealsKnockback: boolean;
  dismounts: boolean;
  sound: SoundEvent | null;
  hitSound: SoundEvent | null;
}

export type KineticWeaponCondition = {
  maxDurationTicks: number;
  minSpeed: number;
  minRelativeSpeed: number;
};

export type KineticWeapon = {
  contactCooldownTicks: number;
  delayTicks: number;
  dismountConditions: KineticWeaponCondition | null;
  knockbackConditions: KineticWeaponCondition | null;
  damageConditions: KineticWeaponCondition | null;
  forwardMovement: number;
  damageMultiplier: number;
  sound: SoundEvent | null;
  hitSound: SoundEvent | null;
}

export enum SwingAnimationType {
  None = "none",
  Whack = "whack",
  Stab = "stab",
}

export type SwingAnimation = {
  type: SwingAnimationType;
  duration: number;
}

export type AdditionalTradeCost = number;

export type StoredEnchantments = ItemEnchantments;

export enum DyeColor {
  White = "white",
  Orange = "orange",
  Magenta = "magenta",
  LightBlue = "light_blue",
  Yellow = "yellow",
  Lime = "lime",
  Pink = "pink",
  Gray = "gray",
  LightGray = "light_gray",
  Cyan = "cyan",
  Purple = "purple",
  Blue = "blue",
  Brown = "brown",
  Green = "green",
  Red = "red",
  Black = "black",
}

export type Dye = DyeColor;

export type DyedColor = number;

export type MapColor = number;

export type MapId = number;

export type MapDecorationsEntry = {
  type: MapDecorationType;
  x: number;
  z: number;
  rotation: number;
}

export type MapDecorations = Record<string, MapDecorationsEntry>;

export enum MapPostProcessing {
  Lock,
  Scale
}

export type ChargedProjectiles = ItemStack[];

export type BundleContents = ItemStack[];

export type PotionContents = {
  poition: Potion | null;
  customColor: number | null;
  customEffects: MobEffectInstance[];
  customName: string | null;
}

export type PotionDurationScale = number;

export type SuspiciousStewEffectsEntry = {
  effect: MobEffect;
  duration: number;
}

export type SuspiciousStewEffects = SuspiciousStewEffectsEntry[];

export type WritableBookContent = string[];

export type WrittenBookContent = {
  title: string;
  author: string;
  generation: number;
  pages: string[];
  resolved: boolean;
}

export type Trim = {
  material: TrimMaterial;
  pattern: TrimPattern;
}

// note: the nbtcompound is actually property inside of mojang source, however it is nbtcompound in azalea and that seemed easier
export type DebugStickState = Record<BlockType, NbtCompound>;

export type EntityData = {
  id: EntityType;
  // note: this seems to use customdata in mojang source but has to be double checked cause it is confusing
  data: NbtCompound;
}

export type BucketEntityData = CustomData;

export type BlockEntityData = {
  id: BlockEntityType;
  // note: this seems to use customdata in mojang source but has to be double checked cause it is confusing
  data: NbtCompound;
}

export type Instrument = RegistryInstrument;

export type ProvidesTrimMaterial = TrimMaterial;

export type OminousBottleAmplifier = number;

export type JukeboxPlayable = JukeboxSong;

export type ProvidesBannerPatterns = BannerPattern[];

export type Recipes = Identifier[];

export type LodestoneTracker = {
  target: {
    dimension: Identifier;
    pos: Vec3;
  }; // todo: @dripleaf/protocol will have a globalpos datatype to use for this
  tracked: boolean;
}

export enum FireworkExplosionShape {
  SmallBall = "small_ball",
  LargeBall = "large_ball",
  Star = "star",
  Creeper = "creeper",
  Burst = "burst",
}

export type FireworkExplosion = {
  shape: FireworkExplosionShape;
  colors: number[];
  fadeColors: number[];
  hasTrail: boolean;
  hasTwinkle: boolean;
}

export type Fireworks = {
  flightDuration: number;
  explosions: FireworkExplosion[];
}

// todo: move to @dripleaf/auth
export type GameProfilePropertyValue = {
  name: string;
  value: string;
  signature: string | null;
}

// todo: move to @dripleaf/auth
export type ResolvableProfilePartial = {
  name: string | null;
  id: string | null;
  properties: GameProfilePropertyValue[];
}

export enum PlayerModelType {
  Wide,
  Slim
}

export type PlayerSkinPatch = {
  body: Identifier | null;
  cape: Identifier | null;
  elytra: Identifier | null;
  model: PlayerModelType | null;
}

export type Profile = {
  partialProfile: ResolvableProfilePartial;
  skinPatch: PlayerSkinPatch;
}

export type NoteBlockSound = Identifier;

export type BannerPatternLayer = {
  pattern: BannerPattern;
  color: DyeColor;
}

export type BannerPatterns = BannerPatternLayer[];

export type BaseColor = DyeColor;

export type PotDecorations = {
  back: ItemType | null;
  left: ItemType | null;
  right: ItemType | null;
  front: ItemType | null;
}

export type Container = ItemStack[];

export type BlockState = Record<string, string>;

export type BeehiveBlockEntityOccupant = {
  entityData: NbtCompound;
  ticksInHive: number;
  minTicksInHive: number;
}

export type Bees = BeehiveBlockEntityOccupant[];

// note: this doesn't actually line up with mojang source, however it's like this in azalea and i'm too lazy to do all the min max bounds stuff
export type Lock = string;

export type ContainerLoot = {
  lootTable: Identifier;
  seed: number;
}

export type BreakSound = SoundEvent;

export type VillagerVariant = VillagerType;

export type WolfVariant = RegistryWolfVariant;

export type WolfSoundVariant = RegistryWolfSoundVariant;

export type WolfCollar = DyeColor;

export enum FoxVariant {
  Red = "red",
  Snow = "snow",
}

export enum SalmonVariant {
  Small = "small",
  Medium = "medium",
  Large = "large",
}

export type SalmonSize = SalmonVariant;

export enum ParrotVariant {
  RedBlue = "red_blue",
  Blue = "blue",
  Green = "green",
  YellowBlue = "yellow_blue",
  Gray = "gray",
}

export enum TropicalFishPattern {
  Kob = "kob",
  Sunstreak = "sunstreak",
  Snooper = "snooper",
  Dasher = "dasher",
  Brinely = "brinely",
  Spotty = "spotty",
  Flopper = "flopper",
  Stripey = "stripey",
  Glitter = "glitter",
  Blockfish = "blockfish",
  Betty = "betty",
  Clayfish = "clayfish",
}

export type TropicalFishBaseColor = DyeColor;

export type TropicalFishPatternColor = DyeColor;

export enum MushroomCowVariant {
  Red = "red",
  Brown = "brown",
}

export type MooshroomVariant = MushroomCowVariant;

export enum RabbitVariant {
  Brown = "brown",
  White = "white",
  Black = "black",
  WhiteSplotched = "white_splotched",
  Gold = "gold",
  Salt = "salt",
  Evil = "evil",
}

export type PigVariant = RegistryPigVariant;

export type PigSoundVariant = RegistryPigSoundVariant;

export type CowVariant = RegistryCowVariant;

export type CowSoundVariant = RegistryCowSoundVariant;

export type ChickenVariant = RegistryChickenVariant;

export type ChickenSoundVariant = RegistryChickenSoundVariant;

export type ZombieNautilusVariant = RegistryZombieNautilusVariant;

export type FrogVariant = RegistryFrogVariant;

export enum HorseVariant {
  White = "white",
  Creamy = "creamy",
  Chestnut = "chestnut",
  Brown = "brown",
  Black = "black",
  Gray = "gray",
  DarkBrown = "dark_brown",
}

export type PaintingVariant = RegistryPaintingVariant;

export enum LlamaVariant {
  Creamy = "creamy",
  White = "white",
  Brown = "brown",
  Gray = "gray",
}

export enum AxolotlVariant {
  Lucy = "lucy",
  Wild = "wild",
  Gold = "gold",
  Cyan = "cyan",
  Blue = "blue",
}

export type CatVariant = RegistryCatVariant;

export type CatSoundVariant = RegistryCatSoundVariant;

export type CatCollar = DyeColor;

export type SheepColor = DyeColor;

export type ShulkerColor = DyeColor;
