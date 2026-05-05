import { DimensionType, Identifier } from "@dripleaf/registry";
import { codec, Codecs, type PacketReader, type PacketWriter } from "../buffer";
import { GameType } from "./GameType";
import { GlobalPos } from "./GlobalPos";

export class CommonPlayerSpawnInfo {
  static readonly codec = codec(CommonPlayerSpawnInfo, {
    dimensionType: Codecs.varIntEnum(DimensionType),
    dimension: Codecs.identifier,
    seed: Codecs.long,
    gameType: Codecs.byteEnum(GameType),
    previousGameType: codec<GameType | null>({
      encode(writer: PacketWriter, value: GameType | null) {
        writer.writeByte(value !== null ? value : -1);
      },
      decode(reader: PacketReader): GameType | null {
        const byte = reader.readByte();
        return byte !== -1 ? (byte as GameType) : null;
      },
    }),
    isDebug: Codecs.bool,
    isFlat: Codecs.bool,
    lastDeathLocation: Codecs.prefixedOptional(GlobalPos.codec),
    portalCooldown: Codecs.varInt,
    seaLevel: Codecs.varInt,  
  });

  constructor(
    public dimensionType: DimensionType,
    public dimension: string | Identifier,
    public seed: bigint,
    public gameType: GameType,
    public previousGameType: GameType | null,
    public isDebug: boolean,
    public isFlat: boolean,
    public lastDeathLocation: GlobalPos | null,
    public portalCooldown: number,
    public seaLevel: number
  ) {}
}