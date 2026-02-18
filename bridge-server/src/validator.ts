import { type ChatResponse, ChatResponseSchema } from "./types.js";
import { isCommandWhitelisted, isMaterialValid } from "./whitelist.js";

function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return text.trim();
}

export function parseAndValidate(rawText: string): ChatResponse {
  const stripped = stripCodeFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { type: "chat", text: rawText.trim() };
  }

  const result = ChatResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { type: "chat", text: rawText.trim() };
  }

  const response = result.data;

  // pixelart is handled by the bridge before returning to the mod — no command validation needed
  if (response.type === "pixelart") {
    return response;
  }

  if (response.type === "command") {
    if (!isCommandWhitelisted(response.command)) {
      return {
        type: "error",
        text: `Command not allowed: ${response.command.split(/\s+/)[0]}`,
      };
    }
  }

  if (response.type === "build") {
    if (!isMaterialValid(response.material)) {
      return {
        type: "error",
        text: `Unknown material: ${response.material}`,
      };
    }
  }

  if (response.type === "worldedit") {
    for (const cmd of response.commands) {
      if (!isCommandWhitelisted(cmd)) {
        const base = cmd.trim().startsWith("//")
          ? `//${cmd.trim().substring(2).split(/\s+/)[0]}`
          : cmd.trim().split(/\s+/)[0];
        return {
          type: "error",
          text: `Command not allowed: ${base}`,
        };
      }
    }
  }

  return response;
}
