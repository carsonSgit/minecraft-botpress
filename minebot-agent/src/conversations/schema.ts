import { z } from "@botpress/runtime";

/** Schema for zai.extract output consumed by the conversation orchestrator. */
export const ResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat"),
    text: z.string().min(1).describe("Response text shown to the player."),
  }),
  z.object({
    type: z.literal("command"),
    command: z.string().min(1).describe("Single vanilla command without leading slash."),
  }),
  z.object({
    type: z.literal("build"),
    structure: z
      .enum(["cube", "house", "tower", "platform"])
      .optional()
      .describe("Structure type for simple build mode."),
    width: z.number().int().min(1).max(64).optional(),
    height: z.number().int().min(1).max(64).optional(),
    depth: z.number().int().min(1).max(64).optional(),
    material: z.string().min(1).optional().describe("Minecraft block id, no namespace required."),
  }),
  z.object({
    type: z.literal("worldedit"),
    description: z.string().min(1).describe("Human-readable summary of the command sequence."),
    commands: z
      .array(z.string().min(1))
      .max(500)
      .describe("WorldEdit/vanilla command sequence, max 500 entries."),
  }),
  z.object({
    type: z.literal("pixelart"),
    url: z.string().url().describe("Image URL to render."),
    size: z.number().int().min(8).max(128).optional(),
  }),
]);

export type ResponseResult = z.infer<typeof ResponseSchema>;
