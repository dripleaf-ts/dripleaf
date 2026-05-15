import path from "node:path";
import { downloadServerJar, generateDataFromServerJar, getReport } from "./util/download";
import { getGeneratedHeader } from "./util/generated";
import { registryNameToEnumName, toPascalCase, toSnakeCase } from "./util/misc";
import { getDataRegistries } from "./util/registry";

const serverJar = await downloadServerJar();
await generateDataFromServerJar(serverJar);

const builtinFile = Bun.file("packages/registry/src/builtin.ts");
const builtinOutputs = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
  'import { Registry } from "./Registry";',
  "",
];
const builtinExports = [];
const registriesReport = await getReport(serverJar, "registries");

for (const [registryId, registry] of Object.entries(registriesReport) as [string, any][]) {
  const registryName = registryNameToEnumName(registryId.replace("minecraft:", ""));
  const registryConstName = `${registryName}Registry`;
  const registryEntries = (Object.entries(registry.entries) as [string, { protocol_id: number }][])
  .sort((left, right) => left[1].protocol_id - right[1].protocol_id);
  console.log(`Generating registry: ${registryName}`);
  builtinExports.push(registryName, registryConstName);
  builtinOutputs.push(`enum ${registryName} {`);
  for (const [identifier] of registryEntries) {
    const path = identifier.replace("minecraft:", "");
    builtinOutputs.push(`\t${toPascalCase(path)} = "${path}",`);
  }
  builtinOutputs.push(`}`);
  builtinOutputs.push("");
  builtinOutputs.push(`const ${registryConstName} = Registry.fromEnum<${registryName}>(${JSON.stringify(registryId)}, ${registryName});`);
  builtinOutputs.push("");
}
builtinOutputs.push(`export { ${builtinExports.join(", ")} };`);

await builtinFile.write(builtinOutputs.join('\n'));
console.log(`Generated builtin.ts`);

const dataFile = Bun.file("packages/registry/src/data.ts");
const dataOutputs = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
  'import { Registry } from "./Registry";',
  "",
];
const dataExports = [];
const dataRegistries = await getDataRegistries();

for (const [registryPath, entries] of Object.entries(dataRegistries)) {
  const registryName = registryNameToEnumName(toSnakeCase(registryPath));
  const registryConstName = `${registryName}Registry`;
  console.log(`Generating data registry: ${registryName}`);
  dataExports.push(registryName, registryConstName);
  dataOutputs.push(`enum ${registryName} {`);
  for (const entry of entries) {
    dataOutputs.push(`\t${toPascalCase(entry)} = "${entry}",`);
  }
  dataOutputs.push(`}`);
  dataOutputs.push("");
  dataOutputs.push(`const ${registryConstName} = Registry.fromEnum<${registryName}>(${JSON.stringify(registryPath)}, ${registryName});`);
  dataOutputs.push("");
}
dataOutputs.push(`export { ${dataExports.join(", ")} };`);

await dataFile.write(dataOutputs.join('\n'));
console.log(`Generated data.ts`);