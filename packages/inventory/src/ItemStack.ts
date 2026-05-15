import { DataComponentType, ItemType } from "@dripleaf/registry"

export type ItemKind = ItemType

export type DataComponentPatch = Record<string, unknown>

export class ItemStackData {
	kind: ItemType
	count: number
	component_patch: DataComponentPatch

	constructor(kind: ItemType, count: number, componentPatch: DataComponentPatch = {}) {
		this.kind = kind
		this.count = count
		this.component_patch = componentPatch
	}

	static new(kind: ItemType, count: number): ItemStackData {
		return new ItemStackData(kind, count)
	}

	static from(kind: ItemType): ItemStackData {
		return new ItemStackData(kind, 1)
	}

	isEmpty(): boolean {
		return this.count <= 0 || this.kind === ItemType.Air
	}

	split(count: number): ItemStackData {
		const returningCount = Math.min(count, this.count)
		this.count -= returningCount
		return new ItemStackData(this.kind, returningCount, { ...this.component_patch })
	}

	isSameItemAndComponents(other: ItemStackData): boolean {
		return this.kind === other.kind && shallowEqual(this.component_patch, other.component_patch)
	}

	getComponent<T>(key: DataComponentType): T | undefined {
		return this.component_patch[key] as T | undefined
	}

	withComponent<T>(key: DataComponentType, value: T): this {
		this.component_patch[key] = value as unknown
		return this
	}
}

export type ItemStack =
	| { type: "empty" }
	| { type: "present"; item: ItemStackData }

export const ItemStack = {
	Empty: { type: "empty" } as const,
	Present(item: ItemStackData): ItemStack {
		return item.isEmpty() ? ItemStack.Empty : { type: "present", item }
	},
	new(kind: ItemType, count: number): ItemStack {
		return ItemStack.Present(ItemStackData.new(kind, count))
	},
	from(kind: ItemType): ItemStack {
		return ItemStack.new(kind, 1)
	},
}

function shallowEqual(left: DataComponentPatch, right: DataComponentPatch): boolean {
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)
	if (leftKeys.length !== rightKeys.length) return false
	for (const key of leftKeys) {
		if (!Object.is(left[key], right[key])) return false
	}
	return true
}
