import { appendFileSync, existsSync, mkdirSync } from "node:fs"
import { connect } from "node:net"
import { randomUUID } from "node:crypto"
import type { UUID } from "node:crypto"
import { Connection, State, ClientIntention, ChatVisibility, HumanoidArm, ParticleStatus, InteractionHand, BlockFace } from "./packages/protocol/src"
import * as handshake from "./packages/protocol/src/packets/handshake"
import * as login from "./packages/protocol/src/packets/login"
import * as play from "./packages/protocol/src/packets/play"
import * as configuration from "./packages/protocol/src/packets/configuration"
import { BlockPos, PlayerInput } from "@dripleaf/core"
import type { Vec3 } from "vec3"

const LOG_DIR = "/tmp/papermc/test_output"
const LOG_FILE = `${LOG_DIR}/edge_cases_${Date.now()}.log`
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

const decodedPackets = new Map<string, number>()
const allPackets: string[] = []

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  appendFileSync(LOG_FILE, line + "\n")
  console.log(line)
}

function logJson(name: string, obj: any) {
  const s = JSON.stringify(obj, (key, val) => typeof val === "bigint" ? val.toString() + "n" : val, 2)
  appendFileSync(LOG_FILE, `\n=== ${name} ===\n${s}\n`)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  log("=".repeat(70))
  log("DRIPLEAF COMPREHENSIVE TEST RUNNER")
  log("=".repeat(70))

  const HOST = "127.0.0.1"
  const PORT = 25565

  await new Promise<void>((resolve, reject) => {
    log(`Connecting to ${HOST}:${PORT}...`)
    const socket = connect(PORT, HOST, async () => {
      log("TCP connected!")
      const conn = new Connection(socket, false)
      let botSpawned = false

      conn.on("packet", (packet: any) => {
        const name = packet.constructor.name
        allPackets.push(name)
        decodedPackets.set(name, (decodedPackets.get(name) ?? 0) + 1)
      })

      conn.on("error", (err: Error) => {
        log(`CONN_ERROR: ${err.message}`)
      })

      conn.on("end", () => {
        log("Connection ended")
        resolve()
      })

      conn.on("state", (s: State) => log(`State: ${s}`))

      // ---- LOGIN PHASE ----

      conn.onPacket(login.ClientboundLoginCompressionPacket, (pkt: any) => {
        log(`Compression threshold: ${pkt.threshold}`)
        conn.setCompressionThreshold(pkt.threshold)
      })

      conn.onPacket(login.ClientboundLoginFinishedPacket, (pkt: any) => {
        log(`Login finished: ${pkt.profile.name} (${pkt.profile.id})`)
        conn.setState(State.Configuration)
        conn.write(new login.ServerboundLoginAcknowledgedPacket())
        conn.write(new configuration.ServerboundClientInformationPacket(
          "en_us", 24, ChatVisibility.Full, true, 0,
          HumanoidArm.Right, false, true, ParticleStatus.All,
        ))
      })

      conn.onPacket(login.ClientboundLoginDisconnectPacket, (pkt: any) => {
        log(`LOGIN DISCONNECT: ${JSON.stringify(pkt.reason)}`)
      })

      // ---- CONFIGURATION PHASE ----

      conn.onPacket(configuration.ClientboundFinishConfigurationPacket, () => {
        log("Configuration done -> Play")
        conn.write(new configuration.ServerboundFinishConfigurationPacket())
        conn.setState(State.Play)
      })

      conn.onPacket(configuration.ClientboundRegistryDataPacket, (pkt: any) => {
        log(`Registry data received`)
      })

      conn.onPacket(configuration.ClientboundUpdateTagsPacket, (pkt: any) => {
        log("Config UpdateTags received")
      })

      conn.onPacket(configuration.ClientboundKeepAlivePacket, (pkt: any) => {
        log(`Config KeepAlive: id=${pkt.keepAliveId}`)
        conn.write(new configuration.ServerboundKeepAlivePacket(pkt.keepAliveId))
      })

      conn.onPacket(configuration.ClientboundCustomPayloadPacket, (pkt: any) => {
        log(`Config custom payload: channel=${pkt.channel ? (typeof pkt.channel === 'object' ? pkt.channel.toString() : pkt.channel) : '?'} data=${pkt.data?.byteLength ?? 0} bytes`)
      })

      conn.onPacket(configuration.ClientboundResourcePackPushPacket, (pkt: any) => {
        log(`Resource pack push: ${pkt.url?.substring(0, 80)}`)
      })

      conn.onPacket(configuration.ClientboundSelectKnownPacksPacket, (pkt: any) => {
        log(`SelectKnownPacks: ${pkt.knownPacks?.length ?? 0} - sending empty response`)
        conn.write(new configuration.ServerboundSelectKnownPacksPacket([]))
      })

      conn.onPacket(configuration.ClientboundServerLinksPacket, (pkt: any) => {
        log(`ServerLinks: ${pkt.links?.length ?? 0}`)
      })

      conn.onPacket(configuration.ClientboundUpdateEnabledFeaturesPacket, (pkt: any) => {
        log(`EnabledFeatures: ${pkt.features?.length ?? 0}`)
      })

      conn.onPacket(configuration.ClientboundDisconnectPacket, (pkt: any) => {
        log(`CONFIG DISCONNECT: ${JSON.stringify(pkt.reason)}`)
      })

      // ---- PLAY PHASE ----

      conn.onPacket(play.ClientboundLoginPacket, (pkt: any) => {
        botSpawned = true
        log(`SPAWNED! eid=${pkt.entityId} gametype=${pkt.commonPlayerSpawnInfo?.gameType} dimension=${pkt.commonPlayerSpawnInfo?.dimensionType}`)
        logJson("ClientboundLoginPacket", pkt)
        conn.write(new play.ServerboundPlayerLoadedPacket())
      })

      conn.onPacket(play.ClientboundPlayerPositionPacket, (pkt: any) => {
        const pos = pkt.change?.position
        log(`Teleport id=${pkt.teleportId} pos=(${pos?.x}, ${pos?.y}, ${pos?.z})`)
        conn.write(new play.ServerboundAcceptTeleportationPacket(pkt.teleportId))
      })

      conn.onPacket(play.ClientboundKeepAlivePacket, (pkt: any) => {
        conn.write(new play.ServerboundKeepAlivePacket(pkt.keepAliveId))
      })

      conn.onPacket(play.ClientboundSystemChatPacket, (pkt: any) => {
        const content = JSON.stringify(pkt.content)
        log(`SystemChat: ${content.substring(0, 300)}`)
      })

      conn.onPacket(play.ClientboundDisconnectPacket, (pkt: any) => {
        log(`Play DISCONNECT: ${JSON.stringify(pkt.reason)}`)
      })

      conn.onPacket(play.ClientboundSetHealthPacket, (pkt: any) => {
        log(`Health: ${pkt.health} food=${pkt.food} saturation=${pkt.saturation}`)
      })

      conn.onPacket(play.ClientboundSetTimePacket, (pkt: any) => {
        log(`Time: ${pkt.gameTime}`)
      })

      conn.onPacket(play.ClientboundPlayerInfoUpdatePacket, (pkt: any) => {
        log(`PlayerInfoUpdate: ${pkt.entries?.length ?? 0} entries`)
      })

      conn.onPacket(play.ClientboundCommandsPacket, (pkt: any) => {
        log(`Commands: root node received`)
        logJson("CommandsPacket(partial)", { root: pkt.root?.toString()?.substring(0, 200) })
      })

      conn.onPacket(play.ClientboundGameEventPacket, (pkt: any) => {
        log(`GameEvent: ${pkt.event} value=${pkt.value}`)
      })

      conn.onPacket(play.ClientboundAddEntityPacket, (pkt: any) => {
        log(`AddEntity: type=${pkt.type} id=${pkt.entityId} pos=(${pkt.x},${pkt.y},${pkt.z})`)
      })

      conn.onPacket(play.ClientboundSetEntityDataPacket, (pkt: any) => {
        log(`SetEntityData: id=${pkt.entityId}`)
      })

      conn.onPacket(play.ClientboundSetExperiencePacket, (pkt: any) => {
        log(`SetExperience: level=${pkt.totalExperience} total=${pkt.experienceLevel}`)
      })

      conn.onPacket(play.ClientboundUpdateMobEffectPacket, (pkt: any) => {
        log(`UpdateMobEffect: entity=${pkt.entityId} effect=${pkt.effectId} amp=${pkt.amplifier} dur=${pkt.duration}`)
      })

      conn.onPacket(play.ClientboundRemoveMobEffectPacket, (pkt: any) => {
        log(`RemoveMobEffect: entity=${pkt.entityId} effect=${pkt.effectId}`)
      })

      conn.onPacket(play.ClientboundRespawnPacket, (pkt: any) => {
        log(`Respawn: dim=${pkt.common?.dimensionType}`)
      })

      conn.onPacket(play.ClientboundSoundPacket, (pkt: any) => {
        log(`Sound: x=${pkt.x} y=${pkt.y} z=${pkt.z}`)
      })

      conn.onPacket(play.ClientboundSoundEntityPacket, (pkt: any) => {
        log(`SoundEntity: entity=${pkt.entityId}`)
      })

      conn.onPacket(play.ClientboundLevelParticlesPacket, (pkt: any) => {
        log(`Particles: count=${pkt.count}`)
      })

      conn.onPacket(play.ClientboundBlockUpdatePacket, (pkt: any) => {
        log(`BlockUpdate: pos=(${pkt.position?.x},${pkt.position?.y},${pkt.position?.z}) state=${pkt.blockState}`)
      })

      conn.onPacket(play.ClientboundSectionBlocksUpdatePacket, (pkt: any) => {
        log(`SectionBlocksUpdate: ${pkt.blocks?.length ?? 0} blocks`)
      })

      conn.onPacket(play.ClientboundSetEquipmentPacket, (pkt: any) => {
        log(`SetEquipment: entity=${pkt.entityId} slots=${pkt.slots?.length ?? 0}`)
      })

      conn.onPacket(play.ClientboundContainerSetContentPacket, (pkt: any) => {
        log(`ContainerSetContent: id=${pkt.windowId} items=${pkt.slots?.length ?? 0}`)
      })

      conn.onPacket(play.ClientboundContainerSetSlotPacket, (pkt: any) => {
        log(`ContainerSetSlot: id=${pkt.windowId} slot=${pkt.slot}`)
      })

      conn.onPacket(play.ClientboundOpenScreenPacket, (pkt: any) => {
        log(`OpenScreen: id=${pkt.containerId} type=${pkt.type}`)
      })

      conn.onPacket(play.ClientboundSetTitleTextPacket, (pkt: any) => {
        log(`SetTitle: ${JSON.stringify(pkt.title).substring(0, 100)}`)
      })

      conn.onPacket(play.ClientboundSetSubtitleTextPacket, (pkt: any) => {
        log(`SetSubtitle: ${JSON.stringify(pkt.subtitle).substring(0, 100)}`)
      })

      conn.onPacket(play.ClientboundSetTitlesAnimationPacket, (pkt: any) => {
        log(`TitlesAnimation: fadeIn=${pkt.fadeIn} stay=${pkt.stay} fadeOut=${pkt.fadeOut}`)
      })

      conn.onPacket(play.ClientboundSetActionBarTextPacket, (pkt: any) => {
        log(`ActionBar: ${JSON.stringify(pkt.actionBar).substring(0, 100)}`)
      })

      conn.onPacket(play.ClientboundClearTitlesPacket, (pkt: any) => {
        log(`ClearTitles: reset=${pkt.reset}`)
      })

      conn.onPacket(play.ClientboundBlockDestructionPacket, (pkt: any) => {
        log(`BlockDestruction: entity=${pkt.entityId} stage=${pkt.stage}`)
      })

      conn.onPacket(play.ClientboundBlockEventPacket, (pkt: any) => {
        log(`BlockEvent: type=${pkt.blockEventType} data=${pkt.blockEventData}`)
      })

      conn.onPacket(play.ClientboundBlockEntityDataPacket, (pkt: any) => {
        log(`BlockEntityData: type=${pkt.blockEntityType}`)
      })

      conn.onPacket(play.ClientboundDamageEventPacket, (pkt: any) => {
        log(`DamageEvent: entity=${pkt.entityId}`)
      })

      conn.onPacket(play.ClientboundHurtAnimationPacket, (pkt: any) => {
        log(`HurtAnimation: entity=${pkt.entityId}`)
      })

      conn.onPacket(play.ClientboundAnimatePacket, (pkt: any) => {
        log(`Animate: entity=${pkt.entityId} anim=${pkt.animation}`)
      })

      conn.onPacket(play.ClientboundCooldownPacket, (pkt: any) => {
        log(`Cooldown: item=${pkt.item} ticks=${pkt.cooldownTicks}`)
      })

      conn.onPacket(play.ClientboundRemoveEntitiesPacket, (pkt: any) => {
        log(`RemoveEntities: count=${pkt.entityIds?.length ?? 0}`)
      })

      conn.onPacket(play.ClientboundTakeItemEntityPacket, (pkt: any) => {
        log(`TakeItemEntity: collected=${pkt.collectedEntityId} collector=${pkt.collectorEntityId}`)
      })

      conn.onPacket(play.ClientboundPlayerAbilitiesPacket, (pkt: any) => {
        log(`PlayerAbilities: invulnerable=${pkt.abilities?.invulnerable} flySpeed=${pkt.abilities?.flyingSpeed} walkSpeed=${pkt.abilities?.walkingSpeed}`)
      })

      conn.onPacket(play.ClientboundSetPassengersPacket, (pkt: any) => {
        log(`SetPassengers: vehicle=${pkt.vehicle} count=${pkt.passengers?.length ?? 0}`)
      })

      conn.onPacket(play.ClientboundChunkBatchStartPacket, () => log("[ChunkBatchStart]"))
      conn.onPacket(play.ClientboundChunkBatchFinishedPacket, (pkt: any) => log(`[ChunkBatchFinished] count=${pkt.batchSize}`))

      conn.onPacket(play.ClientboundSetDefaultSpawnPositionPacket, (pkt: any) => {
        log(`DefaultSpawn: dim=${pkt.respawnData?.globalPos?.dimension} pos=(${pkt.respawnData?.globalPos?.pos?.x},${pkt.respawnData?.globalPos?.pos?.y},${pkt.respawnData?.globalPos?.pos?.z})`)
      })

      conn.onPacket(play.ClientboundServerDataPacket, (pkt: any) => {
        log(`ServerData`)
      })

      conn.onPacket(play.ClientboundUpdateRecipesPacket, (pkt: any) => {
        log(`UpdateRecipes: ${pkt.recipes?.length ?? 0} recipes`)
      })

      conn.onPacket(play.ClientboundUpdateTagsPacket, (pkt: any) => {
        log(`Play UpdateTags`)
      })

      conn.onPacket(play.ClientboundLevelChunkWithLightPacket, (pkt: any) => {
        // skip verbose logging
      })

      conn.onPacket(play.ClientboundPlayerInfoRemovePacket, (pkt: any) => {
        log(`PlayerInfoRemove: count=${pkt.entityIds?.length ?? 0}`)
      })

      conn.onPacket(play.ClientboundSetHeldSlotPacket, (pkt: any) => {
        log(`SetHeldSlot: slot=${pkt.slot}`)
      })

      conn.onPacket(play.ClientboundSetSimulationDistancePacket, (pkt: any) => {
        log(`SimulationDistance: ${pkt.simulationDistance}`)
      })

      conn.onPacket(play.ClientboundSetChunkCacheRadiusPacket, (pkt: any) => {
        log(`ChunkCacheRadius: ${pkt.chunkCacheRadius}`)
      })

      conn.onPacket(play.ClientboundSetChunkCacheCenterPacket, (pkt: any) => {
        log(`ChunkCacheCenter: x=${pkt.x} z=${pkt.z}`)
      })

      conn.onPacket(play.ClientboundInitializeBorderPacket, (pkt: any) => {
        log(`InitializeBorder: x=${pkt.x} z=${pkt.z} newDiameter=${pkt.newDiameter} speed=${pkt.speed}`)
      })

      conn.onPacket(play.ClientboundStartConfigurationPacket, (pkt: any) => {
        log(`StartConfiguration`)
      })

      // ---- AFTER SPAWN: DO STUFF ----
      conn.onPacket(play.ClientboundLoginPacket, async () => {
        log("Waiting 3s for chunks before doing stuff...")
        await sleep(3000)

        // 1. Chat
        log(">>> Sending chat")
        conn.write(new play.ServerboundChatPacket(
          "Hello bot here!",
          BigInt(Date.now()), 0n, null,
          { offset: 0, acknowledged: new Uint8Array(3), checksum: 0 },
        ))
        await sleep(500)

        // 2. Client tick end
        log(">>> ClientTickEnd")
        conn.write(new play.ServerboundClientTickEndPacket())
        await sleep(100)

        // 3. Swing arm
        log(">>> Swing (main hand)")
        conn.write(new play.ServerboundSwingPacket(InteractionHand.MainHand))
        await sleep(100)

        // 4. Move
        log(">>> Move")
        conn.write(new play.ServerboundMovePlayerPosPacket(1.5, 64.0, 1.5, false, false))
        await sleep(100)
        conn.write(new play.ServerboundMovePlayerPosPacket(3.0, 64.0, 3.0, false, false))
        await sleep(200)

        // 5. Set held item
        log(">>> SetCarriedItem")
        conn.write(new play.ServerboundSetCarriedItemPacket(0))
        await sleep(100)

        // 6. Player command (sneak)
        log(">>> Sneak")
        conn.write(new play.ServerboundPlayerCommandPacket(0, play.PlayerCommandAction.StartSprinting, 0))
        await sleep(300)
        conn.write(new play.ServerboundPlayerCommandPacket(0, play.PlayerCommandAction.StopSprinting, 0))
        await sleep(300)

        // 7. Player action (start destroy block)
        log(">>> PlayerAction (destroy block)")
        conn.write(new play.ServerboundPlayerActionPacket(
          play.PlayerAction.StartDestroyBlock,
          new BlockPos(2, 65, 2),
          BlockFace.Up,
          0,
        ))
        await sleep(300)

        // 8. Use item on
        log(">>> UseItemOn")
        conn.write(new play.ServerboundUseItemOnPacket(
          InteractionHand.MainHand,
          {
            blockPos: new BlockPos(3, 65, 3),
            direction: BlockFace.Up,
            location: { x: 3.5, y: 65.5, z: 3.5 } as Vec3,
            inside: false,
            worldBorder: false,
          },
          0,
        ))
        await sleep(300)

        // 9. Change held item
        log(">>> SetCarriedItem (slot 1)")
        conn.write(new play.ServerboundSetCarriedItemPacket(1))
        await sleep(100)

        // 10. Swing offhand
        log(">>> Swing (offhand)")
        conn.write(new play.ServerboundSwingPacket(InteractionHand.OffHand))
        await sleep(200)

        // 11. Chat command
        log(">>> Chat /help")
        conn.write(new play.ServerboundChatPacket(
          "/help",
          BigInt(Date.now()), 0n, null,
          { offset: 0, acknowledged: new Uint8Array(3), checksum: 0 },
        ))
        await sleep(500)

        // 12. Creative mode slot
        log(">>> SetCreativeModeSlot")
        conn.write(new play.ServerboundSetCreativeModeSlotPacket(36, null))
        await sleep(200)

        // 13. Container close
        log(">>> ContainerClose")
        conn.write(new play.ServerboundContainerClosePacket(0))
        await sleep(200)

        // 14. Player input
        log(">>> PlayerInput")
        conn.write(new play.ServerboundPlayerInputPacket(new PlayerInput(false, false, false, false, false, false, false)))
        await sleep(200)

        // 15. Client information
        log(">>> ClientInformation")
        conn.write(new play.ServerboundClientInformationPacket(
          "en_us", 24, ChatVisibility.Full, true, 0,
          HumanoidArm.Right, false, true, ParticleStatus.All,
        ))
        await sleep(200)

        // 16. Change game mode
        log(">>> ChangeGameMode")
        conn.write(new play.ServerboundChangeGameModePacket(1))
        await sleep(300)

        // 17. Player abilities
        log(">>> PlayerAbilities")
        conn.write(new play.ServerboundPlayerAbilitiesPacket(0, 0.05, 0.1))
        await sleep(200)

        // 18. Use item
        log(">>> UseItem")
        conn.write(new play.ServerboundUseItemPacket(InteractionHand.MainHand, 0, 0, 0))
        await sleep(200)

        // 19. Interact
        log(">>> Interact")
        conn.write(new play.ServerboundInteractPacket(0, { kind: "interact", hand: InteractionHand.MainHand }, false))
        await sleep(200)

        // 20. Paddle boat
        log(">>> PaddleBoat")
        conn.write(new play.ServerboundPaddleBoatPacket(true, false))
        await sleep(200)

        // 21. Seen advancements
        log(">>> SeenAdvancements")
        conn.write(new play.ServerboundSeenAdvancementsPacket(play.SeenAdvancementsAction.ClosedScreen, null))
        await sleep(200)

        // 22. Recipe book seen recipe
        log(">>> RecipeBookSeenRecipe")
        conn.write(new play.ServerboundRecipeBookSeenRecipePacket(play.RecipeBookCategory.Crafting))
        await sleep(200)

        // 23. Resource pack
        log(">>> ResourcePack")
        conn.write(new play.ServerboundResourcePackPacket("00000000-0000-0000-0000-000000000000", play.ResourcePackAction.Accepted))
        await sleep(200)

        // 24. Chat ack
        log(">>> ChatAck")
        conn.write(new play.ServerboundChatAckPacket(0))
        await sleep(200)

        // 25. Pick item from entity
        log(">>> PickItemFromEntity")
        conn.write(new play.ServerboundPickItemFromEntityPacket(0, false))
        await sleep(200)

        // 26. Pick item from block
        log(">>> PickItemFromBlock")
        conn.write(new play.ServerboundPickItemFromBlockPacket(new BlockPos(0, 0, 0), false))
        // 27. Configuration acknowledged — skip: only valid during config state, not play
        // log(">>> ConfigurationAcknowledged")
        // conn.write(new play.ServerboundConfigurationAcknowledgedPacket())
        await sleep(200)

        // 28. Client command
        log(">>> ClientCommand")
        conn.write(new play.ServerboundClientCommandPacket(0))
        await sleep(200)

        // 29. Chat session update — skip: requires valid Mojang-signed key, can't test offline
        // log(">>> ChatSessionUpdate")
        // const session = {
        //   sessionId: "00000000-0000-0000-0000-000000000000",
        //   publicKey: {
        //     expiresAt: { seconds: BigInt(9999999999), nanos: 0 },
        //     key: new Uint8Array(0),
        //     keySignature: new Uint8Array(0),
        //   },
        // }
        // conn.write(new play.ServerboundChatSessionUpdatePacket(session))
        await sleep(200)

        // 30. Move rot
        log(">>> MoveRot")
        conn.write(new play.ServerboundMovePlayerRotPacket(0, 90, false, false))
        await sleep(200)

        // 31. Move pos + rot
        log(">>> MovePosRot")
        conn.write(new play.ServerboundMovePlayerPosRotPacket(3.5, 64.0, 3.5, 0, 90, false, false))
        await sleep(200)

        // 32. Pong
        log(">>> Pong")
        conn.write(new play.ServerboundPongPacket(0))
        await sleep(200)

        // 33. Custom payload
        log(">>> CustomPayload")
        const enc = new TextEncoder()
        conn.write(new play.ServerboundCustomPayloadPacket("minecraft:brand", enc.encode("dripleaf")))
        await sleep(200)

        // 34. Chunk batch received
        log(">>> ChunkBatchReceived")
        conn.write(new play.ServerboundChunkBatchReceivedPacket(0))
        await sleep(200)

        // 35. Debug subscription
        log(">>> DebugSubscription")
        conn.write(new play.ServerboundDebugSubscriptionRequestPacket([]))
        await sleep(200)

        // 36. Container slot state changed
        log(">>> ContainerSlotStateChanged")
        conn.write(new play.ServerboundContainerSlotStateChangedPacket(0, 0, false))
        await sleep(200)

        // 37. Command suggestion
        log(">>> CommandSuggestion")
        conn.write(new play.ServerboundCommandSuggestionPacket(0, "help"))
        await sleep(200)

        // 38. Set beacon
        log(">>> SetBeacon")
        conn.write(new play.ServerboundSetBeaconPacket(null, null))
        await sleep(200)

        // 39. Select trade
        log(">>> SelectTrade")
        conn.write(new play.ServerboundSelectTradePacket(0))
        await sleep(200)

        // 40. Edit book
        log(">>> EditBook")
        conn.write(new play.ServerboundEditBookPacket(0, [], null))
        await sleep(200)

        // 41. Rename item
        log(">>> RenameItem")
        conn.write(new play.ServerboundRenameItemPacket("new name"))
        await sleep(200)

        // 42. Move vehicle
        log(">>> MoveVehicle")
        conn.write(new play.ServerboundMoveVehiclePacket({ x: 0, y: 0, z: 0 } as Vec3, 0, 0, false))
        await sleep(200)

        log("\n=== Bot actions complete, disconnecting ===")
        await sleep(1000)
        conn.disconnect()
      })

      // ---- INIT ----
      conn.write(new handshake.ServerboundIntentionPacket(775, HOST, PORT, ClientIntention.Login))
      conn.setState(State.Login)
      conn.write(new login.ServerboundHelloPacket("DripleafBot", randomUUID() as UUID))
      log("Handshake + LoginStart sent")
    })

    socket.on("error", (err: Error) => {
      log(`SOCKET ERROR: ${err.message}`)
      reject(err)
    })

    socket.setTimeout(30000)
    socket.on("timeout", () => {
      log("SOCKET TIMEOUT")
      reject(new Error("Socket timeout"))
    })
  })

  // ---- SUMMARY ----
  log("\n" + "=".repeat(70))
  log("SUMMARY")
  log("=".repeat(70))
  log(`Total unique packet types decoded: ${decodedPackets.size}`)
  log(`Total packets received: ${allPackets.length}`)

  const sorted = [...decodedPackets.entries()].sort((a, b) => b[1] - a[1])
  log("\nAll packets received:")
  for (const [name, count] of sorted) {
    log(`  ${name.padEnd(55)} x${count}`)
  }

  log("\nTest complete. Log file: " + LOG_FILE)
  process.exit(0)
}

main().catch((err) => {
  log(`FATAL: ${err.message}\n${err.stack}`)
  process.exit(1)
})
