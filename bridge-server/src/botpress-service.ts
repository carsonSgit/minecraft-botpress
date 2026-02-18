interface Session {
  chatKey: string;
  conversationId: string;
  userId: string;
  lastSeenMessageId: string | null;
}

const sessions = new Map<string, Session>();

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30000;

async function chatApi(
  webhookId: string,
  path: string,
  options: { method?: string; body?: unknown; chatKey?: string } = {},
) {
  const url = `https://chat.botpress.cloud/${webhookId}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.chatKey) {
    headers["x-user-key"] = options.chatKey;
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat API ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getOrCreateSession(
  webhookId: string,
  playerUUID: string,
): Promise<Session> {
  const existing = sessions.get(playerUUID);
  if (existing) {
    return existing;
  }

  // Create user - returns { user, key }
  const userRes = await chatApi(webhookId, "/users", {
    method: "POST",
    body: { fid: playerUUID },
  });

  const chatKey = userRes.key;
  const userId = userRes.user?.id;

  if (!chatKey) {
    throw new Error(
      "Botpress createUser did not return a key. Response: " +
        JSON.stringify(userRes),
    );
  }

  // Create conversation
  const convRes = await chatApi(webhookId, "/conversations", {
    method: "POST",
    chatKey,
    body: {},
  });

  const session: Session = {
    chatKey,
    conversationId: convRes.conversation.id,
    userId,
    lastSeenMessageId: null,
  };

  sessions.set(playerUUID, session);
  return session;
}

export async function sendAndWaitForReply(
  webhookId: string,
  playerUUID: string,
  message: string,
): Promise<string> {
  const session = await getOrCreateSession(webhookId, playerUUID);

  const previousLastSeenId = session.lastSeenMessageId;

  console.log(`[botpress] Sending message for ${playerUUID}: "${message}"`);

  // Send message
  await chatApi(webhookId, "/messages", {
    method: "POST",
    chatKey: session.chatKey,
    body: {
      conversationId: session.conversationId,
      payload: { type: "text", text: message },
    },
  });

  // Poll for bot response
  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const listRes = await chatApi(
      webhookId,
      `/conversations/${session.conversationId}/messages`,
      { chatKey: session.chatKey },
    );

    const messages: Array<{ id: string; userId: string; payload: { text?: string } }> =
      listRes.messages || [];

    const botMessages = messages.filter((m) => m.userId !== session.userId);

    if (botMessages.length > 0) {
      const latest = botMessages[0];

      if (latest.id !== previousLastSeenId) {
        session.lastSeenMessageId = latest.id;
        console.log(`[botpress] Received reply for ${playerUUID} (msgId: ${latest.id})`);

        if (typeof latest?.payload?.text === "string") {
          return latest.payload.text;
        }
        return JSON.stringify(latest?.payload);
      }
    }
  }

  throw new Error("Timed out waiting for bot response");
}

export function clearSession(playerUUID: string): boolean {
  return sessions.delete(playerUUID);
}

export function clearAllSessions(): number {
  const count = sessions.size;
  sessions.clear();
  return count;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
