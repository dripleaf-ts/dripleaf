import type { ChatComponent } from "./index"
import { append, text, translate } from "./index"

export class MessageBuilder {
  #parts: ChatComponent[] = []

  append(component: ChatComponent): this {
    this.#parts.push(component)
    return this
  }

  text(value: string): this {
    return this.append(text(value))
  }

  trans(key: string, args: Array<string | number | ChatComponent> = []): this {
    return this.append(translate(key, args))
  }

  build(): ChatComponent {
    if (this.#parts.length === 0) return ""
    if (this.#parts.length === 1) return this.#parts[0]!
    return this.#parts.reduce((acc, part) => append(acc, part))
  }
}
