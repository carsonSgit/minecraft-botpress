import "dotenv/config";
import express from "express";
import {
  clearAllSessions,
  clearSession,
  getSessionCleanupStats,
  sendAndWaitForReply,
} from "./botpress-service.js";
import { processPixelArt } from "./pixel-art.js";
import { getRateLimitCleanupStats, isRateLimited } from "./rate-limiter.js";
import { ChatRequestSchema } from "./types.js";
import { parseAndValidate } from "./validator.js";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000", 10);
const WEBHOOK_ID = process.env.BOTPRESS_WEBHOOK_ID as string;

if (!WEBHOOK_ID) {
  console.error("BOTPRESS_WEBHOOK_ID is required in .env");
  process.exit(1);
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    cleanup: {
      sessions: getSessionCleanupStats(),
      rateLimits: getRateLimitCleanupStats(),
    },
  });
});

app.post("/chat", async (req, res) => {
  const startTime = Date.now();
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      type: "error",
      text: `Invalid request: ${parsed.error.issues[0].message}`,
    });
    return;
  }

  const { playerName, playerUUID, message } = parsed.data;
  console.log(
    `[${new Date().toISOString()}] POST /chat from ${playerName} (${playerUUID}): "${message}"`,
  );

  if (isRateLimited(playerUUID)) {
    console.log(`[${new Date().toISOString()}] Rate limited: ${playerUUID}`);
    res.json({ type: "error", text: "Please wait before sending another message." });
    return;
  }

  try {
    const contextMessage = `[Player: ${playerName} | UUID: ${playerUUID}] ${message}`;
    const rawReply = await sendAndWaitForReply(WEBHOOK_ID, playerUUID, contextMessage);
    console.log(`[${new Date().toISOString()}] Raw reply: ${rawReply}`);
    const response = parseAndValidate(rawReply);

    // Convert pixelart → worldedit on the bridge side (mod sees standard worldedit)
    if (response.type === "pixelart") {
      const { playerX, playerY, playerZ } = parsed.data;
      console.log(`[${new Date().toISOString()}] Processing pixel art: ${response.url}`);
      const result = await processPixelArt(
        response.url,
        playerX ?? 0,
        playerY ?? 64,
        playerZ ?? 0,
        500,
      );
      const duration = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] Pixel art done (${duration}ms): ${result.commands.length} commands`,
      );
      res.json({ type: "worldedit", description: result.description, commands: result.commands });
      return;
    }

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Response (${duration}ms): type=${response.type}`);
    res.json(response);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Chat error (${duration}ms):`, err);
    res.json({
      type: "error",
      text: "Failed to get AI response. Please try again.",
    });
  }
});

app.post("/reset/:playerUUID", (req, res) => {
  const { playerUUID } = req.params;
  const cleared = clearSession(playerUUID);
  console.log(`[${new Date().toISOString()}] POST /reset/${playerUUID} - cleared: ${cleared}`);
  res.json({ status: "ok", cleared });
});

app.post("/reset-all", (_req, res) => {
  const count = clearAllSessions();
  console.log(`[${new Date().toISOString()}] POST /reset-all - cleared ${count} sessions`);
  res.json({ status: "ok", cleared: count });
});

app.listen(PORT, () => {
  console.log(`MineBot Bridge server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
