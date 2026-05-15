import type { ClientPlugin } from "./types"
import { ConnectionPlugin } from "./ConnectionPlugin"
import { KeepAlivePlugin } from "./KeepAlivePlugin"
import { ConfigurationPlugin } from "./ConfigurationPlugin"
import { PlayPlugin } from "./PlayPlugin"
import { WorldPlugin } from "./WorldPlugin"
import { EntityPlugin } from "./EntityPlugin"
import { InventoryPlugin } from "./InventoryPlugin"
import { MiningPlugin } from "./MiningPlugin"
import { PathfinderPlugin } from "./PathfinderPlugin"
import { TickPlugin } from "./TickPlugin"

export const defaultPlugins: ClientPlugin[] = [
  new KeepAlivePlugin(),
  new ConfigurationPlugin(),
  new PlayPlugin(),
  new WorldPlugin(),
  new EntityPlugin(),
  new InventoryPlugin(),
  new MiningPlugin(),
  new PathfinderPlugin(),
  new TickPlugin(),
]

export {
  ConnectionPlugin,
  KeepAlivePlugin,
  ConfigurationPlugin,
  PlayPlugin,
  WorldPlugin,
  EntityPlugin,
  InventoryPlugin,
  MiningPlugin,
  PathfinderPlugin,
  TickPlugin,
}
export { goto, stopPathfinding } from "./PathfinderPlugin"
export { startMining, finishMining, stopMining } from "./MiningPlugin"
export type { ClientPlugin } from "./types"
