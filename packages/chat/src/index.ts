import { NbtTagType, type NbtCompound, type NbtValue, type UnnamedNbtTag } from "@dripleaf/nbt"

export type ChatPrimitive = string | number | boolean | null

export type ClickEvent = {
  action: "open_url" | "open_file" | "run_command" | "suggest_command" | "change_page" | "copy_to_clipboard"
  value: string
}

export type HoverEvent =
  | { action: "show_text"; contents: ChatComponent }
  | { action: "show_item"; contents: { id: string; count?: number; components?: Record<string, unknown> } }
  | { action: "show_entity"; contents: { type: string; id: string; name?: ChatComponent } }

export type ChatComponent =
  | string
  | {
    text?: string
    translate?: string
    with?: Array<ChatPrimitive | ChatComponent>
    extra?: ChatComponent[]
    color?: string
    font?: string
    bold?: boolean
    italic?: boolean
    underlined?: boolean
    strikethrough?: boolean
    obfuscated?: boolean
    insertion?: string
    clickEvent?: ClickEvent
    hoverEvent?: HoverEvent
    fallback?: string
    reset?: boolean
  }

export type FormattedText = ChatComponent

export function text(value: string): ChatComponent {
  return { text: value }
}

export function translate(key: string, args: Array<ChatPrimitive | ChatComponent> = []): ChatComponent {
  return { translate: key, with: args }
}

export function append(base: ChatComponent, ...extra: ChatComponent[]): ChatComponent {
  if (typeof base === "string") return { text: base, extra }
  return { ...base, extra: [...(base.extra ?? []), ...extra] }
}

export function serialize(component: ChatComponent): string {
  return JSON.stringify(component)
}

export function deserialize(json: string): ChatComponent {
  return JSON.parse(json) as ChatComponent
}

function toNbtValue(value: ChatPrimitive | ChatComponent): NbtValue {
  if (value === null) return "" as NbtValue
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value as NbtValue
  return componentToCompound(value)
}

function componentToCompound(component: ChatComponent): NbtCompound {
  if (typeof component === "string") return { text: component as NbtValue }
  const compound: NbtCompound = {}
  if (component.text !== undefined) compound.text = component.text as NbtValue
  if (component.translate !== undefined) compound.translate = component.translate as NbtValue
  if (component.with !== undefined) compound.with = (component.with as ChatComponent[]).map(toNbtValue) as NbtValue
  if (component.extra !== undefined) compound.extra = component.extra.map(componentToCompound) as unknown as NbtValue
  if (component.color !== undefined) compound.color = component.color as NbtValue
  if (component.font !== undefined) compound.font = component.font as NbtValue
  if (component.bold !== undefined) compound.bold = (component.bold ? 1 : 0) as NbtValue
  if (component.italic !== undefined) compound.italic = (component.italic ? 1 : 0) as NbtValue
  if (component.underlined !== undefined) compound.underlined = (component.underlined ? 1 : 0) as NbtValue
  if (component.strikethrough !== undefined) compound.strikethrough = (component.strikethrough ? 1 : 0) as NbtValue
  if (component.obfuscated !== undefined) compound.obfuscated = (component.obfuscated ? 1 : 0) as NbtValue
  if (component.insertion !== undefined) compound.insertion = component.insertion as NbtValue
  if (component.fallback !== undefined) compound.fallback = component.fallback as NbtValue
  if (component.reset !== undefined) compound.reset = (component.reset ? 1 : 0) as NbtValue
  if (component.clickEvent !== undefined) {
    compound.clickEvent = {
      action: component.clickEvent.action as NbtValue,
      value: component.clickEvent.value as NbtValue,
    } as NbtValue
  }
  if (component.hoverEvent !== undefined) {
    const hover: NbtCompound = { action: component.hoverEvent.action as NbtValue }
    if (component.hoverEvent.action === "show_text") {
      hover.contents = componentToCompound(component.hoverEvent.contents) as NbtValue
    } else if (component.hoverEvent.action === "show_item") {
      const item: NbtCompound = { id: component.hoverEvent.contents.id as NbtValue }
      if (component.hoverEvent.contents.count !== undefined) item.count = component.hoverEvent.contents.count as NbtValue
      hover.contents = item as NbtValue
    } else if (component.hoverEvent.action === "show_entity") {
      hover.contents = {
        type: component.hoverEvent.contents.type as NbtValue,
        id: component.hoverEvent.contents.id as NbtValue,
        name: component.hoverEvent.contents.name ? componentToCompound(component.hoverEvent.contents.name) : undefined,
      } as NbtValue
    }
    compound.hoverEvent = hover as NbtValue
  }
  return compound
}

