import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { downloadServerJar, getReport } from "./util/download";
import {
  identifierToPath,
  toPascalCase,
  toSnakeCase,
  upperCaseFirst
} from "./util/misc";
import { getGeneratedHeader } from "./util/generated";
import { rm } from "node:fs/promises";

const shouldWipe = process.argv.includes("--wipe");
if (shouldWipe) console.log("Wiping existing packet files...");

const VERSION = "26.1";
const serverJar = await downloadServerJar("generated", VERSION);

const packetsReport = await getReport(serverJar, "packets");

const PACKETS_DIR_PATH = "packages/protocol/src/packets";

const stateImports = [];
const stateClientboundPackets = [];
const stateServerboundPackets = [];
const rootPacketExports = new Map<string, { state: string; fileStem: string; duplicate: boolean }>();

for (const state in packetsReport) {
  const STATE_DIR_PATH = path.join(PACKETS_DIR_PATH, state);

  if (existsSync(STATE_DIR_PATH) && shouldWipe) await rm(STATE_DIR_PATH, { recursive: true });
  if (!existsSync(STATE_DIR_PATH)) await mkdir(STATE_DIR_PATH, { recursive: true });

  const packetEntriesBySide = {
    clientbound: Object.entries(packetsReport[state].clientbound ?? {}) as [string, { protocol_id: number }][],
    serverbound: Object.entries(packetsReport[state].serverbound ?? {}) as [string, { protocol_id: number }][],
  };

  packetEntriesBySide.clientbound.sort((left, right) => left[1].protocol_id - right[1].protocol_id);
  packetEntriesBySide.serverbound.sort((left, right) => left[1].protocol_id - right[1].protocol_id);

  const clientboundPacketNames: string[] = [];
  const serverboundPacketNames: string[] = [];
  const stateIndexOutput = [
    getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
  ];

  for (const side of ["clientbound", "serverbound"] as const) {
    for (const [packetName, { protocol_id: packetId }] of packetEntriesBySide[side]) {
      const packetPathPart = identifierToPath(packetName)!;

      const fileStem = `${side[0]!.toLowerCase()}_${toSnakeCase(packetPathPart)}_packet`;

      const packetFilePath = path.join(STATE_DIR_PATH, `${fileStem}.ts`);

      const packetClassName = `${upperCaseFirst(side)}${toPascalCase(packetPathPart)}Packet`;

      if (!existsSync(packetFilePath)) {
        const output = [
          getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
          "import { PacketReader, PacketWriter } from '../../buffer';",
          "import { DripleafPacket, packetCodec } from '../DripleafPacket';",
          "",
          `export class ${packetClassName} extends DripleafPacket {`,
          `\tstatic readonly codec = packetCodec(${packetClassName}, {`,
          "\t\t// todo",
          "\t});",
          "",
          "\tconstructor(",
          "\t\t// todo",
          "\t) {",
          "\t\tsuper();",
          "\t}",
          "}",
        ];

        await Bun.write(packetFilePath, output.join("\n"));

        console.log(`Generated packet ${packetClassName} in state ${state} (${side})`);
      }

      stateIndexOutput.push(`export * from './${fileStem}';`);
      const existingRootExport = rootPacketExports.get(packetClassName);
      if (existingRootExport)
        existingRootExport.duplicate = true;
      else
        rootPacketExports.set(packetClassName, { state, fileStem, duplicate: false });

      if (side === "clientbound") {
        clientboundPacketNames.push(packetClassName);
      } else {
        serverboundPacketNames.push(packetClassName);
      }
    }
  }

  await Bun.write(path.join(STATE_DIR_PATH, "index.ts"),stateIndexOutput.join("\n"));

  stateImports.push(`import * as ${state} from './${state}';`);
  stateClientboundPackets.push(`const ${state}ClientboundPackets = [${clientboundPacketNames.map(name => `${state}.${name}`).join(", ")}] as const;`);
  stateServerboundPackets.push(`const ${state}ServerboundPackets = [${serverboundPacketNames.map(name => `${state}.${name}`).join(", ")}] as const;`);
}

const rootIndexOutput = [
  getGeneratedHeader(path.relative(process.cwd(), import.meta.path)),
  "import { PacketRegistry } from '../registry/PacketRegistry';",
  "import { State } from '../types';",
  "",
  ...stateImports,
  "",
  ...[...rootPacketExports]
    .filter(([, entry]) => !entry.duplicate)
    .map(([packetClassName, entry]) => `export { ${packetClassName} } from './${entry.state}/${entry.fileStem}';`),
  "",
  ...stateClientboundPackets,
  ...stateServerboundPackets,
  "",
  "const packetRegistry = new PacketRegistry();",
  "",
  ...Object.keys(packetsReport).flatMap(state => [
    `packetRegistry.register(State.${upperCaseFirst(state)}, ${state}ClientboundPackets, ${state}ServerboundPackets);`,
  ]),
  "",
  `export { packetRegistry, ${Object.keys(packetsReport).join(", ")} };`
];

await Bun.write(path.join(PACKETS_DIR_PATH, "index.ts"), rootIndexOutput.join("\n"));
