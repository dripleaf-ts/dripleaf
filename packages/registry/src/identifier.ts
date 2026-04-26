const DEFAULT_NAMESPACE = "minecraft";

export class Identifier {
  readonly #value: string;
  readonly #colonIndex: number;

  constructor(resourceString: string) {
    let normalized = resourceString;
    let colonIndex = normalized.indexOf(":");

    if (colonIndex === 0) {
      normalized = normalized.slice(1);
      colonIndex = -1;
    }

    this.#value = normalized;
    this.#colonIndex = colonIndex;
  }

  namespace(): string {
    if (this.#colonIndex === -1) return DEFAULT_NAMESPACE;
    return this.#value.slice(0, this.#colonIndex);
  }

  path(): string {
    if (this.#colonIndex === -1) return this.#value;
    return this.#value.slice(this.#colonIndex + 1);
  }

  equals(other: Identifier): boolean {
    return this.namespace() === other.namespace() && this.path() === other.path();
  }

  toString(): string {
    if (this.#colonIndex === -1) return `${DEFAULT_NAMESPACE}:${this.#value}`;
    return this.#value;
  }

  static from(resourceString: string | Identifier): Identifier {
    if (resourceString instanceof Identifier) return resourceString;
    return new Identifier(resourceString);
  }
}
