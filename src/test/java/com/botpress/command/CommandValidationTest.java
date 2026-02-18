package com.botpress.command;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommandValidationTest {

	@Test
	void validateUsesGeneratedWhitelistForAllowedAndDisallowedCommands() {
		String allowedBase = GeneratedCommandWhitelist.WHITELISTED_COMMANDS.stream().findFirst().orElseThrow();
		CommandValidation.ValidatedCommand allowed = CommandValidation.validate(allowedBase + " arg");

		assertTrue(allowed.valid());
		assertEquals(allowedBase, allowed.baseCommand());

		String disallowedBase = "not-in-generated-whitelist";
		assertFalse(GeneratedCommandWhitelist.WHITELISTED_COMMANDS.contains(disallowedBase));
		CommandValidation.ValidatedCommand disallowed = CommandValidation.validate(disallowedBase + " arg");

		assertFalse(disallowed.valid());
		assertEquals(disallowedBase, disallowed.baseCommand());
	}

	@Test
	void validateNormalizesAndAcceptsWhitelistedCommands() {
		CommandValidation.ValidatedCommand validated = CommandValidation.validate("  //set stone  ");

		assertTrue(validated.valid());
		assertEquals("//set stone", validated.normalized());
		assertEquals("//set", validated.baseCommand());
	}

	@Test
	void emptyCommandProvidesExplicitBaseCommandForErrors() {
		CommandValidation.ValidatedCommand validated = CommandValidation.validate("   ");

		assertFalse(validated.valid());
		assertEquals("<empty>", validated.baseCommand());
	}

	@Test
	void validateSlashPrefixedTimeCommandMapsToTimeBaseCommand() {
		CommandValidation.ValidatedCommand validated = CommandValidation.validate("/time set day");

		assertTrue(validated.valid());
		assertEquals("time", validated.baseCommand());
	}

	@Test
	void validateWorldEditDoubleSlashCommandKeepsDoubleSlashBaseCommand() {
		CommandValidation.ValidatedCommand validated = CommandValidation.validate("//set stone");

		assertTrue(validated.valid());
		assertEquals("//set", validated.baseCommand());
	}

	@Test
	void validateRejectsInvalidSlashPrefixedCommand() {
		CommandValidation.ValidatedCommand validated = CommandValidation.validate("/notallowed");

		assertFalse(validated.valid());
		assertEquals("notallowed", validated.baseCommand());
	}

	@Test
	void strictSequenceRejectsOnFirstInvalidCommand() {
		List<String> commands = List.of("time set day", "notallowed foo", "weather clear");

		CommandValidation.SequenceValidationResult result = CommandValidation.validateSequence(commands, true);

		assertTrue(result.shouldAbort());
		assertEquals(1, result.validCommands().size());
		assertEquals(1, result.invalidCommands().size());
		assertEquals("notallowed", result.invalidCommands().get(0).baseCommand());
	}

	@Test
	void nonStrictSequenceSkipsInvalidCommandsAndContinues() {
		List<String> commands = List.of("time set day", "notallowed foo", "weather clear", "bad again");

		CommandValidation.SequenceValidationResult result = CommandValidation.validateSequence(commands, false);

		assertFalse(result.shouldAbort());
		assertEquals(2, result.validCommands().size());
		assertEquals("time", result.validCommands().get(0).baseCommand());
		assertEquals("weather", result.validCommands().get(1).baseCommand());
		assertEquals(2, result.invalidCommands().size());
		assertEquals("notallowed", result.invalidCommands().get(0).baseCommand());
	}

	@Test
	void nonStrictSequenceAbortsWhenEveryCommandIsInvalid() {
		List<String> commands = List.of("notallowed foo", "bad again");

		CommandValidation.SequenceValidationResult result = CommandValidation.validateSequence(commands, false);

		assertTrue(result.shouldAbort());
		assertTrue(result.validCommands().isEmpty());
		assertEquals(2, result.invalidCommands().size());
	}
}
