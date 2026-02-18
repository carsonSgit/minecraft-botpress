package com.botpress.build;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class BuilderEngine {
	private static final int OFFSET = 2;
	private static final long COMMAND_DELAY_MS = 100;

	private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
		Thread t = new Thread(r, "MineBot-Builder");
		t.setDaemon(true);
		return t;
	});

	public static void build(String structure, int width, int height, int depth, String material) {
		MinecraftClient client = MinecraftClient.getInstance();
		if (client.player == null || client.getNetworkHandler() == null) {
			return;
		}

		String mat = material.startsWith("minecraft:") ? material : "minecraft:" + material;

		BlockPos playerPos = client.player.getBlockPos();
		int x = playerPos.getX() + OFFSET;
		int y = playerPos.getY();
		int z = playerPos.getZ() + OFFSET;

		List<String> commands = switch (structure) {
			case "cube" -> buildCube(x, y, z, width, height, depth, mat);
			case "house" -> buildHouse(x, y, z, width, height, depth, mat);
			case "tower" -> buildTower(x, y, z, width, height, depth, mat);
			case "platform" -> buildPlatform(x, y, z, width, depth, mat);
			default -> List.of();
		};

		if (commands.isEmpty()) {
			client.execute(() -> {
				if (client.player != null) {
					client.player.sendMessage(
							Text.literal("[MineBot] ").formatted(Formatting.RED).append(
									Text.literal("Unknown structure type: " + structure).formatted(Formatting.RED)),
							false);
				}
			});
			return;
		}

		client.execute(() -> {
			if (client.player != null) {
				client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.GOLD)
						.append(Text
								.literal("Building " + structure + " (" + width + "x" + height + "x" + depth + ")...")
								.formatted(Formatting.YELLOW)),
						false);
			}
		});

		for (int i = 0; i < commands.size(); i++) {
			String cmd = commands.get(i);
			boolean isLast = (i == commands.size() - 1);
			long delay = (long) i * COMMAND_DELAY_MS;

			scheduler.schedule(() -> {
				client.execute(() -> {
					if (client.getNetworkHandler() != null) {
						client.getNetworkHandler().sendChatCommand(cmd);

						if (isLast) {
							if (client.player != null) {
								client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.GREEN)
										.append(Text.literal("Build complete!").formatted(Formatting.GREEN)), false);
							}
						}
					}
				});
			}, delay, TimeUnit.MILLISECONDS);
		}
	}

	private static List<String> buildCube(int x, int y, int z, int w, int h, int d, String mat) {
		List<String> cmds = new ArrayList<>();
		int x2 = x + w - 1;
		int y2 = y + h - 1;
		int z2 = z + d - 1;
		cmds.add("fill " + x + " " + y + " " + z + " " + x2 + " " + y2 + " " + z2 + " " + mat);
		return cmds;
	}

	private static List<String> buildHouse(int x, int y, int z, int w, int h, int d, String mat) {
		List<String> cmds = new ArrayList<>();
		int x2 = x + w - 1;
		int y2 = y + h - 1;
		int z2 = z + d - 1;

		// Solid shell
		cmds.add("fill " + x + " " + y + " " + z + " " + x2 + " " + y2 + " " + z2 + " " + mat);

		// Hollow interior (air)
		if (w > 2 && h > 1 && d > 2) {
			cmds.add("fill " + (x + 1) + " " + (y + 1) + " " + (z + 1) + " " + (x2 - 1) + " " + (y2 - 1) + " "
					+ (z2 - 1) + " minecraft:air");
		}

		// Door opening (2 high, 1 wide, on front face center)
		int doorX = x + w / 2;
		cmds.add("fill " + doorX + " " + (y + 1) + " " + z + " " + doorX + " " + (y + 2) + " " + z + " minecraft:air");

		return cmds;
	}

	private static List<String> buildTower(int x, int y, int z, int w, int h, int d, String mat) {
		List<String> cmds = new ArrayList<>();
		int x2 = x + w - 1;
		int y2 = y + h - 1;
		int z2 = z + d - 1;

		// Solid shell
		cmds.add("fill " + x + " " + y + " " + z + " " + x2 + " " + y2 + " " + z2 + " " + mat);

		// Hollow interior
		if (w > 2 && h > 1 && d > 2) {
			cmds.add("fill " + (x + 1) + " " + (y + 1) + " " + (z + 1) + " " + (x2 - 1) + " " + (y2 - 1) + " "
					+ (z2 - 1) + " minecraft:air");
		}

		// Door opening
		int doorX = x + w / 2;
		cmds.add("fill " + doorX + " " + (y + 1) + " " + z + " " + doorX + " " + (y + 2) + " " + z + " minecraft:air");

		return cmds;
	}

	private static List<String> buildPlatform(int x, int y, int z, int w, int d, String mat) {
		List<String> cmds = new ArrayList<>();
		int x2 = x + w - 1;
		int z2 = z + d - 1;
		cmds.add("fill " + x + " " + y + " " + z + " " + x2 + " " + y + " " + z2 + " " + mat);
		return cmds;
	}
}
