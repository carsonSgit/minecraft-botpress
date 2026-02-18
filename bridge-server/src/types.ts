import { z } from "zod";

export const ChatRequestSchema = z.object({
  playerName: z.string().min(1),
  playerUUID: z.string().min(1),
  message: z.string().min(1).max(500),
  playerX: z.number().int().optional(),
  playerY: z.number().int().optional(),
  playerZ: z.number().int().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("command"),
    command: z.string(),
  }),
  z.object({
    type: z.literal("build"),
    structure: z.enum(["cube", "house", "tower", "platform"]),
    width: z.number().int().min(1).max(64),
    height: z.number().int().min(1).max(64),
    depth: z.number().int().min(1).max(64),
    material: z.string(),
  }),
  z.object({
    type: z.literal("worldedit"),
    description: z.string(),
    commands: z.array(z.string()).min(1).max(500),
    strictMode: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("pixelart"),
    url: z.string(),
    size: z.number().int().min(8).max(128).optional(),
  }),
  z.object({
    type: z.literal("error"),
    text: z.string(),
  }),
]);

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
