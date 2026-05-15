import { ItemStack } from "./ItemStack"

export type ClickTarget =
  | { kind: "outside" }
  | { kind: "hotbar"; index: number }
  | { kind: "inventory"; index: number }
  | { kind: "container"; index: number }
  | { kind: "crafting" }

export type SlotData = {
  index: number
  item: ItemStack
}

export type WindowType =
  | "inventory"
  | "chest"
  | "crafting_table"
  | "furnace"
  | "blast_furnace"
  | "smoker"
  | "brewing_stand"
  | "enchantment_table"
  | "anvil"
  | "grindstone"
  | "cartography_table"
  | "stonecutter"
  | "loom"
  | "hopper"
  | "shulker_box"
  | "barrel"
  | "dispenser"
  | "dropper"
  | "lectern"
  | "beacon"
  | "villager_trade"
  | "merchant"
  | "horse"
  | "smithing_table"

export class Window {
  id: number
  type: WindowType
  title: string
  slots: Map<number, SlotData>
  state: number

  constructor(id: number, type: WindowType, title: string, slotCount: number) {
    this.id = id
    this.type = type
    this.title = title
    this.slots = new Map()
    this.state = 0
    for (let i = 0; i < slotCount; i++) {
      this.slots.set(i, { index: i, item: ItemStack.Empty })
    }
  }

  setSlot(index: number, item: ItemStack): void {
    this.slots.set(index, { index, item })
  }

  getSlot(index: number): ItemStack {
    return this.slots.get(index)?.item ?? ItemStack.Empty
  }

  clear(): void {
    for (const [index] of this.slots) {
      this.slots.set(index, { index, item: ItemStack.Empty })
    }
  }
}
