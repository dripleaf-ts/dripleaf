#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="$ROOT/references"
mkdir -p "$REF"

clone() {
  local name="$1"
  local url="$2"
  if [ -d "$REF/$name" ]; then
    echo "skip $name (exists)"
    return
  fi
  git clone --depth 1 "$url" "$REF/$name"
}

clone mineflayer https://github.com/PrismarineJS/mineflayer.git
clone node-minecraft-protocol https://github.com/PrismarineJS/node-minecraft-protocol.git
clone prismarine-nbt https://github.com/PrismarineJS/prismarine-nbt.git
clone prismarine-chat https://github.com/PrismarineJS/prismarine-chat.git
clone prismarine-window https://github.com/PrismarineJS/prismarine-window.git
clone prismarine-block https://github.com/PrismarineJS/prismarine-block.git
clone prismarine-world https://github.com/PrismarineJS/prismarine-world.git
clone prismarine-chunk https://github.com/PrismarineJS/prismarine-chunk.git
clone prismarine-entity https://github.com/PrismarineJS/prismarine-entity.git
clone prismarine-physics https://github.com/PrismarineJS/prismarine-physics.git
clone prismarine-item https://github.com/PrismarineJS/prismarine-item.git
clone prismarine-registry https://github.com/PrismarineJS/prismarine-registry.git

echo "done: references in $REF"
