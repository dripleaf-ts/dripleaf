import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { generateDataFromServerJar } from "./download"
import { dataPath } from "./cache"
import { identifierToPath, registryNameToEnumName, toPascalCase } from "./misc"
import { getGeneratedHeader } from "./generated"

export async function getRegistryTags(jar: string, name: string) {
  await generateDataFromServerJar(jar)
  const tagDir = dataPath("tags", name)

  if (!existsSync(tagDir)) return {}
  const tags: Record<string, { values: string[] }> = {}
  const files = (await readdir(tagDir, { recursive: true })).sort()
  for (const file of files) {
    if (file && file.endsWith(".json"))
      tags[file.replace(".json", "")] = await Bun.file(path.join(tagDir, file)).json()
  }
  return tags
}

const TAGS_DIRECTORY_PATH = "packages/registry/src/tags"

export async function generateTag(
  tags: Record<string, { values: string[] }>,
  fileName: string,
  registryName: string,
) {
  console.log(`Generating tags for ${registryName}...`)
  const outputFile = `${TAGS_DIRECTORY_PATH}/${fileName}.ts`
  const enumClass = registryNameToEnumName(registryName)
  const outputs = [
    getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
    `import { ${enumClass} } from "../builtin";\n`,
  ]
  const arrayNames = new Set<string>()

  for (const [tagName, tag] of Object.entries(tags).sort(([left], [right]) => left.localeCompare(right))) {
    const entries: string[] = []
    const queue = [...tag.values]

    while (queue.length) {
      const identifier = queue.shift()!
      if (identifier.startsWith("#")) {
        const nested = identifierToPath(identifier.slice(1))
        const nestedTag = nested ? tags[nested] : undefined
        if (nestedTag) queue.push(...nestedTag.values)
        continue
      }
      const entry = identifierToPath(identifier)
      if (entry) entries.push(entry)
    }

    const arrayName = toPascalCase(tagName.replaceAll("/", "_"))
    if (arrayNames.has(arrayName)) {
      console.warn(`Duplicate array name ${arrayName} for tag ${tagName}, skipping...`)
      continue
    }
    arrayNames.add(arrayName)
    outputs.push(`const ${arrayName} = [`)
    for (const entry of entries)
      outputs.push(`\t${enumClass}.${toPascalCase(entry)},`)
    outputs.push(`] as const;\n`)
  }

  outputs.push(`export { ${[...arrayNames].join(", ")} };`)
  await Bun.write(outputFile, outputs.join("\n"))
}
