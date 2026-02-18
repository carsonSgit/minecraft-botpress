import { adk, Conversation } from "@botpress/runtime";
import { getMemoryContext, parsePlayerInfo } from "./context.js";
import { logInteraction } from "./logging.js";
import { buildExtractionPrompt } from "./prompt.js";
import { type ResponseResult, ResponseSchema } from "./schema.js";

/** Orchestrates parse -> prompt -> zai.extract -> response mapping -> send -> async log. */
export default new Conversation({
  channel: "*",
  handler: async ({ conversation, message }) => {
    const playerMessage = (message as { payload?: { text?: string } })?.payload?.text ?? "";
    const playerInfo = parsePlayerInfo(playerMessage);
    const memoryContext = playerInfo?.playerUuid
      ? await getMemoryContext(playerInfo.playerUuid)
      : "";

    const prompt = buildExtractionPrompt(playerMessage, memoryContext);
    const extracted = await safeExtract(prompt);
    const { response, summary, commandCount } = mapExtractedResponse(extracted);

    await conversation.send({
      type: "text",
      payload: { text: JSON.stringify(response) },
    });

    if (playerInfo) {
      logInteraction(
        playerInfo.playerUuid,
        playerInfo.playerName,
        stripPlayerPrefix(playerMessage),
        response.type as string,
        summary,
        commandCount,
      );
    }
  },
});

async function safeExtract(prompt: string): Promise<ResponseResult> {
  try {
    return await adk.zai.extract(prompt, ResponseSchema);
  } catch {
    return { type: "chat", text: "I couldn't process that request. Please try again." };
  }
}

function stripPlayerPrefix(message: string): string {
  return message.replace(/\[Player:.*?\]\s*/, "");
}

function mapExtractedResponse(result: ResponseResult): {
  response: Record<string, unknown> & { type: string };
  summary: string;
  commandCount?: number;
} {
  switch (result.type) {
    case "command":
      return {
        response: { type: "command", command: result.command.trim() },
        summary: `Executed: ${result.command.trim()}`,
      };
    case "build":
      return {
        response: {
          type: "build",
          structure: result.structure ?? "cube",
          width: result.width ?? 7,
          height: result.height ?? 5,
          depth: result.depth ?? 7,
          material: result.material ?? "stone",
        },
        summary: `Built ${result.structure ?? "cube"} (${result.material ?? "stone"})`,
      };
    case "worldedit": {
      const commands = result.commands.slice(0, 500);
      return {
        response: {
          type: "worldedit",
          description: result.description,
          commands,
        },
        summary: result.description,
        commandCount: commands.length,
      };
    }
    case "pixelart":
      return {
        response: {
          type: "pixelart",
          url: result.url,
          ...(result.size ? { size: result.size } : {}),
        },
        summary: `Pixel art from ${result.url}`,
      };
    default:
      return {
        response: { type: "chat", text: result.text },
        summary: result.text.slice(0, 100),
      };
  }
}
