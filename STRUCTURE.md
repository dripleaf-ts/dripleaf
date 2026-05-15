# Dripleaf monorepo structure

TypeScript Minecraft **26.1** bot ecosystem (protocol **775**), inspired by [Azalea](https://github.com/azalea-rs/azalea).

## Packages

| Package | Replaces | Purpose |
|---------|----------|---------|
| `dripleaf` | mineflayer | Bot `Client` + plugins |
| `@dripleaf/protocol` | node-minecraft-protocol | Packets, `Connection` |
| `@dripleaf/nbt` | prismarine-nbt | NBT |
| `@dripleaf/chat` | prismarine-chat | Chat components |
| `@dripleaf/inventory` | prismarine-window | Windows, items |
| `@dripleaf/block` | prismarine-block | Block state registry |
| `@dripleaf/world` | prismarine-world | Chunks, `World` |
| `@dripleaf/entity` | prismarine-entity | Entity metadata |
| `@dripleaf/registry` | prismarine-registry | Identifiers, registries, tags |
| `@dripleaf/physics` | azalea-physics (concepts) | Block passability for movement |
| `@dripleaf/pathfinder` | azalea pathfinder | A* over loaded chunks |
| `@dripleaf/core` | — | Shared types (`BlockPos`, etc.) |
| `@dripleaf/item` / `@dripleaf/recipe` | — | Generated game data |

## Setup

```bash
pnpm install
git submodule update --init --recursive   # azalea/, codegen/azalea-burger/
bun run codegen                           # packets, registries, embedded package data
```

Codegen downloads the 26.1 server JAR into `codegen/cache/` (gitignored). Outputs are committed `.ts` files inside packages (Azalea-style).

## Local server

```bash
docker compose up -d    # Paper 26.1 on :25565 (offline mode)
bun run example:bot
```

## Scripts

- `bun run codegen` — regenerate protocol packets and registries from 26.1 JAR
- `bun test` — unit tests (NBT, registry, world, pathfinder, inventory)
- `scripts/clone-references.sh` — shallow-clone PrismarineJS repos into `references/`
- `bun run test:smoke` — live server smoke (`REAL_SERVER_HOST`)

## Codegen

| Script | Output |
|--------|--------|
| `codegen/generate_packets.ts` | `packages/protocol/src/packets/` |
| `codegen/generate_registries.ts` | `packages/registry/src/builtin.ts`, `data.ts` |
| `codegen/generate_tags.ts` | `packages/registry/src/tags/` |
| `codegen/generate_data_components.ts` | `packages/inventory/.../generated.ts` |
| `codegen/generate_blocks.ts` | `packages/block/src/states.generated.ts` |
| `codegen/generate_recipes.ts` | `packages/recipe/src/data.generated.ts` |
