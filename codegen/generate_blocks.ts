import path from "node:path"
import { BlockType } from "../packages/registry/src/builtin"
import { downloadServerJar, generateDataFromServerJar } from "./util/download"
import { getReport } from "./util/download"
import { getGeneratedHeader } from "./util/generated"

const OUTPUT = "packages/block/src/states.generated.ts"

type BlockReportState = {
  id: number
  properties: Record<string, string>
}

type BlockReportEntry = {
  properties: Record<string, string[]>
  states: BlockReportState[]
}

function buildTypeLookup(): Record<string, BlockType> {
  const lookup: Record<string, BlockType> = {}
  for (const value of Object.values(BlockType))
    lookup[value as string] = value as BlockType
  return lookup
}

function parsePropertyValue(value: string): string | boolean | number {
  if (value === "true") return true
  if (value === "false") return false
  const num = Number(value)
  if (!Number.isNaN(num) && value !== "") return num
  return value
}

function stringifyProperties(properties: Record<string, string | boolean | number>): string {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return "{}"
  const inner = entries.map(([k, v]) =>
    typeof v === "string" ? `${JSON.stringify(k)}: ${JSON.stringify(v)}` : `${JSON.stringify(k)}: ${v}`,
  ).join(", ")
  return `{ ${inner} }`
}

const jar = await downloadServerJar()
await generateDataFromServerJar(jar)
const blocks = await getReport(jar, "blocks") as Record<string, BlockReportEntry>
const typeLookup = buildTypeLookup()

const blockStatesEntries: string[] = []
const blockPropertyDefs: string[] = []

for (const [key, entry] of Object.entries(blocks)) {
  const blockName = key.startsWith("minecraft:") ? key.slice(10) : key
  const blockType = typeLookup[blockName]
  if (blockType === undefined) continue

  const enumName = Object.entries(BlockType).find(([, v]) => v === blockType)?.[0]
  if (!enumName) continue

  const stateEntries: string[] = []
  for (const state of entry.states) {
    const properties: Record<string, string | boolean | number> = {}
    for (const [propKey, propValue] of Object.entries(state.properties ?? {}))
      properties[propKey] = parsePropertyValue(propValue)

    stateEntries.push(
      `\t\t{ id: ${state.id}, properties: ${stringifyProperties(properties)} },`,
    )
  }

  const propDefEntries = Object.entries(entry.properties ?? {})
    .map(([propKey, variants]) =>
      `\t\t${JSON.stringify(propKey)}: [${variants.map(v => JSON.stringify(v)).join(", ")}],`,
    )
    .join("\n")

  blockPropertyDefs.push(
    `\t[BlockType.${enumName}]: {\n${propDefEntries}\n\t},`,
  )
  blockStatesEntries.push(
    `\t[BlockType.${enumName}]: [\n${stateEntries.join("\n")}\n\t],`,
  )
}

const lines = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)).trimEnd(),
  "",
  'import { BlockType } from "@dripleaf/registry"',
  "",
  "export type GeneratedBlockProperties = Record<string, string | boolean | number>",
  "",
  "export type GeneratedStateEntry = {",
  "\tid: number",
  "\tproperties: GeneratedBlockProperties",
  "}",
  "",
  "export const BLOCK_PROPERTY_DEFS: Partial<Record<BlockType, Record<string, readonly string[]>>> = {",
  ...blockPropertyDefs,
  "}",
  "",
  "export const BLOCK_STATES: Partial<Record<BlockType, readonly GeneratedStateEntry[]>> = {",
  ...blockStatesEntries,
  "}",
  "",
  "export const STATE_BY_ID = new Map<number, { type: BlockType; properties: GeneratedBlockProperties }>()",
  "",
  "for (const [type, states] of Object.entries(BLOCK_STATES) as Array<[BlockType, readonly GeneratedStateEntry[]]>) {",
  "\tfor (const state of states)",
  "\t\tSTATE_BY_ID.set(state.id, { type, properties: state.properties })",
  "}",
  "",
]

await Bun.write(OUTPUT, lines.join("\n"))
console.log(`Generated ${OUTPUT}`)
