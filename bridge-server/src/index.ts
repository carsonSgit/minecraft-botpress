import "dotenv/config";
import express from "express";
import { ChatRequestSchema } from "./types.js";
import { isRateLimited } from "./rate-limiter.js";
import { sendAndWaitForReply } from "./botpress-service.js";
import { parseAndValidate } from "./validator.js";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000", 10);
const WEBHOOK_ID = process.env.BOTPRESS_WEBHOOK_ID;

if (!WEBHOOK_ID) {
  console.error("BOTPRESS_WEBHOOK_ID is required in .env");
  process.exit(1);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      type: "error",
      text: "Invalid request: " + parsed.error.issues[0].message,
    });
    return;
  }

  const { playerName, playerUUID, message } = parsed.data;

  if (isRateLimited(playerUUID)) {
    res.json({ type: "error", text: "Please wait before sending another message." });
    return;
  }

  try {
    const contextMessage = `[Player: ${playerName}] ${message}`;
    const rawReply = await sendAndWaitForReply(WEBHOOK_ID!, playerUUID, contextMessage);
    const response = parseAndValidate(rawReply);
    res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    res.json({
      type: "error",
      text: "Failed to get AI response. Please try again.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`MineBot Bridge server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
