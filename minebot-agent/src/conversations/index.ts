import { Autonomous, Conversation, z } from "@botpress/runtime";

const ChatExit = new Autonomous.Exit({
  name: "chat",
  description:
    "Use this exit when the player is asking a general question, having a conversation, or requesting information that does NOT involve a Minecraft command, building a structure, or WorldEdit operations.",
  schema: z.object({
    text: z
      .string()
      .describe("The response text to display to the player in chat"),
  }),
});

const CommandExit = new Autonomous.Exit({
  name: "command",
  description:
    "Use this exit when the player wants to execute a single Minecraft game command. Allowed commands: time, weather, give, tp, gamemode, difficulty, effect, kill, clear, summon, setblock, fill, clone, enchant, xp, spawnpoint, setworldspawn, playsound, title, tellraw, particle, locate. Do NOT include a leading slash.",
  schema: z.object({
    command: z
      .string()
      .describe(
        'The Minecraft command to execute, without leading slash. Examples: "time set day", "weather rain", "give @s diamond 64", "gamemode creative", "effect give @s speed 60 1", "summon creeper", "kill @e[type=zombie]", "fill ~0 ~-1 ~0 ~10 ~-1 ~10 stone", "setblock ~ ~1 ~ torch"',
      ),
  }),
});

const BuildExit = new Autonomous.Exit({
  name: "build",
  description:
    "Use this exit when the player wants to build a simple predefined structure (cube, house, tower, platform). For complex or custom builds, use the worldedit exit instead.",
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

const WorldEditExit = new Autonomous.Exit({
  name: "worldedit",
  description:
    "Use this exit when the player wants to perform complex building operations, WorldEdit commands, pixel art, logos, or any multi-command building task. Returns a sequence of commands to execute.",
  schema: z.object({
    description: z
      .string()
      .describe("A short human-readable description of what the commands will do"),
    commands: z
      .array(z.string())
      .min(1)
      .max(200)
      .describe(
        'Array of commands to execute in sequence. Use // prefix for WorldEdit commands (e.g. "//set stone"). Use vanilla commands without slash (e.g. "setblock ~1 ~0 ~0 red_concrete"). Commands are executed 150ms apart.',
      ),
  }),
});

const INSTRUCTIONS = `You are MineBot, a helpful Minecraft AI assistant that lives inside the game.
Your job is to classify player intent and respond with one of four action types.

## Classification (pick the MOST specific match)

1. **Chat** - General questions, greetings, help, conversation, anything not involving commands or building.

2. **Command** - Player wants a single Minecraft command executed. Allowed vanilla commands:
   - time (e.g. "time set day", "time set 0")
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

3. **Build** - Player wants a simple predefined structure (cube, house, tower, platform) with a material. Use reasonable defaults if dimensions not specified.

4. **WorldEdit** - Player wants complex builds, pixel art, logos, terrain editing, or multi-command sequences. Use this for:
   - Any request involving WorldEdit operations (//set, //replace, //walls, //copy, //paste, etc.)
   - Pixel art or logo building (use setblock commands with colored concrete)
   - Any build that requires multiple commands in sequence

   ### WorldEdit command format
   - Use "//" prefix for WorldEdit commands: "//set stone", "//replace dirt stone", "//walls oak_planks"
   - Use vanilla commands without slash: "setblock ~1 ~0 ~0 red_concrete"
   - Maximum 200 commands per sequence
   - Commands execute 150ms apart

   ### Botpress Logo (pixel art)
   When asked to build a Botpress logo, use setblock commands with colored concrete blocks on a ~15x15 grid.
   Use white_concrete for the background, blue_concrete for the main icon shape, and light_blue_concrete for accents.
   Place blocks relative to player position using ~ coordinates. Build on a vertical plane (~X ~Y ~0).

   ### Available colored blocks
   All 16 colors of concrete: white_concrete, orange_concrete, magenta_concrete, light_blue_concrete, yellow_concrete, lime_concrete, pink_concrete, gray_concrete, light_gray_concrete, cyan_concrete, purple_concrete, blue_concrete, brown_concrete, green_concrete, red_concrete, black_concrete
   All 16 colors of wool: same color prefixes with _wool suffix.

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
      exits: [ChatExit, CommandExit, BuildExit, WorldEditExit],
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
    } else if (result.is(WorldEditExit)) {
      response = {
        type: "worldedit",
        description: result.output.description,
        commands: result.output.commands,
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
