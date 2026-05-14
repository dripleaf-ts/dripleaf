import { BlockType, BlockTypeRegistry } from "@dripleaf/registry"

export { BlockType, BlockTypeRegistry }

export type BlockState = number

export type BlockPropertyValue = string | number | boolean

export type BlockProperties = Record<string, BlockPropertyValue>

export function blockTypeFromState(state: BlockState): BlockType | undefined {
  return BlockTypeRegistry.getByProtocolId(state)?.key
}

export function blockStateFromType(type: BlockType): BlockState | undefined {
  return BlockTypeRegistry.resolveProtocolId(type)
}

export type BlockData = {
  type: BlockType
  properties: BlockProperties
}
