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

export type LpVec3 = {
  x: number;
  y: number;
  z: number;
}

export type Position = {
  x: number;
  y: number;
  z: number;
}

export type GameProfile = {
  id: string;
  name: string;
  properties: {
    name: string;
    value: string;
    signature?: string | null;
  }[]; 
}
