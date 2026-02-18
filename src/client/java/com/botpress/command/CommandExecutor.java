package com.botpress.command;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.List;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class CommandExecutor {
    private static final Set<String> WHITELISTED_COMMANDS = Set.of(
            // Vanilla
            "time", "weather", "give", "tp", "gamemode", "difficulty", "effect",
            "kill", "clear", "summon", "setblock", "fill", "clone", "enchant",
            "xp", "spawnpoint", "setworldspawn", "playsound", "title", "tellraw",
            "particle", "locate",
            // WorldEdit
            "//set", "//replace", "//walls", "//outline", "//hollow",
            "//copy", "//paste", "//cut", "//rotate", "//flip", "//stack", "//move",
            "//undo", "//redo", "//pos1", "//pos2", "//hpos1", "//hpos2",
            "//expand", "//contract", "//shift",
            "//cyl", "//hcyl", "//sphere", "//hsphere", "//pyramid", "//hpyramid",
            "//wand", "//sel", "//line", "//curve", "//drain", "//regen"
    );

    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "MineBot-CmdScheduler");
        t.setDaemon(true);
        return t;
    });

    public static void execute(String command) {
        MinecraftClient client = MinecraftClient.getInstance();

        String trimmed = command.trim();
        String baseCommand;

        if (trimmed.startsWith("//")) {
            baseCommand = "//" + trimmed.substring(2).split("\\s+")[0];
        } else {
            baseCommand = trimmed.split("\\s+")[0];
        }

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

                if (trimmed.startsWith("//")) {
                    // sendChatCommand adds one /, so pass "/set stone" to get "//set stone"
                    client.getNetworkHandler().sendChatCommand(trimmed.substring(1));
                } else {
                    client.getNetworkHandler().sendChatCommand(trimmed);
                }
            }
        });
    }

    public static void executeSequence(String description, List<String> commands) {
        MinecraftClient client = MinecraftClient.getInstance();

        client.execute(() -> {
            if (client.player != null) {
                client.player.sendMessage(
                        Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                                .append(Text.literal(description).formatted(Formatting.YELLOW))
                                .append(Text.literal(" (" + commands.size() + " commands)").formatted(Formatting.GRAY)),
                        false
                );
            }
        });

        for (int i = 0; i < commands.size(); i++) {
            final String cmd = commands.get(i).trim();
            final int index = i;

            scheduler.schedule(() -> {
                client.execute(() -> {
                    if (client.player != null && client.getNetworkHandler() != null) {
                        if (cmd.startsWith("//")) {
                            client.getNetworkHandler().sendChatCommand(cmd.substring(1));
                        } else {
                            client.getNetworkHandler().sendChatCommand(cmd);
                        }
                    }
                });

                if ((index + 1) % 10 == 0 || index == commands.size() - 1) {
                    client.execute(() -> {
                        if (client.player != null) {
                            client.player.sendMessage(
                                    Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                                            .append(Text.literal("Progress: " + (index + 1) + "/" + commands.size()).formatted(Formatting.GRAY)),
                                    false
                            );
                        }
                    });
                }
            }, (long) i * 150, TimeUnit.MILLISECONDS);
        }
    }
}
