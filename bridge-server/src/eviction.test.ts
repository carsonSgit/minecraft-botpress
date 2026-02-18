import assert from "node:assert/strict";
import test from "node:test";

process.env.MAX_SESSIONS = "100";
process.env.SESSION_TTL_MS = "60000";
process.env.RATE_LIMIT_TTL_MS = "60000";

const botpressModule = await import("./botpress-service.js");
const rateLimitModule = await import("./rate-limiter.js");

const {
  __test_clearSessions,
  __test_getSessionCount,
  __test_hasSession,
  __test_runSessionCleanup,
  __test_seedSession,
  getSessionCleanupStats,
} = botpressModule;

const {
  __test_clearRateLimitEntries,
  __test_getRateLimitCount,
  __test_runRateLimitCleanup,
  getRateLimitCleanupStats,
  isRateLimited,
} = rateLimitModule;

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
  __test_clearSessions();
  const base = 1_700_000_000_000;

  for (let i = 0; i < 200; i += 1) {
    __test_seedSession(`player-${i}`, {
      chatKey: `chat-${i}`,
      conversationId: `conv-${i}`,
      userId: `user-${i}`,
      lastSeenMessageId: null,
      lastSeenAt: base + i,
    });
  }

  withMockedNow(base + 500, () => {
    __test_runSessionCleanup();
  });

  assert.equal(__test_getSessionCount(), 100);
  assert.equal(__test_hasSession("player-0"), false);
  assert.equal(__test_hasSession("player-99"), false);
  assert.equal(__test_hasSession("player-100"), true);
  assert.equal(__test_hasSession("player-199"), true);

  const stats = getSessionCleanupStats();
  assert.ok(stats.maxEvictions >= 100);
});

test("evicts stale sessions using SESSION_TTL_MS", () => {
  __test_clearSessions();
  const base = 1_700_000_000_000;

  __test_seedSession("stale", {
    chatKey: "chat-stale",
    conversationId: "conv-stale",
    userId: "user-stale",
    lastSeenMessageId: null,
    lastSeenAt: base,
  });

  __test_seedSession("fresh", {
    chatKey: "chat-fresh",
    conversationId: "conv-fresh",
    userId: "user-fresh",
    lastSeenMessageId: null,
    lastSeenAt: base + 59_000,
  });

  withMockedNow(base + 61_000, () => {
    __test_runSessionCleanup();
  });

  assert.equal(__test_hasSession("stale"), false);
  assert.equal(__test_hasSession("fresh"), true);
});

test("evicts stale rate-limit entries for many unique UUIDs", () => {
  __test_clearRateLimitEntries();
  const base = 1_700_000_000_000;

  withMockedNow(base, () => {
    for (let i = 0; i < 5000; i += 1) {
      assert.equal(isRateLimited(`uuid-${i}`), false);
    }
  });

  assert.equal(__test_getRateLimitCount(), 5000);

  withMockedNow(base + 61_000, () => {
    __test_runRateLimitCleanup();
  });

  assert.equal(__test_getRateLimitCount(), 0);
  const stats = getRateLimitCleanupStats();
  assert.ok(stats.staleEvictions >= 5000);
});
