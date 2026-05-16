import { State, ChatVisibility, HumanoidArm, ParticleStatus, configuration, play } from "@dripleaf/protocol"
import { chatComponentFromNbt } from "@dripleaf/chat"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

export class ConfigurationPlugin implements ClientPlugin {
  readonly name = "configuration"

  register(ctx: ClientContext, conn: import("@dripleaf/protocol").Connection): void {
    conn.onPacket(configuration.ClientboundDisconnectPacket, (packet) => {
      ctx.emit("disconnect", chatComponentFromNbt(packet.reason))
      conn.disconnect()
    })

    conn.onPacket(configuration.ClientboundRegistryDataPacket, (packet) => {
      ctx.registries.applyRegistryData(packet.registryId, packet.entries)
    })

    conn.onPacket(configuration.ClientboundUpdateTagsPacket, (packet) => {
      ctx.registries.applyUpdateTags(packet.registries)
    })

    conn.onPacket(configuration.ClientboundFinishConfigurationPacket, () => {
      conn.write(new configuration.ServerboundFinishConfigurationPacket())
      conn.setState(State.Play)
    })

    conn.onPacket(play.ClientboundStartConfigurationPacket, () => {
      conn.write(new play.ServerboundConfigurationAcknowledgedPacket())
      conn.setState(State.Configuration)
      conn.write(new configuration.ServerboundClientInformationPacket(
        "en_us", 24, ChatVisibility.Full, true, 0,
        HumanoidArm.Right, false, true, ParticleStatus.All,
      ))
    })
  }
}
