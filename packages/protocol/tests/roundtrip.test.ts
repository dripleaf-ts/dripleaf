import { describe, expect, test } from "bun:test"
import { Vec3 } from "vec3"
import { NbtTagType, type UnnamedNbtTag } from "@dripleaf/nbt"
import { BlockPos, CommonPlayerSpawnInfo, GameType, PositionMoveRotation } from "@dripleaf/core"
import { DimensionType, Identifier } from "@dripleaf/registry"
import {
  BlockFace,
  ClientIntention,
  InteractionHand,
  PacketReader,
  PacketWriter,
  configuration,
  handshake,
  login,
  play,
} from "../src/index"

function roundTrip<T>(codec: { encode(writer: PacketWriter, value: T): void; decode(reader: PacketReader): T }, value: T): T {
  const writer = new PacketWriter()
  codec.encode(writer, value)
  const reader = new PacketReader(writer.finish())
  const decoded = codec.decode(reader)
  expect(reader.remaining).toBe(0)
  return decoded
}

const textNbt = (value: string): UnnamedNbtTag => ({
  type: NbtTagType.Compound,
  value: { text: value },
})

describe("protocol packet round trips", () => {
  test("handshake serverbound intention", () => {
    const packet = new handshake.ServerboundIntentionPacket(775, "localhost", 25565, ClientIntention.Login)
    expect(roundTrip(handshake.ServerboundIntentionPacket.codec, packet)).toEqual(packet)
  })

  test("login packets", () => {
    const hello = new login.ServerboundHelloPacket("dripleaf", "00000000-0000-0000-0000-000000000001")
    expect(roundTrip(login.ServerboundHelloPacket.codec, hello)).toEqual(hello)

    const finished = new login.ClientboundLoginFinishedPacket({
      id: "00000000-0000-0000-0000-000000000001",
      name: "dripleaf",
      properties: [],
    })
    expect(roundTrip(login.ClientboundLoginFinishedPacket.codec, finished)).toEqual(finished)

    expect(roundTrip(login.ServerboundLoginAcknowledgedPacket.codec, new login.ServerboundLoginAcknowledgedPacket()))
      .toEqual(new login.ServerboundLoginAcknowledgedPacket())
  })

  test("configuration registry and tags packets", () => {
    const registryData = new configuration.ClientboundRegistryDataPacket("minecraft:dimension_type", [
      { entryId: "minecraft:overworld", data: textNbt("overworld") },
      { entryId: "minecraft:the_nether", data: null },
    ])
    expect(roundTrip(configuration.ClientboundRegistryDataPacket.codec, registryData)).toEqual(registryData)

    const updateTags = new configuration.ClientboundUpdateTagsPacket([
      {
        registry: "minecraft:block",
        tags: [{ tagName: "minecraft:logs", values: [1, 2, 3] }],
      },
    ])
    expect(roundTrip(configuration.ClientboundUpdateTagsPacket.codec, updateTags)).toEqual(updateTags)

    expect(roundTrip(configuration.ServerboundFinishConfigurationPacket.codec, new configuration.ServerboundFinishConfigurationPacket()))
      .toEqual(new configuration.ServerboundFinishConfigurationPacket())
  })

  test("play movement and acknowledgement packets", () => {
    expect(roundTrip(play.ClientboundKeepAlivePacket.codec, new play.ClientboundKeepAlivePacket(42n)))
      .toEqual(new play.ClientboundKeepAlivePacket(42n))
    expect(roundTrip(play.ServerboundKeepAlivePacket.codec, new play.ServerboundKeepAlivePacket(42n)))
      .toEqual(new play.ServerboundKeepAlivePacket(42n))
    expect(roundTrip(play.ServerboundAcceptTeleportationPacket.codec, new play.ServerboundAcceptTeleportationPacket(7)))
      .toEqual(new play.ServerboundAcceptTeleportationPacket(7))
    expect(roundTrip(play.ServerboundMovePlayerPosPacket.codec, new play.ServerboundMovePlayerPosPacket(1.5, 64, -2.5, true, false)))
      .toEqual(new play.ServerboundMovePlayerPosPacket(1.5, 64, -2.5, true, false))
    expect(roundTrip(play.ServerboundMovePlayerRotPacket.codec, new play.ServerboundMovePlayerRotPacket(90, 45, true, false)))
      .toEqual(new play.ServerboundMovePlayerRotPacket(90, 45, true, false))
    expect(roundTrip(play.ServerboundMovePlayerPosRotPacket.codec, new play.ServerboundMovePlayerPosRotPacket(1, 2, 3, 90, 45, true, true)))
      .toEqual(new play.ServerboundMovePlayerPosRotPacket(1, 2, 3, 90, 45, true, true))
  })

  test("play world and interaction packets", () => {
    const blockUpdate = new play.ClientboundBlockUpdatePacket(new BlockPos(1, 64, 2), 123)
    expect(roundTrip(play.ClientboundBlockUpdatePacket.codec, blockUpdate)).toEqual(blockUpdate)

    const chunk = new play.ClientboundLevelChunkWithLightPacket(
      0,
      0,
      { heightmaps: [], data: new Uint8Array(), blockEntities: [] },
      { skyYMask: [], blockYMask: [], emptySkyYMask: [], emptyBlockYMask: [], skyUpdates: [], blockUpdates: [] },
    )
    expect(roundTrip(play.ClientboundLevelChunkWithLightPacket.codec, chunk)).toEqual(chunk)

    expect(roundTrip(play.ServerboundChunkBatchReceivedPacket.codec, new play.ServerboundChunkBatchReceivedPacket(20)))
      .toEqual(new play.ServerboundChunkBatchReceivedPacket(20))
    expect(roundTrip(play.ServerboundSwingPacket.codec, new play.ServerboundSwingPacket(InteractionHand.MainHand)))
      .toEqual(new play.ServerboundSwingPacket(InteractionHand.MainHand))
    expect(roundTrip(play.ServerboundAttackPacket.codec, new play.ServerboundAttackPacket(55)))
      .toEqual(new play.ServerboundAttackPacket(55))

    const useItem = new play.ServerboundUseItemOnPacket(
      InteractionHand.MainHand,
      {
        blockPos: new BlockPos(1, 64, 2),
        direction: BlockFace.Up,
        location: new Vec3(0.5, 1, 0.5),
        inside: false,
        worldBorder: false,
      },
      9,
    )
    expect(roundTrip(play.ServerboundUseItemOnPacket.codec, useItem)).toEqual(useItem)
  })

  test("play login and player position packets", () => {
    const spawnInfo = new CommonPlayerSpawnInfo(
      DimensionType.Overworld,
      new Identifier("minecraft:overworld"),
      123n,
      GameType.Survival,
      null,
      false,
      false,
      null,
      0,
      63,
    )
    const loginPacket = new play.ClientboundLoginPacket(
      1,
      false,
      [new Identifier("minecraft:overworld")],
      100,
      10,
      10,
      false,
      true,
      false,
      spawnInfo,
      false,
    )
    expect(roundTrip(play.ClientboundLoginPacket.codec, loginPacket)).toEqual(loginPacket)

    const positionPacket = new play.ClientboundPlayerPositionPacket(
      3,
      new PositionMoveRotation(new Vec3(1, 2, 3), new Vec3(0, 0, 0), 90, 45),
      play.Relative.X | play.Relative.Yaw,
    )
    expect(roundTrip(play.ClientboundPlayerPositionPacket.codec, positionPacket)).toEqual(positionPacket)
  })
})
