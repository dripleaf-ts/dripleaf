import { BlockType } from "@dripleaf/registry"
import {
  BLOCK_PROPERTY_DEFS,
  BLOCK_STATES,
  STATE_BY_ID,
  type GeneratedBlockProperties,
} from "./states.generated"

export { BlockType }

export type BlockState = number
export type BlockPropertyValue = string | boolean | number
export type BlockProperties = GeneratedBlockProperties

export class BlockData {
  constructor(
    public readonly type: BlockType,
    public readonly properties: BlockProperties,
    public readonly stateId: number,
  ) {}
}

export class BlockRegistry {
  static #instance: BlockRegistry | undefined

  private constructor() {}

  static getInstance(): BlockRegistry {
    if (!BlockRegistry.#instance)
      BlockRegistry.#instance = new BlockRegistry()
    return BlockRegistry.#instance
  }

  getBlock(stateId: number): BlockData | undefined {
    const entry = STATE_BY_ID.get(stateId)
    if (!entry) return undefined
    return new BlockData(entry.type, entry.properties, stateId)
  }

  getStateId(type: BlockType, properties: BlockProperties = {}): number | undefined {
    const states = BLOCK_STATES[type]
    if (!states?.length) return undefined

    const propKeys = Object.keys(properties)
    if (propKeys.length === 0)
      return states[0]?.id

    for (const state of states) {
      let match = true
      for (const [propKey, propValue] of Object.entries(properties)) {
        const stateValue = state.properties[propKey]
        if (stateValue === undefined || stateValue !== propValue) {
          match = false
          break
        }
      }
      if (match) return state.id
    }
    return undefined
  }

  getBlockTypes(): BlockType[] {
    return Object.keys(BLOCK_STATES) as BlockType[]
  }

  getProperties(type: BlockType): Record<string, string[]> {
    const defs = BLOCK_PROPERTY_DEFS[type]
    if (!defs) return {}
    return Object.fromEntries(
      Object.entries(defs).map(([key, values]) => [key, [...values]]),
    )
  }
}

export function stateToBlock(stateId: number): BlockData | undefined {
  return BlockRegistry.getInstance().getBlock(stateId)
}

export function blockToState(type: BlockType, properties?: BlockProperties): number {
  const stateId = BlockRegistry.getInstance().getStateId(type, properties ?? {})
  if (stateId === undefined)
    throw new Error(`No block state found for ${type as string}: ${JSON.stringify(properties)}`)
  return stateId
}

export function blockTypeFromState(state: BlockState): BlockType | undefined {
  return BlockRegistry.getInstance().getBlock(state)?.type
}
