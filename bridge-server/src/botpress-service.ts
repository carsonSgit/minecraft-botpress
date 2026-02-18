interface Session {
  chatKey: string;
  conversationId: string;
  userId: string;
  lastSeenMessageId: string | null;
  lastSeenAt: number;
}

interface SessionCleanupStats {
  cleanupRuns: number;
  staleEvictions: number;
  maxEvictions: number;
  lastCleanupAt: number | null;
}

const sessions = new Map<string, Session>();

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30000;

const SESSION_TTL_MS = getPositiveIntEnv("SESSION_TTL_MS", 30 * 60 * 1000);
const MAX_SESSIONS = getPositiveIntEnv("MAX_SESSIONS", 10000);

const sessionStats: SessionCleanupStats = {
  cleanupRuns: 0,
  staleEvictions: 0,
  maxEvictions: 0,
  lastCleanupAt: null,
};

const SESSION_CLEANUP_INTERVAL_MS = Math.max(1000, Math.floor(SESSION_TTL_MS / 2));
const cleanupTimer = setInterval(() => {
  cleanupSessions("periodic");
}, SESSION_CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

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

export async function getOrCreateSession(webhookId: string, playerUUID: string): Promise<Session> {
  cleanupSessions("on_get_or_create");

  const existing = sessions.get(playerUUID);
  if (existing) {
    touchSession(playerUUID, existing);
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
      `Botpress createUser did not return a key. Response: ${JSON.stringify(userRes)}`,
    );
  }

  // Create conversation
  const convRes = await chatApi(webhookId, "/conversations", {
    method: "POST",
    chatKey,
    body: {},
  });

  const now = Date.now();
  const session: Session = {
    chatKey,
    conversationId: convRes.conversation.id,
    userId,
    lastSeenMessageId: null,
    lastSeenAt: now,
  };

  sessions.set(playerUUID, session);
  enforceSessionCap();
  return session;
}

export async function sendAndWaitForReply(
  webhookId: string,
  playerUUID: string,
  message: string,
): Promise<string> {
  const session = await getOrCreateSession(webhookId, playerUUID);
  touchSession(playerUUID, session);

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

    const listRes = await chatApi(webhookId, `/conversations/${session.conversationId}/messages`, {
      chatKey: session.chatKey,
    });

    const messages: Array<{ id: string; userId: string; payload: { text?: string } }> =
      listRes.messages || [];

    const botMessages = messages.filter((m) => m.userId !== session.userId);

    if (botMessages.length > 0) {
      const latest = botMessages[0];

      if (latest.id !== previousLastSeenId) {
        session.lastSeenMessageId = latest.id;
        touchSession(playerUUID, session);
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

export function getSessionCleanupStats() {
  return {
    activeSessions: sessions.size,
    sessionTtlMs: SESSION_TTL_MS,
    maxSessions: MAX_SESSIONS,
    cleanupIntervalMs: SESSION_CLEANUP_INTERVAL_MS,
    ...sessionStats,
  };
}

function touchSession(playerUUID: string, session: Session) {
  session.lastSeenAt = Date.now();
  sessions.delete(playerUUID);
  sessions.set(playerUUID, session);
}

function cleanupSessions(_reason: string): void {
  const now = Date.now();
  let staleEvictions = 0;

  for (const [playerUUID, session] of sessions.entries()) {
    if (now - session.lastSeenAt > SESSION_TTL_MS) {
      sessions.delete(playerUUID);
      staleEvictions += 1;
    }
  }

  sessionStats.cleanupRuns += 1;
  sessionStats.staleEvictions += staleEvictions;
  sessionStats.lastCleanupAt = now;

  enforceSessionCap();
}

function enforceSessionCap(): void {
  while (sessions.size > MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (!oldest) {
      break;
    }
    sessions.delete(oldest);
    sessionStats.maxEvictions += 1;
  }
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(`[config] Invalid ${name}="${raw}", using default ${fallback}`);
    return fallback;
  }

  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __sessionInternals = {
  cleanupSessions,
  sessions,
};
