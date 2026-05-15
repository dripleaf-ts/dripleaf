import { existsSync } from "node:fs"
import { rm, cp, mkdir } from "node:fs/promises"
import {
  CODEGEN_CACHE_DIR,
  generatedRoot,
  hasGeneratedData,
  reportPath,
  serverJarPath,
  MINECRAFT_VERSION,
} from "./cache"

const VERSION_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"

type VersionManifest = {
  latest: { release: string; snapshot: string }
  versions: {
    id: string
    type: string
    url: string
    time: string
    releaseTime: string
    sha1: string
    complianceLevel: number
  }[]
}

export async function getVersionManifest() {
  const response = await fetch(VERSION_MANIFEST)
  if (!response.ok)
    throw new Error(`Failed to download version manifest: ${response.status} ${response.statusText}`)
  return await response.json() as VersionManifest
}

export async function getVersionMeta(version: string) {
  const manifest = await getVersionManifest()
  const versionInfo = manifest.versions.find(v => v.id === version)
  if (!versionInfo)
    throw new Error(`Version ${version} not found in manifest`)
  const response = await fetch(versionInfo.url)
  if (!response.ok)
    throw new Error(`Failed to download version metadata for ${version}: ${response.status} ${response.statusText}`)
  return await response.json() as { downloads: { server: { url: string }; client: { url: string } } }
}

export async function downloadClientJar(version = MINECRAFT_VERSION) {
  const filename = serverJarPath(version).replace("server-", "client-")
  if (!await Bun.file(filename).exists()) {
    await mkdir(CODEGEN_CACHE_DIR, { recursive: true })
    const meta = await getVersionMeta(version)
    const res = await fetch(meta.downloads.client.url)
    await Bun.write(filename, await res.arrayBuffer())
  }
  return filename
}

export async function downloadServerJar(_unused?: string, version = MINECRAFT_VERSION) {
  const filename = serverJarPath(version)
  if (!await Bun.file(filename).exists()) {
    await mkdir(CODEGEN_CACHE_DIR, { recursive: true })
    const meta = await getVersionMeta(version)
    const res = await fetch(meta.downloads.server.url)
    await Bun.write(filename, await res.arrayBuffer())
  }
  return filename
}

export async function generateDataFromServerJar(jar: string, version = MINECRAFT_VERSION) {
  if (!await Bun.file(jar).exists())
    throw new Error(`Server jar ${jar} does not exist`)

  if (hasGeneratedData(version)) return

  // migrate legacy `generated/` layout if present
  if (existsSync("generated/data") && existsSync("generated/reports")) {
    const root = generatedRoot(version)
    await mkdir(root, { recursive: true })
    await cp("generated/data", `${root}/data`, { recursive: true, force: true })
    await cp("generated/reports", `${root}/reports`, { recursive: true, force: true })
    return
  }

  const tmp = `${CODEGEN_CACHE_DIR}/tmp`
  if (existsSync(tmp)) await rm(tmp, { recursive: true })
  await mkdir(tmp, { recursive: true })

  await cp(jar, `${tmp}/server.jar`, { force: true })

  const outDir = generatedRoot(version)
  const process = Bun.spawn({
    cmd: ["java", "-DbundlerMainClass=net.minecraft.data.Main", "-jar", "server.jar", "--all", "--output", outDir],
    cwd: tmp,
  })

  const code = await process.exited
  if (code !== 0)
    throw new Error(`Data generation process exited with code ${code}`)

  await rm(tmp, { recursive: true })
}

export async function getReport(jar: string, name: string, version = MINECRAFT_VERSION) {
  await generateDataFromServerJar(jar, version)
  return await Bun.file(reportPath(name, version)).json()
}
