package com.botpress.command;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.Set;

public class CommandExecutor {
    private static final Set<String> WHITELISTED_COMMANDS = Set.of(
            "time", "weather", "give", "tp", "gamemode", "difficulty", "effect"
    );

    public static void execute(String command) {
        MinecraftClient client = MinecraftClient.getInstance();

        String baseCommand = command.trim().split("\\s+")[0];

        if (!WHITELISTED_COMMANDS.contains(baseCommand)) {
            client.execute(() -> {
                if (client.player != null) {
                    client.player.sendMessage(
                            Text.literal("[MineBot] ").formatted(Formatting.RED)
                                    .append(Text.literal("Command not allowed: /" + baseCommand).formatted(Formatting.RED)),
                            false
                    );
                }
            });
            return;
        }

        client.execute(() -> {
            if (client.player != null && client.getNetworkHandler() != null) {
                client.player.sendMessage(
                        Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                                .append(Text.literal("Executing: /" + command).formatted(Formatting.YELLOW)),
                        false
                );
                client.getNetworkHandler().sendChatCommand(command);
            }
        });
    }
}
