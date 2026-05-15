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

export enum InteractionHand {
  MainHand = 0,
  OffHand = 1,
}

export enum EntityAnchor {
  Feet = 0,
  Eyes = 1,
}

export enum BlockFace {
  Down = 0,
  Up = 1,
  North = 2,
  South = 3,
  West = 4,
  East = 5,
}
