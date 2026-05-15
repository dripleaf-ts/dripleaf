import type { BlockPos } from "@dripleaf/core"
import { isPassableAt, isStandableAt, type PhysicsWorld } from "@dripleaf/physics"

export type PathNode = BlockPos

export interface Goal {
  heuristic(n: PathNode): number
  success(n: PathNode): boolean
}

export type PathEdge = {
  to: PathNode
  cost: number
}

export type PathResult = {
  nodes: PathNode[]
  cost: number
  partial: boolean
}

const SPRINT_COST = 20 / 5.612
const WALK_COST = 20 / 4.317
const JUMP_PENALTY = 2

const CARDINALS = [
  { dx: 0, dz: -1 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: -1, dz: 0 },
] as const

export function blockPosGoal(target: BlockPos): Goal {
  return {
    heuristic: (n) => Math.abs(n.x - target.x) + Math.abs(n.y - target.y) + Math.abs(n.z - target.z),
    success: (n) => n.x === target.x && n.y === target.y && n.z === target.z,
  }
}

function posKey(p: BlockPos): string {
  return `${p.x},${p.y},${p.z}`
}

export function feetBlockFromPosition(p: { x: number; y: number; z: number }): BlockPos {
  return {
    x: Math.floor(p.x),
    y: Math.floor(p.y + 0.5),
    z: Math.floor(p.z),
  }
}

function basicSuccessors(world: PhysicsWorld, pos: PathNode): PathEdge[] {
  const edges: PathEdge[] = []
  for (const { dx, dz } of CARDINALS) {
    const next = { x: pos.x + dx, y: pos.y, z: pos.z + dz }
    if (!isStandableAt(world, next)) continue
    edges.push({ to: next, cost: SPRINT_COST })

    const up = { x: next.x, y: next.y + 1, z: next.z }
    if (isStandableAt(world, up))
      edges.push({ to: up, cost: WALK_COST + JUMP_PENALTY })

    const down = { x: next.x, y: next.y - 1, z: next.z }
    if (isStandableAt(world, down))
      edges.push({ to: down, cost: WALK_COST })
  }
  return edges
}

export function findPath(
  start: PathNode,
  goal: Goal,
  world: PhysicsWorld,
  maxIterations = 10_000,
): PathResult {
  const open = new Map<string, { pos: PathNode; f: number; g: number }>()
  const closed = new Set<string>()
  const cameFrom = new Map<string, { pos: PathNode; cost: number }>()
  const startKey = posKey(start)

  open.set(startKey, { pos: start, f: goal.heuristic(start), g: 0 })

  let bestNode = start
  let bestHeuristic = goal.heuristic(start)
  let iterations = 0

  while (open.size > 0 && iterations++ < maxIterations) {
    let currentKey: string | null = null
    let currentEntry: { pos: PathNode; f: number; g: number } | null = null
    for (const [key, entry] of open) {
      if (!currentEntry || entry.f < currentEntry.f) {
        currentKey = key
        currentEntry = entry
      }
    }
    if (!currentKey || !currentEntry) break

    const current = currentEntry.pos
    open.delete(currentKey)
    if (closed.has(currentKey)) continue
    closed.add(currentKey)

    if (goal.success(current)) {
      const nodes = [current]
      let key = currentKey
      while (cameFrom.has(key)) {
        const prev = cameFrom.get(key)!
        nodes.unshift(prev.pos)
        key = posKey(prev.pos)
      }
      return { nodes, cost: currentEntry.g, partial: false }
    }

    const h = goal.heuristic(current)
    if (h < bestHeuristic) {
      bestHeuristic = h
      bestNode = current
    }

    for (const edge of basicSuccessors(world, current)) {
      const nextKey = posKey(edge.to)
      if (closed.has(nextKey)) continue
      const g = currentEntry.g + edge.cost
      const existing = open.get(nextKey)
      if (existing && existing.g <= g) continue

      open.set(nextKey, { pos: edge.to, g, f: g + goal.heuristic(edge.to) })
      cameFrom.set(nextKey, { pos: current, cost: edge.cost })
    }
  }

  const nodes = [bestNode]
  let key = posKey(bestNode)
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key)!
    nodes.unshift(prev.pos)
    key = posKey(prev.pos)
  }
  return { nodes, cost: 0, partial: true }
}

export class Pathfinder {
  #world: PhysicsWorld
  #path: PathResult | null = null
  #index = 0

  constructor(world: PhysicsWorld) {
    this.#world = world
  }

  goto(start: PathNode, target: BlockPos): PathResult {
    this.#path = findPath(start, blockPosGoal(target), this.#world)
    this.#index = 0
    return this.#path
  }

  stop(): void {
    this.#path = null
    this.#index = 0
  }

  get path(): PathResult | null {
    return this.#path
  }

  nextWaypoint(): PathNode | null {
    if (!this.#path || this.#index >= this.#path.nodes.length) return null
    return this.#path.nodes[this.#index]!
  }

  advance(): void {
    if (this.#path && this.#index < this.#path.nodes.length)
      this.#index++
  }

  isDone(): boolean {
    return !this.#path || this.#index >= this.#path.nodes.length
  }
}
