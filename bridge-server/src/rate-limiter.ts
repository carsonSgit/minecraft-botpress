const COOLDOWN_MS = 2000;
const RATE_LIMIT_TTL_MS = getPositiveIntEnv("RATE_LIMIT_TTL_MS", 5 * 60 * 1000);
const RATE_LIMIT_CLEANUP_INTERVAL_MS = Math.max(1000, Math.floor(RATE_LIMIT_TTL_MS / 2));

interface RateLimitEntry {
  lastRequestAt: number;
}

interface RateLimitStats {
  cleanupRuns: number;
  staleEvictions: number;
  lastCleanupAt: number | null;
}

const lastRequest = new Map<string, RateLimitEntry>();
const rateLimitStats: RateLimitStats = {
  cleanupRuns: 0,
  staleEvictions: 0,
  lastCleanupAt: null,
};

const cleanupTimer = setInterval(() => {
  cleanupRateLimitEntries("periodic");
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

export function isRateLimited(playerUUID: string): boolean {
  cleanupRateLimitEntries("on_request");

  const now = Date.now();
  const entry = lastRequest.get(playerUUID);
  if (entry && now - entry.lastRequestAt < COOLDOWN_MS) {
    return true;
  }

  lastRequest.set(playerUUID, { lastRequestAt: now });
  return false;
}

export function getRateLimitCleanupStats() {
  return {
    trackedPlayers: lastRequest.size,
    cooldownMs: COOLDOWN_MS,
    rateLimitTtlMs: RATE_LIMIT_TTL_MS,
    cleanupIntervalMs: RATE_LIMIT_CLEANUP_INTERVAL_MS,
    ...rateLimitStats,
  };
}

function cleanupRateLimitEntries(_reason: string): void {
  const now = Date.now();
  let staleEvictions = 0;

  for (const [playerUUID, entry] of lastRequest.entries()) {
    if (now - entry.lastRequestAt > RATE_LIMIT_TTL_MS) {
      lastRequest.delete(playerUUID);
      staleEvictions += 1;
    }
  }

  rateLimitStats.cleanupRuns += 1;
  rateLimitStats.staleEvictions += staleEvictions;
  rateLimitStats.lastCleanupAt = now;
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

export const __rateLimitInternals = {
  cleanupRateLimitEntries,
  lastRequest,
};
