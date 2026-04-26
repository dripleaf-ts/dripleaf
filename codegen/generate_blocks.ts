import path from "node:path";
import { getBurgerData } from "./util/burger";
import { downloadClientJar } from "./util/download";
import { getGeneratedHeader } from "./util/generated";

const blocksFile = Bun.file("packages/registry/src/blocks.ts");
const outputs = [getGeneratedHeader(path.relative(process.cwd(), import.meta.path))];

const clientJar = await Bun.file("tmp/client-26.1.jar").exists() ? "tmp/client-26.1.jar" : await downloadClientJar("tmp", "26.1");
const burgerData = await getBurgerData(clientJar);

outputs.push("enum BlockKind {");
for (const [key, value] of Object.entries(burgerData.blocks.block_fields)) {
  outputs.push(`  ${key} = "${value}",`);
}
outputs.push("}");
outputs.push("");
outputs.push("export { BlockKind };");

await Bun.write(blocksFile, outputs.join('\n'));
console.log(`Generated blocks.ts`);
