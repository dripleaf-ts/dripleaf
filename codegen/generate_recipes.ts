import path from "node:path"
import { readdir } from "node:fs/promises"
import { Recipe } from "../packages/registry/src/data"
import { downloadServerJar, generateDataFromServerJar } from "./util/download"
import { dataPath } from "./util/cache"
import { getGeneratedHeader } from "./util/generated"

const OUTPUT = "packages/recipe/src/data.generated.ts"

function stringifyValue(value: unknown, indentLevel: number): string[] {
  const json = JSON.stringify(value, null, 2)
  if (json === undefined) return ["undefined"]
  const indent = "\t".repeat(indentLevel)
  return json.split("\n").map(line => `${indent}${line}`)
}

const jar = await downloadServerJar()
await generateDataFromServerJar(jar)

const recipeDir = dataPath("recipe")
const recipeNames = new Map<string, string>(
  Object.entries(Recipe).map(([name, value]) => [value as string, name]),
)

const files = await readdir(recipeDir)
const lines = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)).trimEnd(),
  "",
  'import { Recipe } from "@dripleaf/registry"',
  "",
  "export type RecipeData = Record<string, unknown>",
  "",
  "export const RECIPE_DATA: Partial<Record<Recipe, RecipeData>> = {",
]

let count = 0
for (const file of files) {
  if (!file.endsWith(".json")) continue
  const recipePath = file.slice(0, -5)
  const enumName = recipeNames.get(recipePath)
  if (!enumName) continue

  const data = await Bun.file(path.join(recipeDir, file)).json()
  const valueLines = stringifyValue(data, 1)
  const [firstLine, ...rest] = valueLines
  if (!firstLine) continue

  if (rest.length === 0) {
    lines.push(`\t[Recipe.${enumName}]: ${firstLine.trim()},`)
  } else {
    lines.push(`\t[Recipe.${enumName}]: ${firstLine.trim()}`)
    lines.push(...rest)
    lines[lines.length - 1] += ","
  }
  count++
}

lines.push("}")
lines.push("")

await Bun.write(OUTPUT, lines.join("\n"))
console.log(`Generated ${OUTPUT} (${count} recipes)`)
