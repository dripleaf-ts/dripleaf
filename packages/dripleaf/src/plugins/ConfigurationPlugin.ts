import { State, ChatVisibility, HumanoidArm, ParticleStatus, configuration, play, PacketWriter, Connection } from "@dripleaf/protocol"
import { toPlainText } from "@dripleaf/chat"
import type { ClientContext } from "../context"
import type { ClientPlugin } from "./types"

function encodeBrand(brand: string): Uint8Array {
	const writer = new PacketWriter()
	writer.writeString(brand)
	return writer.finish()
}

export class ConfigurationPlugin implements ClientPlugin {
	readonly name = "configuration"

	register(ctx: ClientContext, conn: Connection): void {
		conn.onPacket(configuration.ClientboundDisconnectPacket, (packet) => {
			ctx.emit("disconnect", toPlainText(packet.reason))
			conn.disconnect()
		})

		conn.onPacket(configuration.ClientboundRegistryDataPacket, (packet) => {
			ctx.registries.applyRegistryData(packet.registryId, packet.entries)
		})

		conn.onPacket(configuration.ClientboundUpdateTagsPacket, (packet) => {
			ctx.registries.applyUpdateTags(packet.registries)
		})

		let sentClientInfo = false
		conn.onPacket(configuration.ClientboundSelectKnownPacksPacket, (packet) => {
			conn.write(new configuration.ServerboundSelectKnownPacksPacket(packet.knownPacks))
			if (!sentClientInfo) {
				sentClientInfo = true
				conn.write(new configuration.ServerboundClientInformationPacket(
					"en_us", 24, ChatVisibility.Full, true, 0,
					HumanoidArm.Right, false, true, ParticleStatus.All,
				))
				conn.write(new configuration.ServerboundCustomPayloadPacket(
					"minecraft:brand" as any,
					encodeBrand("dripleaf"),
				))
			}
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
			conn.write(new configuration.ServerboundCustomPayloadPacket(
				"minecraft:brand" as any,
				encodeBrand("dripleaf"),
			))
		})
	}
}