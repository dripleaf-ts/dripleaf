# Session notes

- Target: MC 26.1, protocol 775
- API style: Azalea-inspired plugins, not mineflayer-compat
- Auth: offline only for now
- Implementation order: keep-alive → registry sync → world chunk helpers → Client plugins
- Done (2026-05-15): Phase 0 docs, RegistryManager, world getBiome/parseChunkSections, Client plugins, smoke test
- Done: codegen cache (`codegen/cache/`), block/recipe/item data embedded in packages (no runtime `generated/`)
