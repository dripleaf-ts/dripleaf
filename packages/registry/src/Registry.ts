import { Identifier } from "./identifier";

export type EnumLike<TEntry extends string> = Record<string, TEntry>;

export type RegistryEntry<TEntry extends string, TData = undefined> = Readonly<{
  key: TEntry;
  protocolId: number;
  data: TData | undefined;
}>;

type MutableRegistryEntry<TEntry extends string, TData> = {
  key: TEntry;
  protocolId: number;
  data: TData | undefined;
};

export class Registry<TEntry extends string, TData = undefined> {
  readonly #name: string;
  readonly #namespace: string;
  readonly #entriesByKey = new Map<TEntry, MutableRegistryEntry<TEntry, TData>>();
  readonly #entriesByProtocolId = new Map<number, MutableRegistryEntry<TEntry, TData>>();

  constructor(name: string, namespace = "minecraft") {
    this.#name = name;
    this.#namespace = name.includes(":") ? Identifier.from(name).namespace() : namespace;
  }

  static fromEnum<TEntry extends string>(name: string, enumObject: EnumLike<TEntry>): Registry<TEntry> {
    const registry = new Registry<TEntry>(name);
    for (const [protocolId, key] of Object.values(enumObject).entries())
      registry.register(key, protocolId);
    return registry;
  }

  get name(): string {
    return this.#name;
  }

  get namespace(): string {
    return this.#namespace;
  }

  register(
    key: TEntry,
    protocolId: number,
    data?: TData,
  ): this {
    const existingByKey = this.#entriesByKey.get(key);
    const existingByProtocolId = this.#entriesByProtocolId.get(protocolId);

    if (existingByKey && existingByKey.protocolId !== protocolId) {
      throw new Error(`Registry ${this.#name} already registered ${String(key)} with protocol id ${existingByKey.protocolId}`);
    }
    if (existingByProtocolId && existingByProtocolId.key !== key) {
      throw new Error(`Registry ${this.#name} already uses protocol id ${protocolId} for ${String(existingByProtocolId.key)}`);
    }

    const entry = existingByKey ?? {
      key,
      protocolId,
      data,
    };

    entry.protocolId = protocolId;
    if (data !== undefined)
      entry.data = data;

    this.#entriesByKey.set(key, entry);
    this.#entriesByProtocolId.set(protocolId, entry);
    return this;
  }

  registerData(key: TEntry, data: TData): this {
    const entry = this.#entriesByKey.get(key);
    if (!entry)
      throw new Error(`Registry ${this.#name} has no entry for ${String(key)}`);

    entry.data = data;
    return this;
  }

  has(key: TEntry): boolean {
    return this.#entriesByKey.has(key);
  }

  get(key: TEntry): RegistryEntry<TEntry, TData> | undefined {
    return this.#entriesByKey.get(key);
  }

  getByProtocolId(protocolId: number): RegistryEntry<TEntry, TData> | undefined {
    return this.#entriesByProtocolId.get(protocolId);
  }

  getByIdentifier(identifier: string | Identifier): RegistryEntry<TEntry, TData> | undefined {
    const normalizedIdentifier = Identifier.from(identifier);
    if (normalizedIdentifier.namespace() !== this.#namespace)
      return undefined;

    return this.#entriesByKey.get(normalizedIdentifier.path() as TEntry);
  }

  resolveEntry(value: TEntry | number): TEntry | undefined {
    if (typeof value === "number")
      return this.#entriesByProtocolId.get(value)?.key;

    return this.#entriesByKey.has(value)
      ? value
      : undefined;
  }

  resolveProtocolId(value: TEntry | number): number | undefined {
    if (typeof value === "number")
      return Number.isInteger(value) ? value : undefined;

    return this.#entriesByKey.get(value)?.protocolId;
  }

  resolveIdentifier(value: TEntry | number | string | Identifier): Identifier | undefined {
    if (typeof value === "number") {
      const key = this.#entriesByProtocolId.get(value)?.key;
      return key === undefined ? undefined : this.identifier(key);
    }

    if (typeof value === "string" && !this.#entriesByKey.has(value as TEntry))
      return this.getByIdentifier(value) ? Identifier.from(value) : undefined;

    const key = this.#entriesByKey.get(value as TEntry)?.key;
    return key === undefined ? undefined : this.identifier(key);
  }

  getData(value: TEntry | number): TData | undefined {
    if (typeof value === "number")
      return this.#entriesByProtocolId.get(value)?.data;

    return this.#entriesByKey.get(value)?.data;
  }

  entries(): IterableIterator<RegistryEntry<TEntry, TData>> {
    return this.#entriesByKey.values();
  }

  identifier(key: TEntry): Identifier {
    return new Identifier(`${this.#namespace}:${key}`);
  }

  identifierString(key: TEntry): string {
    return `${this.#namespace}:${key}`;
  }
}

export function createRegistry<TEntry extends string, TData = undefined>(
  name: string,
  entries: Iterable<readonly [TEntry, number, TData?]>,
  namespace?: string,
): Registry<TEntry, TData> {
  const registry = new Registry<TEntry, TData>(name, namespace);
  for (const [key, protocolId, data] of entries)
    registry.register(key, protocolId, data);
  return registry;
}

export function createRegistryFromEnum<TEntry extends string>(
  name: string,
  enumObject: EnumLike<TEntry>,
): Registry<TEntry> {
  return Registry.fromEnum(name, enumObject);
}