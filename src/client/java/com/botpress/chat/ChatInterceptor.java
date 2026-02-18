package com.botpress.chat;

import com.botpress.network.HttpBridge;
import net.fabricmc.fabric.api.client.message.v1.ClientSendMessageEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public class ChatInterceptor {
    private static final String PREFIX = "!ai ";
    private static final int MAX_LENGTH = 500;
    private static final long COOLDOWN_MS = 2000;

    private static long lastMessageTime = 0;

    public static void register() {
        ClientSendMessageEvents.ALLOW_CHAT.register(ChatInterceptor::onChatMessage);
    }

    private static boolean onChatMessage(String message) {
        if (!message.startsWith(PREFIX)) {
            return true;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.getNetworkHandler() == null) {
            return false;
        }

        String query = message.substring(PREFIX.length()).trim();

        if (query.isEmpty()) {
            client.execute(() -> sendChat(client, Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                    .append(Text.literal("Usage: !ai <message>").formatted(Formatting.YELLOW))));
            return false;
        }

        if (query.length() > MAX_LENGTH) {
            client.execute(() -> sendChat(client, Text.literal("[MineBot] ").formatted(Formatting.RED)
                    .append(Text.literal("Message too long (max " + MAX_LENGTH + " chars).").formatted(Formatting.RED))));
            return false;
        }

        long now = System.currentTimeMillis();
        if (now - lastMessageTime < COOLDOWN_MS) {
            client.execute(() -> sendChat(client, Text.literal("[MineBot] ").formatted(Formatting.RED)
                    .append(Text.literal("Please wait before sending another message.").formatted(Formatting.RED))));
            return false;
        }
        lastMessageTime = now;

        if (query.equalsIgnoreCase("help")) {
            client.execute(() -> {
                sendChat(client, Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                        .append(Text.literal("Available actions:").formatted(Formatting.YELLOW)));
                sendChat(client, Text.literal("  Chat: ").formatted(Formatting.GOLD)
                        .append(Text.literal("!ai <question> - Ask me anything").formatted(Formatting.WHITE)));
                sendChat(client, Text.literal("  Commands: ").formatted(Formatting.GOLD)
                        .append(Text.literal("!ai make it daytime / give me diamonds").formatted(Formatting.WHITE)));
                sendChat(client, Text.literal("  Build: ").formatted(Formatting.GOLD)
                        .append(Text.literal("!ai build a stone house / build a 5x5x5 cube").formatted(Formatting.WHITE)));
            });
            return false;
        }

        client.execute(() -> sendChat(client, Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                .append(Text.literal("Thinking...").formatted(Formatting.YELLOW))));

        String playerName = client.player.getName().getString();
        String playerUUID = client.player.getUuidAsString();

        HttpBridge.sendAsync(playerName, playerUUID, query);

        return false;
    }

    private static void sendChat(MinecraftClient client, Text message) {
        if (client.player != null) {
            client.player.sendMessage(message, false);
        }
    }
}
