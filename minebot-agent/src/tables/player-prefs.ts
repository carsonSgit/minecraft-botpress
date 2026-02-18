import { Table, z } from "@botpress/runtime";

export const PlayerPrefsTable = new Table({
  name: "playerprefsTable",
  keyColumn: "playerUuid",
  columns: {
    playerUuid: z.string().describe("Minecraft player UUID"),
    playerName: z.string().describe("Last known player name"),
    preferredMaterial: z.string().optional().describe("Player's preferred building material"),
    preferredStyle: z
      .string()
      .optional()
      .describe("Player's preferred building style (e.g. medieval, modern)"),
    lastSeenAt: z.string().describe("ISO timestamp of last interaction"),
    interactionCount: z.number().int().describe("Total number of interactions"),
    notes: z.string().optional().describe("Freeform notes about the player's preferences"),
  },
});
