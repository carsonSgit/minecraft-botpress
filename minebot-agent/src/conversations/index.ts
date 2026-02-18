import { Autonomous, Conversation, z } from "@botpress/runtime";

const ChatExit = new Autonomous.Exit({
  name: "chat",
  description:
    "Use this exit when the player is asking a general question, having a conversation, or requesting information that does NOT involve a Minecraft command or building a structure.",
  schema: z.object({
    text: z
      .string()
      .describe("The response text to display to the player in chat"),
  }),
});

const CommandExit = new Autonomous.Exit({
  name: "command",
  description:
    "Use this exit when the player wants to execute a Minecraft game command. Only these commands are allowed: time, weather, give, tp, gamemode, difficulty, effect. Do NOT include a leading slash.",
  schema: z.object({
    command: z
      .string()
      .describe(
        'The Minecraft command to execute, without leading slash. Examples: "time set day", "weather rain", "give @s diamond 64", "gamemode creative", "effect give @s speed 60 1"',
      ),
  }),
});

const BuildExit = new Autonomous.Exit({
  name: "build",
  description:
    "Use this exit when the player wants to build or construct a structure in the world. Available structures: cube, house, tower, platform.",
  schema: z.object({
    structure: z
      .enum(["cube", "house", "tower", "platform"])
      .describe("The type of structure to build"),
    width: z
      .number()
      .int()
      .min(1)
      .max(64)
      .describe("Width of the structure in blocks (X axis). Default to 7 if not specified."),
    height: z
      .number()
      .int()
      .min(1)
      .max(64)
      .describe("Height of the structure in blocks (Y axis). Default to 5 if not specified."),
    depth: z
      .number()
      .int()
      .min(1)
      .max(64)
      .describe("Depth of the structure in blocks (Z axis). Default to 7 if not specified."),
    material: z
      .string()
      .describe(
        'Minecraft block ID without namespace prefix. Examples: "stone", "oak_planks", "cobblestone", "bricks"',
      ),
  }),
});

const INSTRUCTIONS = `You are MineBot, a helpful Minecraft AI assistant that lives inside the game.
Your job is to classify player intent and respond appropriately.

## Rules

1. **Chat**: For general questions, greetings, help requests, or conversation, use the "chat" exit.

2. **Commands**: For game commands, use the "command" exit. Only these base commands are allowed:
   - time (e.g. "time set day", "time set 0")
   - weather (e.g. "weather clear", "weather rain")
   - give (e.g. "give @s diamond 64", "give @s iron_sword 1")
   - tp (e.g. "tp @s 0 100 0")
   - gamemode (e.g. "gamemode creative", "gamemode survival")
   - difficulty (e.g. "difficulty peaceful", "difficulty hard")
   - effect (e.g. "effect give @s speed 60 1")

   Do NOT include a leading slash. The player reference is always @s (self).

3. **Build**: For building or construction requests, use the "build" exit. Available structures:
   - cube: A solid box of blocks
   - house: A hollow structure with walls, roof, and a door opening
   - tower: A tall hollow structure with a door opening
   - platform: A flat single-layer surface

   Use reasonable defaults for dimensions if the player doesn't specify (7x5x7 for house, 5x10x5 for tower, 3x3x3 for cube, 10x1x10 for platform).
   Material should be a valid Minecraft block ID without "minecraft:" prefix.

## Important
- Be concise in chat responses.
- Always pick the most specific exit that matches the player's intent.
- For build requests, infer reasonable dimensions and materials from context.
- The player message is prefixed with "[Player: name]" - this is just context, respond naturally.`;

export default new Conversation({
  channel: "*",
  handler: async ({ execute, conversation }) => {
    const result = await execute({
      instructions: INSTRUCTIONS,
      exits: [ChatExit, CommandExit, BuildExit],
      mode: "worker",
      iterations: 5,
    });

    let response: Record<string, unknown>;

    if (result.is(ChatExit)) {
      response = { type: "chat", text: result.output.text };
    } else if (result.is(CommandExit)) {
      response = { type: "command", command: result.output.command };
    } else if (result.is(BuildExit)) {
      response = {
        type: "build",
        structure: result.output.structure,
        width: result.output.width,
        height: result.output.height,
        depth: result.output.depth,
        material: result.output.material,
      };
    } else {
      response = { type: "chat", text: "I'm not sure how to help with that." };
    }

    await conversation.send({
      type: "text",
      payload: { text: JSON.stringify(response) },
    });
  },
});
