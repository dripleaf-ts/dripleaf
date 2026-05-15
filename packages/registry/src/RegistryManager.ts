import type { UnnamedNbtTag } from "@dripleaf/nbt"
import { Registry } from "./Registry"

export type RegistryDataEntry = {
  entryId: string
  data: UnnamedNbtTag | null
}

export type TagEntry = {
  tagName: string
  values: number[]
}

export type TaggedRegistryEntry = {
  registry: string
  tags: TagEntry[]
}

export class RegistryManager {
  readonly registries = new Map<string, Registry<string, UnnamedNbtTag | null>>()
  readonly tags = new Map<string, Map<string, number[]>>()

  applyRegistryData(registryId: string, entries: RegistryDataEntry[]): void {
    const registry = new Registry<string, UnnamedNbtTag | null>(registryId)
    for (let protocolId = 0; protocolId < entries.length; protocolId++) {
      const entry = entries[protocolId]!
      registry.register(entry.entryId, protocolId, entry.data)
    }
    this.registries.set(registryId, registry)
  }

  applyUpdateTags(registries: TaggedRegistryEntry[]): void {
    for (const { registry, tags } of registries) {
      const tagMap = new Map<string, number[]>()
      for (const tag of tags)
        tagMap.set(tag.tagName, [...tag.values])
      this.tags.set(registry, tagMap)
    }
  }

  getRegistry(registryId: string): Registry<string, UnnamedNbtTag | null> | undefined {
    return this.registries.get(registryId)
  }

  getTag(registryId: string, tagName: string): readonly number[] | undefined {
    return this.tags.get(registryId)?.get(tagName)
  }

  hasTag(registryId: string, tagName: string): boolean {
    return this.tags.get(registryId)?.has(tagName) ?? false
  }

  protocolId(registryId: string, entry: string | number): number | undefined {
    if (typeof entry === "number")
      return Number.isInteger(entry) ? entry : undefined
    return this.registries.get(registryId)?.resolveProtocolId(stripMinecraftNamespace(entry))
  }

  entryId(registryId: string, protocolId: number): string | undefined {
    return this.registries.get(registryId)?.getByProtocolId(protocolId)?.key
  }

  blockStateId(block: string | number): number | undefined {
    return this.protocolId("minecraft:block", block)
  }

  itemId(item: string | number): number | undefined {
    return this.protocolId("minecraft:item", item)
  }

  isInTag(registryId: string, tagName: string, entry: string | number): boolean {
    const protocolId = this.protocolId(registryId, entry)
    if (protocolId === undefined) return false
    return this.tags.get(registryId)?.get(tagName)?.includes(protocolId) ?? false
  }
}

function stripMinecraftNamespace(entry: string): string {
  return entry.startsWith("minecraft:") ? entry.slice("minecraft:".length) : entry
}
