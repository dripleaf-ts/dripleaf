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