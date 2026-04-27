import type { UUID } from "node:crypto";

export const PROTOCOL_VERSION = 775;
export const VERSION_NAME = "26.1";

export enum State {
  Handshake = "handshake",
  Configuration = "configuration",
  Play = "play",
  Status = "status",
  Login = "login",
}

export enum Direction {
  Serverbound = "serverbound",
  Clientbound = "clientbound",
}

export enum ClientIntention {
  Status = 1,
  Login = 2,
  Transfer = 3,
}

export type GameProfile = {
  id: UUID;
  name: string;
  properties: {
    name: string;
    value: string;
    signature?: string | null;
  }[]; 
}
