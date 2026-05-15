import { ItemType } from "@dripleaf/registry"
import { DEFAULT_ITEM_COMPONENTS, type RawDefaultItemComponentMap } from "@dripleaf/inventory"

export { ItemType }

export type ItemComponents = RawDefaultItemComponentMap

export class ItemData {
  constructor(
    public readonly type: ItemType,
    public readonly components: ItemComponents,
  ) {}
}

export class ItemRegistry {
  static #instance: ItemRegistry | undefined

  private constructor() {}

  static getInstance(): ItemRegistry {
    if (!ItemRegistry.#instance)
      ItemRegistry.#instance = new ItemRegistry()
    return ItemRegistry.#instance
  }

  getItem(type: ItemType): ItemData | undefined {
    const components = DEFAULT_ITEM_COMPONENTS[type]
    if (!components || Object.keys(components).length === 0)
      return undefined
    return new ItemData(type, components)
  }

  getItemTypes(): ItemType[] {
    return Object.values(ItemType)
  }

  getComponents(type: ItemType): ItemComponents | undefined {
    return this.getItem(type)?.components
  }
}

export function getItemData(type: ItemType): ItemData | undefined {
  return ItemRegistry.getInstance().getItem(type)
}

export function getItemComponents(type: ItemType): ItemComponents | undefined {
  return ItemRegistry.getInstance().getComponents(type)
}
