package com.botpress.command;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class CommandExecutor {
	private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
		Thread t = new Thread(r, "MineBot-CmdScheduler");
		t.setDaemon(true);
		return t;
	});

	public static void execute(String command) {
		MinecraftClient client = MinecraftClient.getInstance();
		CommandValidation.ValidatedCommand validatedCommand = CommandValidation.validate(command);

		if (!validatedCommand.valid()) {
			client.execute(() -> {
				if (client.player != null) {
					client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.RED)
							.append(Text.literal(validatedCommand.errorMessage()).formatted(Formatting.RED)), false);
				}
			});
			return;
		}

		client.execute(() -> {
			if (client.player != null && client.getNetworkHandler() != null) {
				client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.GOLD)
						.append(Text.literal("Executing: /" + command).formatted(Formatting.YELLOW)), false);

				if (validatedCommand.normalized().startsWith("//")) {
					// sendChatCommand adds one /, so pass "/set stone" to get "//set stone"
					client.getNetworkHandler().sendChatCommand(validatedCommand.normalized().substring(1));
				} else {
					client.getNetworkHandler().sendChatCommand(validatedCommand.normalized());
				}
			}
		});
	}

	public static void executeSequence(String description, List<String> commands) {
		executeSequence(description, commands, false);
	}

	public static void executeSequence(String description, List<String> commands, boolean strictMode) {
		MinecraftClient client = MinecraftClient.getInstance();
		CommandValidation.SequenceValidationResult validation = CommandValidation.validateSequence(commands,
				strictMode);

		if (!validation.invalidCommands().isEmpty()) {
			CommandValidation.ValidatedCommand offending = validation.invalidCommands().get(0);
			client.execute(() -> {
				if (client.player != null) {
					if (strictMode) {
						client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.RED)
								.append(Text.literal("Strict mode rejected sequence at /" + offending.baseCommand())
										.formatted(Formatting.RED)),
								false);
					} else {
						client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.RED)
								.append(Text.literal("Skipping invalid command /" + offending.baseCommand())
										.formatted(Formatting.RED)),
								false);
					}
				}
			});
		}

		if (validation.shouldAbort()) {
			return;
		}

		List<CommandValidation.ValidatedCommand> commandsToSchedule = validation.validCommands();

		client.execute(() -> {
			if (client.player != null) {
				client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.GOLD)
						.append(Text.literal(description).formatted(Formatting.YELLOW)).append(Text
								.literal(" (" + commandsToSchedule.size() + " commands)").formatted(Formatting.GRAY)),
						false);
			}
		});

		for (int i = 0; i < commandsToSchedule.size(); i++) {
			final CommandValidation.ValidatedCommand cmd = commandsToSchedule.get(i);
			final int index = i;

			scheduler.schedule(() -> {
				client.execute(() -> {
					if (client.player != null && client.getNetworkHandler() != null) {
						if (cmd.normalized().startsWith("//")) {
							client.getNetworkHandler().sendChatCommand(cmd.normalized().substring(1));
						} else {
							client.getNetworkHandler().sendChatCommand(cmd.normalized());
						}
					}
				});

				if ((index + 1) % 10 == 0 || index == commandsToSchedule.size() - 1) {
					client.execute(() -> {
						if (client.player != null) {
							client.player.sendMessage(Text.literal("[MineBot] ").formatted(Formatting.GOLD)
									.append(Text.literal("Progress: " + (index + 1) + "/" + commandsToSchedule.size())
											.formatted(Formatting.GRAY)),
									false);
						}
					});
				}
			}, (long) i * 150, TimeUnit.MILLISECONDS);
		}
	}
}
