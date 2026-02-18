package com.botpress.command;

import java.util.ArrayList;
import java.util.List;

public final class CommandValidation {
	private CommandValidation() {
	}

	public static ValidatedCommand validate(String command) {
		String normalized = normalize(command);
		if (normalized.isEmpty()) {
			return new ValidatedCommand(command, normalized, "<empty>", false,
					"Command not allowed: /<empty> (empty command)");
		}

		String baseCommand = extractBaseCommand(normalized);
		if (!GeneratedCommandWhitelist.WHITELISTED_COMMANDS.contains(baseCommand)) {
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

		if (normalized.startsWith("/")) {
			normalized = normalized.substring(1);
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
