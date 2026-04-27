import type { Direction, State } from "./types";

export abstract class GlowstonePacket {
  abstract readonly id: number;
  abstract readonly state: State;
  abstract readonly direction: Direction;

  abstract serialize(): Uint8Array | Promise<Uint8Array>;
  static deserialize(bytes: Uint8Array): GlowstonePacket | Promise<GlowstonePacket> {
    throw new Error("not implemented");
  };
}