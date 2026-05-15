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
}
