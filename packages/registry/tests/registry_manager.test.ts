import { describe, expect, test } from "bun:test"
import { RegistryManager } from "../src/RegistryManager"

describe("RegistryManager", () => {
  test("applyRegistryData assigns protocol ids by order", () => {
    const manager = new RegistryManager()
    manager.applyRegistryData("minecraft:block", [
      { entryId: "stone", data: null },
      { entryId: "dirt", data: null },
    ])
    const registry = manager.getRegistry("minecraft:block")
    expect(registry?.getByProtocolId(0)?.key).toBe("stone")
    expect(registry?.getByProtocolId(1)?.key).toBe("dirt")
  })

  test("applyUpdateTags stores tag values", () => {
    const manager = new RegistryManager()
    manager.applyUpdateTags([{
      registry: "minecraft:block",
      tags: [{ tagName: "minecraft:logs", values: [1, 2, 3] }],
    }])
    expect(manager.getTag("minecraft:block", "minecraft:logs")).toEqual([1, 2, 3])
    expect(manager.hasTag("minecraft:block", "minecraft:logs")).toBe(true)
  })
})
