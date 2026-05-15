import { existsSync } from "node:fs"
import path from "node:path"

export const CODEGEN_CACHE_DIR = "codegen/cache"
export const MINECRAFT_VERSION = "26.1"

export function serverJarPath(version = MINECRAFT_VERSION): string {
  return path.join(CODEGEN_CACHE_DIR, `server-${version}.jar`)
}

export function generatedRoot(version = MINECRAFT_VERSION): string {
  return path.join(CODEGEN_CACHE_DIR, `generated-${version}`)
}

export function reportPath(name: string, version = MINECRAFT_VERSION): string {
  return path.join(generatedRoot(version), "reports", `${name}.json`)
}

export function reportSubPath(...parts: string[]): string {
  return path.join(generatedRoot(MINECRAFT_VERSION), "reports", ...parts)
}

export function dataPath(...parts: string[]): string {
  return path.join(generatedRoot(MINECRAFT_VERSION), "data", "minecraft", ...parts)
}

export function hasGeneratedData(version = MINECRAFT_VERSION): boolean {
  const root = generatedRoot(version)
  return existsSync(path.join(root, "data")) && existsSync(path.join(root, "reports"))
}
