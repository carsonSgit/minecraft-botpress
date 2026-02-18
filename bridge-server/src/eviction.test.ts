import assert from "node:assert/strict";
import test from "node:test";

process.env.MAX_SESSIONS = "100";
process.env.SESSION_TTL_MS = "60000";
process.env.RATE_LIMIT_TTL_MS = "60000";

const botpressModule = await import("./botpress-service.js");
const rateLimitModule = await import("./rate-limiter.js");

const { __sessionInternals, getSessionCleanupStats } = botpressModule;
const { __rateLimitInternals, isRateLimited, getRateLimitCleanupStats } = rateLimitModule;

function withMockedNow<T>(now: number, fn: () => T): T {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

test("evicts oldest sessions when MAX_SESSIONS is exceeded", () => {
  __sessionInternals.sessions.clear();
  const base = 1_700_000_000_000;

  for (let i = 0; i < 200; i += 1) {
    __sessionInternals.sessions.set(`player-${i}`, {
      chatKey: `chat-${i}`,
      conversationId: `conv-${i}`,
      userId: `user-${i}`,
      lastSeenMessageId: null,
      lastSeenAt: base + i,
    });
  }

  withMockedNow(base + 500, () => {
    __sessionInternals.cleanupSessions("test");
  });

  assert.equal(__sessionInternals.sessions.size, 100);
  assert.equal(__sessionInternals.sessions.has("player-0"), false);
  assert.equal(__sessionInternals.sessions.has("player-99"), false);
  assert.equal(__sessionInternals.sessions.has("player-100"), true);
  assert.equal(__sessionInternals.sessions.has("player-199"), true);

  const stats = getSessionCleanupStats();
  assert.ok(stats.maxEvictions >= 100);
});

test("evicts stale sessions using SESSION_TTL_MS", () => {
  __sessionInternals.sessions.clear();
  const base = 1_700_000_000_000;

  __sessionInternals.sessions.set("stale", {
    chatKey: "chat-stale",
    conversationId: "conv-stale",
    userId: "user-stale",
    lastSeenMessageId: null,
    lastSeenAt: base,
  });

  __sessionInternals.sessions.set("fresh", {
    chatKey: "chat-fresh",
    conversationId: "conv-fresh",
    userId: "user-fresh",
    lastSeenMessageId: null,
    lastSeenAt: base + 59_000,
  });

  withMockedNow(base + 61_000, () => {
    __sessionInternals.cleanupSessions("test");
  });

  assert.equal(__sessionInternals.sessions.has("stale"), false);
  assert.equal(__sessionInternals.sessions.has("fresh"), true);
});

test("evicts stale rate-limit entries for many unique UUIDs", () => {
  __rateLimitInternals.lastRequest.clear();
  const base = 1_700_000_000_000;

  withMockedNow(base, () => {
    for (let i = 0; i < 5000; i += 1) {
      assert.equal(isRateLimited(`uuid-${i}`), false);
    }
  });

  assert.equal(__rateLimitInternals.lastRequest.size, 5000);

  withMockedNow(base + 61_000, () => {
    __rateLimitInternals.cleanupRateLimitEntries("test");
  });

  assert.equal(__rateLimitInternals.lastRequest.size, 0);
  const stats = getRateLimitCleanupStats();
  assert.ok(stats.staleEvictions >= 5000);
});
