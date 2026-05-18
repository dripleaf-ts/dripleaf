import { MenuType } from "@dripleaf/registry"
import { toPlainText } from "@dripleaf/chat"
import { Window, menuSlotCount, menuTypeToWindowType } from "@dripleaf/inventory"
import { Connection, play } from "@dripleaf/protocol"
import type { ItemStack } from "@dripleaf/inventory"
import type { ClientContext, EquipmentEntry } from "../context"
import type { ClientPlugin } from "./types"

function getWindow(ctx: ClientContext, windowId: number): Window | undefined {
  if (windowId === 0) return ctx.inventory
  return ctx.windows.get(windowId)
}

export class InventoryPlugin implements ClientPlugin {
  readonly name = "inventory"

  register(ctx: ClientContext, conn: Connection): void {
    conn.onPacket(play.ClientboundOpenScreenPacket, (packet) => {
      const slotCount = menuSlotCount(packet.type as MenuType)
      const window = new Window(
        packet.containerId,
        menuTypeToWindowType(packet.type as MenuType),
        toPlainText(packet.title),
        slotCount,
      )
      ctx.windows.set(packet.containerId, window)
      ctx.currentWindowId = packet.containerId
      ctx.emit("windowOpen", window)
    })

    conn.onPacket(play.ClientboundContainerClosePacket, (packet) => {
      const window = ctx.windows.get(packet.windowId)
      ctx.windows.delete(packet.windowId)
      if (ctx.currentWindowId === packet.windowId)
        ctx.currentWindowId = null
      if (window) ctx.emit("windowClose", window)
    })

    conn.onPacket(play.ClientboundContainerSetContentPacket, (packet) => {
      const window = getWindow(ctx, packet.windowId)
      if (!window) return
      window.state = packet.stateId
      for (let i = 0; i < packet.slots.length; i++)
        window.setSlot(i, packet.slots[i]!)
      if (packet.windowId === ctx.currentWindowId || packet.windowId === 0)
        window.setSlot(-1, packet.carriedItem)
    })

    conn.onPacket(play.ClientboundContainerSetSlotPacket, (packet) => {
      const window = getWindow(ctx, packet.windowId)
      if (!window) return
      window.state = packet.stateId
      window.setSlot(packet.slot, packet.slotData)
    })

    conn.onPacket(play.ClientboundSetPlayerInventoryPacket, (packet) => {
      if (packet.slot === -1) {
        ctx.inventory.setSlot(-1, packet.contents as ItemStack)
        return
      }
      ctx.inventory.setSlot(packet.slot, packet.contents as ItemStack)
    })

    conn.onPacket(play.ClientboundSetCursorItemPacket, (packet) => {
      const window = ctx.currentWindowId !== null
        ? ctx.windows.get(ctx.currentWindowId) ?? ctx.inventory
        : ctx.inventory
      window.setSlot(-1, packet.contents)
    })

    conn.onPacket(play.ClientboundSetEquipmentPacket, (packet) => {
      ctx.equipment.set(packet.entityId, packet.slots as EquipmentEntry[])
    })

    conn.onPacket(play.ClientboundSetHeldSlotPacket, (packet) => {
      ctx.heldItem = packet.slot
      ctx.emit("heldItemChange", packet.slot)
    })

    conn.onPacket(play.ClientboundPlayerInfoUpdatePacket, (packet) => {
      for (const entry of packet.entries) {
        if (entry.player) {
          const id = entry.uuid
          const name = entry.player.name
          const had = ctx.players.has(id)
          ctx.players.set(id, { uuid: id, name })
          if (!had) ctx.emit("playerJoin", { uuid: id, name })
        }
        if (entry.chatSession) {
          conn.write(new play.ServerboundChatSessionUpdatePacket({
            sessionId: entry.chatSession.uuid,
            publicKey: {
              expiresAt: { seconds: entry.chatSession.publicKey.expireTime, nanos: 0 },
              key: entry.chatSession.publicKey.keyBytes,
              keySignature: entry.chatSession.publicKey.keySignature,
            },
          }))
        }
      }
    })

    conn.onPacket(play.ClientboundPlayerInfoRemovePacket, (packet) => {
      for (const uuid of packet.profileIds) {
        const player = ctx.players.get(uuid)
        if (!player) continue
        ctx.players.delete(uuid)
        ctx.emit("playerLeave", player)
      }
    })
  }
}
