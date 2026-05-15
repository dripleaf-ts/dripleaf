import { readdir } from "node:fs/promises"
import path from "node:path"
import { dataPath } from "./cache"

export async function getDataRegistries() {
  const registries: Record<string, string[]> = {}

  async function addEntriesInDir(registryPath: string) {
    try {
      const dir = dataPath(registryPath)
      const files = await readdir(dir)
      const entries = files
        .filter(f => f.endsWith(".json"))
        .map(f => f.slice(0, -5))
      if (entries.length)
        registries[registryPath] = entries
    } catch {}
  }

  let baseEntries: string[] = []
  try {
    baseEntries = await readdir(dataPath())
  } catch {
    return registries
  }

  await Promise.all(baseEntries.map(name => addEntriesInDir(name)))
  await addEntriesInDir(path.join("worldgen", "biome"))

  return registries
}
