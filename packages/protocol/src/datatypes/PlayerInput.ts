import { codec, type PacketReader, type PacketWriter } from "../buffer";

function packFlags(value: PlayerInput): number {
  return (value.forward ? 1 : 0)
    | (value.backward ? 2 : 0)
    | (value.left ? 4 : 0)
    | (value.right ? 8 : 0)
    | (value.jump ? 16 : 0)
    | (value.shift ? 32 : 0)
    | (value.sprint ? 64 : 0);
}

export class PlayerInput {
  static readonly codec = codec<PlayerInput>({
    encode(writer: PacketWriter, value: PlayerInput) {
      writer.writeByte(packFlags(value));
    },
    decode(reader: PacketReader): PlayerInput {
      const flags = reader.readByte();
      return new PlayerInput(
        (flags & 1) !== 0,
        (flags & 2) !== 0,
        (flags & 4) !== 0,
        (flags & 8) !== 0,
        (flags & 16) !== 0,
        (flags & 32) !== 0,
        (flags & 64) !== 0,
      );
    },
  });

  constructor(
    public forward: boolean,
    public backward: boolean,
    public left: boolean,
    public right: boolean,
    public jump: boolean,
    public shift: boolean,
    public sprint: boolean,
  ) {}
}
