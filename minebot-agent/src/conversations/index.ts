import { Conversation, z, adk } from "@botpress/runtime";

const ResponseSchema = z.object({
  type: z
    .enum(["chat", "command", "build", "worldedit", "pixelart"])
    .describe(
      "The action type. 'chat' for conversation/questions/greetings. 'command' for a single Minecraft command. 'build' for simple structures. 'worldedit' for complex builds or multi-command sequences. 'pixelart' for rendering images as pixel art in Minecraft.",
    ),
  text: z
    .string()
    .optional()
    .describe("Required for chat type: the response text to display to the player"),
  command: z
    .string()
    .optional()
    .describe(
      "Required for command type: the Minecraft command without leading slash. Examples: 'time set night', 'give @s diamond 64', 'weather rain', 'gamemode creative'",
    ),
  structure: z
    .enum(["cube", "house", "tower", "platform"])
    .optional()
    .describe("Required for build type: the type of structure to build"),
  width: z
    .number()
    .int()
    .min(1)
    .max(64)
    .optional()
    .describe("Required for build type: width in blocks (X axis). Default to 7 if not specified."),
  height: z
    .number()
    .int()
    .min(1)
    .max(64)
    .optional()
    .describe("Required for build type: height in blocks (Y axis). Default to 5 if not specified."),
  depth: z
    .number()
    .int()
    .min(1)
    .max(64)
    .optional()
    .describe("Required for build type: depth in blocks (Z axis). Default to 7 if not specified."),
  material: z
    .string()
    .optional()
    .describe(
      "Required for build type: Minecraft block ID without namespace prefix. Examples: 'stone', 'oak_planks', 'cobblestone', 'bricks'",
    ),
  description: z
    .string()
    .optional()
    .describe("Required for worldedit type: a short human-readable description of what the commands will do"),
  commands: z
    .array(z.string())
    .optional()
    .describe(
      "Required for worldedit type: array of commands to execute in sequence. Use // prefix for WorldEdit commands (e.g. '//set stone'). Use vanilla commands without slash (e.g. 'setblock ~1 ~0 ~0 red_concrete'). Max 500 commands.",
    ),
  url: z
    .string()
    .optional()
    .describe("Required for pixelart type: the URL of the image to render as pixel art"),
  size: z
    .number()
    .int()
    .min(8)
    .max(128)
    .optional()
    .describe("Optional for pixelart type: max pixel art size (default 64, range 8-128)"),
});

const INSTRUCTIONS = `You are MineBot, a helpful Minecraft AI assistant that lives inside the game.
Your job is to classify player intent and respond with the correct action type.

## Classification (pick the MOST specific match)

1. **chat** - General questions, greetings, help, conversation, anything not involving commands or building.

2. **command** - Player wants a single Minecraft command executed. Allowed vanilla commands:
   - time (e.g. "time set day", "time set 0", "time set night")
   - weather (e.g. "weather clear", "weather rain")
   - give (e.g. "give @s diamond 64", "give @s iron_sword 1")
   - tp (e.g. "tp @s 0 100 0")
   - gamemode (e.g. "gamemode creative", "gamemode survival")
   - difficulty (e.g. "difficulty peaceful", "difficulty hard")
   - effect (e.g. "effect give @s speed 60 1")
   - kill (e.g. "kill @e[type=zombie]")
   - clear (e.g. "clear @s")
   - summon (e.g. "summon creeper ~ ~ ~")
   - setblock (e.g. "setblock ~ ~1 ~ torch")
   - fill (e.g. "fill ~0 ~-1 ~0 ~10 ~-1 ~10 stone")
   - clone, enchant, xp, spawnpoint, setworldspawn, playsound, title, tellraw, particle, locate

   Do NOT include a leading slash. Player reference is @s (self).

3. **build** - Player wants a simple predefined structure (cube, house, tower, platform) with a material. Use reasonable defaults if dimensions not specified.

4. **worldedit** - Player wants complex builds, terrain editing, or multi-command sequences. Use this for:
   - Any request involving WorldEdit operations (//set, //replace, //walls, //copy, //paste, etc.)
   - Any build that requires multiple commands in sequence
   - Maximum 500 commands per sequence
   - Commands execute 150ms apart

   ### WorldEdit command format
   - Use "//" prefix for WorldEdit commands: "//set stone", "//replace dirt stone", "//walls oak_planks"
   - Use vanilla commands without slash: "setblock ~1 ~0 ~0 red_concrete"

   ### Available colored blocks
   All 16 colors of concrete: white_concrete, orange_concrete, magenta_concrete, light_blue_concrete, yellow_concrete, lime_concrete, pink_concrete, gray_concrete, light_gray_concrete, cyan_concrete, purple_concrete, blue_concrete, brown_concrete, green_concrete, red_concrete, black_concrete
   All 16 colors of wool: same color prefixes with _wool suffix.

5. **pixelart** - Player wants to render an image as Minecraft pixel art. Use this for:
   - "render pixel art of [url]", "make pixel art from [url]"
   - "render the botpress logo", "build the botpress logo as pixel art"
   - Any request to turn an image into blocks
   - Provide the image URL in the 'url' field
   - For "botpress logo" or "bp logo", use: https://avatars.githubusercontent.com/u/23510677?s=280&v=4
   - Optionally set 'size' (8-128, default 64) for target resolution

## Important
- Be concise in chat responses.
- Always pick the most specific type that matches the player's intent.
- For build requests, infer reasonable dimensions and materials from context.
- The player message is prefixed with "[Player: name]" - this is just context, respond naturally.
- "make it night" or "make it daytime" → type: command
- "give me diamonds" → type: command
- "build a house" → type: build
- "render the botpress logo" → type: pixelart (url: "https://avatars.githubusercontent.com/u/23510677?s=280&v=4")
- "render pixel art of https://example.com/img.png" → type: pixelart (url from message)
- "build a castle" → type: worldedit`;

export default new Conversation({
  channel: "*",
  handler: async ({ conversation, message }) => {
    const playerMessage =
      (message as { payload?: { text?: string } })?.payload?.text ?? "";

    const prompt = `${INSTRUCTIONS}

Player message: ${playerMessage}

Classify this player message and generate the appropriate structured response.`;

    const result = await adk.zai.extract(prompt, ResponseSchema);

    // Build the response object with only the relevant fields for the type
    let response: Record<string, unknown>;

    switch (result.type) {
      case "command":
        response = { type: "command", command: result.command ?? "" };
        break;
      case "build":
        response = {
          type: "build",
          structure: result.structure ?? "cube",
          width: result.width ?? 7,
          height: result.height ?? 5,
          depth: result.depth ?? 7,
          material: result.material ?? "stone",
        };
        break;
      case "worldedit":
        response = {
          type: "worldedit",
          description: result.description ?? "Building...",
          commands: result.commands ?? [],
        };
        break;
      case "pixelart":
        response = {
          type: "pixelart",
          url: result.url ?? "",
          ...(result.size ? { size: result.size } : {}),
        };
        break;
      default:
        response = { type: "chat", text: result.text ?? "I'm not sure how to help with that." };
        break;
    }

    await conversation.send({
      type: "text",
      payload: { text: JSON.stringify(response) },
    });
  },
});