export function toNbt(component: ChatComponent): UnnamedNbtTag {
  if (typeof component === "string") {
    return { type: NbtTagType.Compound, value: { text: component } }
  }
  return { type: NbtTagType.Compound, value: componentToCompound(component) }
}

function fromNbtValue(value: NbtValue): unknown {
  if (typeof value === "string") return value
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map(v => fromNbtValue(v as NbtValue))
  if (value instanceof Uint8Array) return ""
  if (typeof value === "object") {
    if ("elementType" in value && "items" in value) {
      return (value as any).items.map((v: NbtValue) => fromNbtValue(v))
    }
    return fromNbtCompound(value as NbtCompound)
  }
  return ""
}

function fromNbtCompound(compound: NbtCompound): ChatComponent {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(compound)) {
    if (key === "text" || key === "translate" || key === "color" || key === "font" || key === "insertion" || key === "fallback") {
      result[key] = typeof value === "string" ? value : String(value)
    } else if (key === "bold" || key === "italic" || key === "underlined" || key === "strikethrough" || key === "obfuscated" || key === "reset") {
      result[key] = typeof value === "number" ? value !== 0 : Boolean(value)
    } else if (key === "with") {
      const arr = Array.isArray(value) ? value : []
      result.with = arr.map(v => fromNbtValue(v as NbtValue))
    } else if (key === "extra") {
      const arr = Array.isArray(value) ? value : []
      result.extra = arr.map(v => fromNbtCompound(v as unknown as NbtCompound))
    } else if (key === "clickEvent") {
      const ce = value as NbtCompound
      result.clickEvent = {
        action: String(ce.action ?? ""),
        value: String(ce.value ?? ""),
      }
    } else if (key === "hoverEvent") {
      const he = value as NbtCompound
      const action = String(he.action ?? "")
      if (action === "show_text") {
        result.hoverEvent = { action, contents: fromNbtCompound(he.contents as NbtCompound) }
      } else if (action === "show_item") {
        const contents = he.contents as NbtCompound
        result.hoverEvent = {
          action,
          contents: {
            id: String(contents.id ?? ""),
            count: typeof contents.count === "number" ? contents.count : undefined,
          },
        }
      } else if (action === "show_entity") {
        const contents = he.contents as NbtCompound
        result.hoverEvent = {
          action,
          contents: {
            type: String(contents.type ?? ""),
            id: String(contents.id ?? ""),
            name: contents.name ? fromNbtCompound(contents.name as unknown as NbtCompound) : undefined,
          },
        }
      }
    }
  }
  return result as ChatComponent
}

export function fromNbt(nbt: UnnamedNbtTag): ChatComponent {
  if (nbt.type !== NbtTagType.Compound) return ""
  return fromNbtCompound(nbt.value as NbtCompound)
}

function extractText(component: ChatComponent): string {
  if (typeof component === "string") return component
  let result = component.text ?? ""
  if (component.extra) {
    for (const child of component.extra)
      result += extractText(child)
  }
  if (component.translate && !component.text) {
    result += component.translate
  }
  return result
}

export function toPlainText(component: ChatComponent): string {
  return extractText(component)
}

export function chatComponentFromNbt(nbt: UnnamedNbtTag): string {
  return toPlainText(fromNbt(nbt))
}
