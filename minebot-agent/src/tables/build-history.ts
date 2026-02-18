import { Table, z } from "@botpress/runtime";

export const BuildHistoryTable = new Table({
  name: "buildhistoryTable",
  columns: {
    playerUuid: z.string().describe("Minecraft player UUID"),
    actionType: z
      .enum(["chat", "command", "build", "worldedit", "pixelart"])
      .describe("The type of action performed"),
    request: z
      .string()
      .searchable()
      .describe("The original player request"),
    responseSummary: z
      .string()
      .describe("Brief summary of what was done"),
    commandCount: z
      .number()
      .int()
      .optional()
      .describe("Number of commands executed (for worldedit/pixelart)"),
    builtAt: z.string().describe("ISO timestamp of when the action occurred"),
  },
});
