import { Client } from "@botpress/chat";

interface Session {
  client: Client;
  chatKey: string;
  conversationId: string;
  userId: string;
  lastMessageCount: number;
}

const sessions = new Map<string, Session>();

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30000;

export async function getOrCreateSession(
  webhookId: string,
  playerUUID: string,
): Promise<Session> {
  const existing = sessions.get(playerUUID);
  if (existing) {
    return existing;
  }

  const apiUrl = `https://chat.botpress.cloud/${webhookId}`;
  const client = new Client({ apiUrl });

  const { user, key } = await client.createUser({
    fid: playerUUID,
  });

  const { conversation } = await client.createConversation({
    xChatKey: key,
  });

  const session: Session = {
    client,
    chatKey: key,
    conversationId: conversation.id,
    userId: user.id,
    lastMessageCount: 0,
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

  await session.client.createMessage({
    xChatKey: session.chatKey,
    conversationId: session.conversationId,
    payload: { type: "text", text: message },
  });

  session.lastMessageCount++;

  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const { messages } = await session.client.listConversationMessages({
      xChatKey: session.chatKey,
      id: session.conversationId,
    });

    const botMessages = messages.filter(
      (m) => m.userId !== session.userId,
    );

    if (botMessages.length > session.lastMessageCount - 1) {
      const latest = botMessages[0];
      session.lastMessageCount = messages.length;

      const payload = latest.payload as unknown as Record<string, unknown>;
      if (typeof payload?.text === "string") {
        return payload.text;
      }
      return JSON.stringify(payload);
    }
  }

  throw new Error("Timed out waiting for bot response");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
