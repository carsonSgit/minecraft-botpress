package com.botpress.command;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class CommandValidation {
	private static final Set<String> WHITELISTED_COMMANDS = Set.of(
			// Vanilla
			"time", "weather", "give", "tp", "gamemode", "difficulty", "effect", "kill", "clear", "summon", "setblock",
			"fill", "clone", "enchant", "xp", "spawnpoint", "setworldspawn", "playsound", "title", "tellraw",
			"particle", "locate",
			// WorldEdit
			"//set", "//replace", "//walls", "//outline", "//hollow", "//copy", "//paste", "//cut", "//rotate",
			"//flip", "//stack", "//move", "//undo", "//redo", "//pos1", "//pos2", "//hpos1", "//hpos2", "//expand",
			"//contract", "//shift", "//cyl", "//hcyl", "//sphere", "//hsphere", "//pyramid", "//hpyramid", "//wand",
			"//sel", "//line", "//curve", "//drain", "//regen");

	private CommandValidation() {
	}

	public static ValidatedCommand validate(String command) {
		String normalized = normalize(command);
		if (normalized.isEmpty()) {
			return new ValidatedCommand(command, normalized, "<empty>", false,
					"Command not allowed: /<empty> (empty command)");
		}

		String baseCommand = extractBaseCommand(normalized);
		if (!WHITELISTED_COMMANDS.contains(baseCommand)) {
			return new ValidatedCommand(command, normalized, baseCommand, false,
					"Command not allowed: /" + baseCommand);
		}

		return new ValidatedCommand(command, normalized, baseCommand, true, null);
	}

	public static SequenceValidationResult validateSequence(List<String> commands, boolean strictMode) {
		List<ValidatedCommand> validCommands = new ArrayList<>();
		List<ValidatedCommand> invalidCommands = new ArrayList<>();

		for (String command : commands) {
			ValidatedCommand validated = validate(command);
			if (validated.valid()) {
				validCommands.add(validated);
			} else {
				invalidCommands.add(validated);
				if (strictMode) {
					break;
				}
			}
		}

		boolean shouldAbort = strictMode ? !invalidCommands.isEmpty() : validCommands.isEmpty();
		return new SequenceValidationResult(validCommands, invalidCommands, strictMode, shouldAbort);
	}

	private static String normalize(String command) {
		return command == null ? "" : command.trim();
	}

	private static String extractBaseCommand(String normalized) {
		if (normalized.startsWith("//")) {
			String[] parts = normalized.substring(2).split("\\s+");
			return "//" + parts[0];
		}

		return normalized.split("\\s+")[0];
	}

	public record ValidatedCommand(String raw, String normalized, String baseCommand, boolean valid,
			String errorMessage) {
	}

	public record SequenceValidationResult(List<ValidatedCommand> validCommands, List<ValidatedCommand> invalidCommands,
			boolean strictMode, boolean shouldAbort) {
	}
}
