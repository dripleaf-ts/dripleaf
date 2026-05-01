import path from "node:path";
import { downloadServerJar, generateDataFromServerJar, getReport } from "./util/download";
import { getGeneratedHeader } from "./util/generated";
import { registryNameToEnumName, toPascalCase } from "./util/misc";

const builtinFile = Bun.file("packages/registry/src/builtin.ts");
const outputs = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
  'import { Registry } from "./Registry";',
  "",
];

const serverJar = await downloadServerJar("generated", "26.1");
await generateDataFromServerJar(serverJar);

const registriesReport = await getReport(serverJar, "registries");
const exports = [];

for (const [registryId, registry] of Object.entries(registriesReport) as [string, any][]) {
  const registryName = registryNameToEnumName(registryId.replace("minecraft:", ""));
  const registryConstName = `${registryName}Registry`;
  const registryEntries = (Object.entries(registry.entries) as [string, { protocol_id: number }][])
    .sort((left, right) => left[1].protocol_id - right[1].protocol_id);
  console.log(`Generating registry: ${registryName}`);
  exports.push(registryName, registryConstName);
  outputs.push(`enum ${registryName} {`);
  for (const [identifier] of registryEntries) {
    const path = identifier.replace("minecraft:", "");
    outputs.push(`\t${toPascalCase(path)} = "${path}",`);
  }
  outputs.push(`}`);
  outputs.push("");
  outputs.push(`const ${registryConstName} = Registry.fromEnum<${registryName}>(${JSON.stringify(registryId)}, ${registryName});`);
  outputs.push("");
}
outputs.push(`export { ${exports.join(", ")} };`);

await Bun.write(builtinFile, outputs.join('\n'));
console.log(`Generated builtin.ts`);
