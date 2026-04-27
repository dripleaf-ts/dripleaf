import { describe, expect, it } from "bun:test";
import { ServerboundIntentionPacket } from "../src/packets/handshake";

// todo: improve the test suite, i made this quickly just to know if the ONLY packet i made works :sob:

describe("packets", () => {
  it("should have read the packets", () => {
    const packet = new ServerboundIntentionPacket(775, "localhost", 25565, 2);
    expect(packet).toBeInstanceOf(ServerboundIntentionPacket);
    expect(packet.protocolVersion).toBe(775);
    expect(packet.serverAddress).toBe("localhost");
    expect(packet.serverPort).toBe(25565);
    expect(packet.intention).toBe(2);

    const serialized = packet.serialize();
    const deserialized = ServerboundIntentionPacket.deserialize(serialized);
    expect(deserialized).toBeInstanceOf(ServerboundIntentionPacket);
    expect(deserialized.protocolVersion).toBe(775);
    expect(deserialized.serverAddress).toBe("localhost");
    expect(deserialized.serverPort).toBe(25565);
    expect(deserialized.intention).toBe(2);
  });
});