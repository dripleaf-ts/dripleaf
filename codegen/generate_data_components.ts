import path from "node:path";
import { readdir } from "node:fs/promises";
import { DataComponentType, ItemType } from "../packages/registry/src/index";
import { downloadServerJar, generateDataFromServerJar } from "./util/download";
import { reportSubPath } from "./util/cache";
import { getGeneratedHeader } from "./util/generated";
import { identifierToPath } from "./util/misc";

const REPORTS_DIR = reportSubPath("minecraft", "components", "item");
const OUTPUT_FILE = "packages/inventory/src/default_components/generated.ts";

const serverJar = await downloadServerJar();
await generateDataFromServerJar(serverJar);

const itemTypeNames = new Map<string, string>(Object.entries(ItemType).map(([name, value]) => [value, name]));
const dataComponentNames = new Map<string, string>(Object.entries(DataComponentType).map(([name, value]) => [value, name]));

const reportFiles = new Set(await readdir(REPORTS_DIR));

function stringifyValue(value: unknown, indentLevel: number): string[] {
  const json = JSON.stringify(value, null, 2);
  if (json === undefined)
    return ["undefined"];

  const indent = "\t".repeat(indentLevel);
  return json.split("\n").map(line => `${indent}${line}`);
}

const typeImportNames = Object.keys(DataComponentType);
const lines = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)).trimEnd(),
  "",
  'import { DataComponentType, ItemType } from "@dripleaf/registry";',
  `import type { ${typeImportNames.join(", ")} } from "./index";`,
  "",
  "export type DefaultItemComponentKind = DataComponentType;",
  "",
  "export interface DefaultItemComponentTypes {",
  ...Object.keys(DataComponentType).map(name => `\t[DataComponentType.${name}]: ${name};`),
  "}",
  "",
  "export type DefaultItemComponentMap = Partial<{ [TComponent in DefaultItemComponentKind]: DefaultItemComponentTypes[TComponent] }>;",
  "",
  "export type RawDefaultItemComponentMap = Partial<Record<DefaultItemComponentKind, unknown>>;",
  "",
  "export const DEFAULT_ITEM_COMPONENTS: Partial<Record<ItemType, RawDefaultItemComponentMap>> = {",
];

for (const itemPath of Object.values(ItemType)) {
  const reportFile = itemPath + ".json";
  if (!reportFiles.has(reportFile)) continue;

  const itemName = itemTypeNames.get(itemPath);
  if (itemName === undefined) continue;

  const report = await Bun.file(`${REPORTS_DIR}/${reportFile}`).json() as {
    components?: Record<string, unknown>;
  };
  const components = report.components ?? {};
  const componentEntries = Object.entries(components);
  if (componentEntries.length === 0) continue;

  lines.push(`\t[ItemType.${itemName}]: {`);

  for (const [componentIdentifier, componentValue] of componentEntries) {
    const componentPath = identifierToPath(componentIdentifier);
    const componentName = dataComponentNames.get(componentPath);
    if (!componentName) continue;

    const valueLines = stringifyValue(componentValue, 2);
    const [firstLine, ...remainingLines] = valueLines;
    if (!firstLine) continue;

    if (remainingLines.length === 0) {
      lines.push(`\t\t[DataComponentType.${componentName}]: ${firstLine.trim()},`);
      continue;
    }

    lines.push(`\t\t[DataComponentType.${componentName}]: ${firstLine.trim()}`);
    lines.push(...remainingLines);
    lines[lines.length - 1] += ",";
  }

  lines.push("\t},");
}

lines.push("};");
lines.push("");

await Bun.write(OUTPUT_FILE, lines.join("\n"));
console.log(`Generated ${OUTPUT_FILE}`);
