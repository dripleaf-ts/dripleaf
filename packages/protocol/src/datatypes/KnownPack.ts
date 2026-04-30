import type { PacketReader, PacketWriter } from "../buffer";

export class KnownPack {
  public namespace: string;
  public id: string;
  public version: string;

  constructor({
    namespace = "minecraft",
    id, 
    version
  }: {
    namespace?: string;
    id: string;
    version: string;
  }) {
    this.namespace = namespace;
    this.id = id;
    this.version = version;
  }

  write(writer: PacketWriter) {
    writer.writeString(this.namespace);
    writer.writeString(this.id);
    writer.writeString(this.version);
  }

  static read(reader: PacketReader): KnownPack {
    const namespace = reader.readString();
    const id = reader.readString();
    const version = reader.readString();
    return new KnownPack({ namespace, id, version });
  }
}