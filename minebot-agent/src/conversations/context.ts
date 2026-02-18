import { BuildHistoryTable } from "../tables/build-history.js";
import { PlayerPrefsTable } from "../tables/player-prefs.js";

/** Parses player headers and assembles prompt memory context from tables. */
export type PlayerInfo = { playerName: string; playerUuid: string };

export function parsePlayerInfo(text: string): PlayerInfo | null {
  const match = text.match(/\[Player:\s*(.+?)\s*\|\s*UUID:\s*(.+?)\]/);
  if (match) return { playerName: match[1], playerUuid: match[2] };

  // Fallback to old format without UUID
  const oldMatch = text.match(/\[Player:\s*(.+?)\]/);
  if (oldMatch) return { playerName: oldMatch[1], playerUuid: "" };

  return null;
}

export async function getMemoryContext(playerUuid: string): Promise<string> {
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
