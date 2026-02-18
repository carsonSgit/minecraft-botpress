package com.botpress.network;

import com.botpress.build.BuilderEngine;
import com.botpress.command.CommandExecutor;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class HttpBridge {
    private static final String BRIDGE_BASE_URL = "http://localhost:3000";
    private static final String BRIDGE_CHAT_URL = BRIDGE_BASE_URL + "/chat";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "MineBot-HTTP");
        t.setDaemon(true);
        return t;
    });

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public static void sendAsync(String playerName, String playerUUID, String message) {
        executor.submit(() -> {
            try {
                JsonObject body = new JsonObject();
                body.addProperty("playerName", playerName);
                body.addProperty("playerUUID", playerUUID);
                body.addProperty("message", message);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(BRIDGE_CHAT_URL))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(45))
                        .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    showError("Server returned status " + response.statusCode());
                    return;
                }

                JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
                String type = json.get("type").getAsString();

                switch (type) {
                    case "chat" -> showChat(json.get("text").getAsString());
                    case "command" -> CommandExecutor.execute(json.get("command").getAsString());
                    case "build" -> BuilderEngine.build(
                            json.get("structure").getAsString(),
                            json.get("width").getAsInt(),
                            json.get("height").getAsInt(),
                            json.get("depth").getAsInt(),
                            json.get("material").getAsString()
                    );
                    case "worldedit" -> {
                        String description = json.get("description").getAsString();
                        JsonArray cmdsArray = json.getAsJsonArray("commands");
                        List<String> commands = new ArrayList<>();
                        for (int i = 0; i < cmdsArray.size(); i++) {
                            commands.add(cmdsArray.get(i).getAsString());
                        }
                        CommandExecutor.executeSequence(description, commands);
                    }
                    case "error" -> showError(json.get("text").getAsString());
                    default -> showError("Unknown response type: " + type);
                }
            } catch (java.net.ConnectException e) {
                showError("Could not reach AI server. Is bridge-server running?");
            } catch (Exception e) {
                showError("Error: " + e.getMessage());
            }
        });
    }

    public static void sendResetAsync(String playerUUID) {
        executor.submit(() -> {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(BRIDGE_BASE_URL + "/reset/" + playerUUID))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(10))
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build();

                httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                MinecraftClient client = MinecraftClient.getInstance();
                client.execute(() -> {
                    if (client.player != null) {
                        client.player.sendMessage(
                                Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                                        .append(Text.literal("Conversation reset!").formatted(Formatting.GREEN)),
                                false
                        );
                    }
                });
            } catch (Exception e) {
                showError("Failed to reset: " + e.getMessage());
            }
        });
    }

    private static void showChat(String text) {
        MinecraftClient client = MinecraftClient.getInstance();
        client.execute(() -> {
            if (client.player != null) {
                client.player.sendMessage(
                        Text.literal("[MineBot] ").formatted(Formatting.GOLD)
                                .append(Text.literal(text).formatted(Formatting.WHITE)),
                        false
                );
            }
        });
    }

    private static void showError(String text) {
        MinecraftClient client = MinecraftClient.getInstance();
        client.execute(() -> {
            if (client.player != null) {
                client.player.sendMessage(
                        Text.literal("[MineBot] ").formatted(Formatting.RED)
                                .append(Text.literal(text).formatted(Formatting.RED)),
                        false
                );
            }
        });
    }
}
