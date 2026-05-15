import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { ItemType } from "@dripleaf/registry"

export { ItemType }

export type ItemComponents = Record<string, any>

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const COMPONENTS_DIR = resolve(__dirname, "../../../generated/reports/minecraft/components/item")

function buildItemTypeLookup(): Record<string, ItemType> {
  const lookup: Record<string, ItemType> = {}
  for (const value of Object.values(ItemType)) {
    lookup[value as string] = value as ItemType
  }
  return lookup
}

function loadItemComponents(itemName: string): ItemComponents | undefined {
  try {
    const path = resolve(COMPONENTS_DIR, `${itemName}.json`)
    return JSON.parse(readFileSync(path, "utf-8")).components
  } catch {
    return undefined
  }
}

export class ItemData {
  constructor(
    public readonly type: ItemType,
    public readonly components: ItemComponents,
  ) {}
}

export class ItemRegistry {
  static #instance: ItemRegistry | undefined
  #itemTypes: ItemType[] | undefined
  #typeLookup: Record<string, ItemType> | undefined
  #cache: Map<ItemType, ItemComponents> = new Map()

  private constructor() {}

  static getInstance(): ItemRegistry {
    if (!ItemRegistry.#instance) {
      ItemRegistry.#instance = new ItemRegistry()
    }
    return ItemRegistry.#instance
  }

  #getTypeLookup(): Record<string, ItemType> {
    if (!this.#typeLookup) {
      this.#typeLookup = buildItemTypeLookup()
    }
    return this.#typeLookup
  }

  getItem(type: ItemType): ItemData | undefined {
    let components = this.#cache.get(type)
    if (components === undefined) {
      components = loadItemComponents(type as string)
      if (components) {
        this.#cache.set(type, components)
      }
    }
    if (!components) return undefined
    return new ItemData(type, components)
  }

  getItemTypes(): ItemType[] {
    if (this.#itemTypes) return this.#itemTypes
    // Since we have many, perhaps load all or assume all enum values
    // For now, return all enum values
    this.#itemTypes = Object.values(ItemType)
    return this.#itemTypes
  }

  getComponents(type: ItemType): ItemComponents | undefined {
    const item = this.getItem(type)
    return item?.components
  }
}

export function getItemData(type: ItemType): ItemData | undefined {
  return ItemRegistry.getInstance().getItem(type)
}

export function getItemComponents(type: ItemType): ItemComponents | undefined {
  return ItemRegistry.getInstance().getComponents(type)
}