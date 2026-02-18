import { BuildHistoryTable } from "../tables/build-history.js";
import { PlayerPrefsTable } from "../tables/player-prefs.js";
import type { ResponseType } from "./schema.js";

/** Persists conversation events to build history and player preference tables. */
export async function logInteraction(
  playerUuid: string,
  playerName: string,
  request: string,
  actionType: ResponseType,
  responseSummary: string,
  commandCount?: number,
): Promise<void> {
  if (!playerUuid) return;

  try {
    // Log to build history
    await BuildHistoryTable.createRows({
      rows: [
        {
          playerUuid,
          actionType,
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
