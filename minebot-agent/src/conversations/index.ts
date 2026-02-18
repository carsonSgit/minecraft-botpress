import { Conversation, z, adk } from "@botpress/runtime";
import { PlayerPrefsTable } from "../tables/player-prefs.js";
import { BuildHistoryTable } from "../tables/build-history.js";
import MinecraftKB from "../knowledge/minecraft-kb.js";

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
You have access to Minecraft knowledge about crafting, mobs, and building.

## Classification (pick the MOST specific match)

1. **chat** - General questions, greetings, help, conversation, anything not involving commands or building.
   Use your Minecraft knowledge to give helpful, accurate answers about crafting recipes, mob behavior, building tips, etc.

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

   ### Multi-Step Planning (for complex requests)
   For large or complex requests (e.g. "build a village", "make a castle with towers"), decompose into 2-5 logical sub-steps:
   1. Insert a tellraw progress message before each step:
      tellraw @s {"text":"[MineBot] Step 1/3: Building the foundation...","color":"yellow"}
   2. Then the actual build commands for that step
   3. Insert the next tellraw for step 2, etc.
   4. End with a completion message:
      tellraw @s {"text":"[MineBot] Done! Built a village with 3 houses and a well.","color":"green"}
   5. Space structures with appropriate offsets from player position
   6. Keep total command count under 500

   ### Undo Support
   When the player says "undo", "undo last build", or "undo the [thing]":
   - Check the player's build history (provided in memory context) for the last worldedit action
   - Generate the appropriate number of //undo commands to reverse it
   - The commandCount from build history tells you how many //undo commands to issue
   - Example: if last build used 50 commands, generate 50 //undo commands
   - If no history is available, generate a reasonable number (e.g. 10) of //undo commands

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
- The player message is prefixed with "[Player: name | UUID: uuid]" - this is just context, respond naturally.
- "make it night" or "make it daytime" → type: command
- "give me diamonds" → type: command
- "build a house" → type: build
- "render the botpress logo" → type: pixelart (url: "https://avatars.githubusercontent.com/u/23510677?s=280&v=4")
- "render pixel art of https://example.com/img.png" → type: pixelart (url from message)
- "build a castle" → type: worldedit (with multi-step planning)
- "build a small village" → type: worldedit (decompose into steps with tellraw markers)
- "undo last build" → type: worldedit (generate //undo commands based on history)`;

// Parse player UUID from context message format: [Player: name | UUID: uuid]
function parsePlayerInfo(text: string): { playerName: string; playerUuid: string } | null {
  const match = text.match(/\[Player:\s*(.+?)\s*\|\s*UUID:\s*(.+?)\]/);
  if (match) return { playerName: match[1], playerUuid: match[2] };
  // Fallback to old format without UUID
  const oldMatch = text.match(/\[Player:\s*(.+?)\]/);
  if (oldMatch) return { playerName: oldMatch[1], playerUuid: "" };
  return null;
}

async function getMemoryContext(playerUuid: string): Promise<string> {
  if (!playerUuid) return "";

  let context = "";

  try {
    const prefsResult = await PlayerPrefsTable.findRows({
      filter: { playerUuid: { $eq: playerUuid } },
    });
    if (prefsResult.rows.length > 0) {
      const prefs = prefsResult.rows[0];
      context += "\n## Player Memory\n";
      context += `- Name: ${prefs.playerName}\n`;
      context += `- Interactions: ${prefs.interactionCount}\n`;
      if (prefs.preferredMaterial) context += `- Preferred material: ${prefs.preferredMaterial}\n`;
      if (prefs.preferredStyle) context += `- Preferred style: ${prefs.preferredStyle}\n`;
      if (prefs.notes) context += `- Notes: ${prefs.notes}\n`;
    }
  } catch {
    // Table may not exist yet on first run
  }

  try {
    const historyResult = await BuildHistoryTable.findRows({
      filter: { playerUuid: { $eq: playerUuid } },
    });
    if (historyResult.rows.length > 0) {
      const recent = historyResult.rows.slice(-5);
      context += "\n## Recent Build History\n";
      for (const row of recent) {
        const cmdInfo = row.commandCount ? ` (${row.commandCount} commands)` : "";
        context += `- [${row.actionType}] "${row.request}" → ${row.responseSummary}${cmdInfo}\n`;
      }
    }
  } catch {
    // Table may not exist yet
  }

  return context;
}

async function logInteraction(
  playerUuid: string,
  playerName: string,
  request: string,
  actionType: string,
  responseSummary: string,
  commandCount?: number
): Promise<void> {
  if (!playerUuid) return;

  try {
    // Log to build history
    await BuildHistoryTable.createRows({
      rows: [
        {
          playerUuid,
          actionType: actionType as "chat" | "command" | "build" | "worldedit" | "pixelart",
          request,
          responseSummary,
          commandCount: commandCount ?? 0,
          builtAt: new Date().toISOString(),
        },
      ],
    });

    // Upsert player prefs
    const existing = await PlayerPrefsTable.findRows({
      filter: { playerUuid: { $eq: playerUuid } },
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      await PlayerPrefsTable.updateRows({
        rows: [
          {
            id: row.id,
            playerName,
            lastSeenAt: new Date().toISOString(),
            interactionCount: (row.interactionCount ?? 0) + 1,
          },
        ],
      });
    } else {
      await PlayerPrefsTable.createRows({
        rows: [
          {
            playerUuid,
            playerName,
            lastSeenAt: new Date().toISOString(),
            interactionCount: 1,
          },
        ],
      });
    }
  } catch {
    // Don't fail the response if logging fails
  }
}

export default new Conversation({
  channel: "*",
  handler: async ({ conversation, message, execute }) => {
    const playerMessage =
      (message as { payload?: { text?: string } })?.payload?.text ?? "";

    const playerInfo = parsePlayerInfo(playerMessage);
    const memoryContext = playerInfo?.playerUuid
      ? await getMemoryContext(playerInfo.playerUuid)
      : "";

    // For chat-type questions about Minecraft, use execute() with knowledge
    // For intent classification, use zai.extract() (fast, structured)
    const prompt = `${INSTRUCTIONS}${memoryContext}

Player message: ${playerMessage}

Classify this player message and generate the appropriate structured response.`;

    const result = await adk.zai.extract(prompt, ResponseSchema);

    // Build the response object with only the relevant fields for the type
    let response: Record<string, unknown>;
    let summary = "";
    let cmdCount: number | undefined;

    switch (result.type) {
      case "command":
        response = { type: "command", command: result.command ?? "" };
        summary = `Executed: ${result.command ?? ""}`;
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
        summary = `Built ${result.structure ?? "cube"} (${result.material ?? "stone"})`;
        break;
      case "worldedit":
        response = {
          type: "worldedit",
          description: result.description ?? "Building...",
          commands: result.commands ?? [],
        };
        summary = result.description ?? "WorldEdit sequence";
        cmdCount = (result.commands ?? []).length;
        break;
      case "pixelart":
        response = {
          type: "pixelart",
          url: result.url ?? "",
          ...(result.size ? { size: result.size } : {}),
        };
        summary = `Pixel art from ${result.url ?? "unknown URL"}`;
        break;
      default:
        response = { type: "chat", text: result.text ?? "I'm not sure how to help with that." };
        summary = (result.text ?? "").slice(0, 100);
        break;
    }

    await conversation.send({
      type: "text",
      payload: { text: JSON.stringify(response) },
    });

    // Log interaction in background (don't block response)
    if (playerInfo) {
      const rawRequest = playerMessage.replace(/\[Player:.*?\]\s*/, "");
      logInteraction(
        playerInfo.playerUuid,
        playerInfo.playerName,
        rawRequest,
        result.type,
        summary,
        cmdCount
      );
    }
  },
});
