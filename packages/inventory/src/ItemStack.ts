import { ItemType } from "@dripleaf/registry"

export type ItemKind = ItemType | number

export type DataComponentPatch = Record<string, unknown>

export type ItemStackDataInit = {
	kind: ItemKind
	count: number
	component_patch?: DataComponentPatch
}

export class ItemStackData {
	kind: ItemKind
	count: number
	component_patch: DataComponentPatch

	constructor(item: ItemKind, count: number, componentPatch: DataComponentPatch = {}) {
		this.kind = item
		this.count = count
		this.component_patch = componentPatch
	}

	static new(item: ItemKind, count: number): ItemStackData {
		return new ItemStackData(item, count)
	}

	static from(item: ItemKind): ItemStackData {
		return new ItemStackData(item, 1)
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

	getComponent<T>(): T | undefined {
		return undefined
	}

	withComponent<T>(_component: T): this {
		return this
	}
}

export type ItemStackInit =
	| {
		type: "empty"
	}
	| {
		type: "present"
		item: ItemStackData
	}

export class ItemStack {
	readonly type: "empty" | "present"
	readonly item?: ItemStackData

	private constructor(init: ItemStackInit) {
		this.type = init.type
		if (init.type === "present") this.item = init.item
	}

	static Empty = new ItemStack({ type: "empty" })

	static Present(item: ItemStackData): ItemStack {
		return new ItemStack({ type: "present", item })
	}

	static new(item: ItemKind, count: number): ItemStack {
		const stack = ItemStack.Present(ItemStackData.new(item, count))
		return stack.updateEmpty()
	}

	static from(item: ItemKind): ItemStack {
		return ItemStack.new(item, 1)
	}

	isEmpty(): boolean {
		return this.type === "empty" || this.item?.isEmpty() === true
	}

	isPresent(): boolean {
		return !this.isEmpty()
	}

	count(): number {
		return this.type === "present" ? this.item?.count ?? 0 : 0
	}

	split(count: number): ItemStack {
		if (this.type === "empty" || !this.item) return ItemStack.Empty
		const returning = this.item.split(count)
		return this.item.isEmpty() ? ItemStack.Empty : ItemStack.Present(returning)
	}

	kind(): ItemKind {
		return this.type === "present" && this.item ? this.item.kind : ItemType.Air
	}

	updateEmpty(): ItemStack {
		if (this.type === "present" && this.item?.isEmpty()) return ItemStack.Empty
		return this
	}

	asPresent(): ItemStackData | undefined {
		return this.type === "present" ? this.item : undefined
	}

	asPresentMut(): ItemStackData | undefined {
		return this.asPresent()
	}

	componentPatch(): DataComponentPatch {
		return this.asPresent()?.component_patch ?? {}
	}

	withComponent<T>(_component: T): ItemStack {
		return this
	}
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
