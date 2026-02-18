const COOLDOWN_MS = 2000;
const lastRequest = new Map<string, number>();

export function isRateLimited(playerUUID: string): boolean {
  const now = Date.now();
  const last = lastRequest.get(playerUUID);
  if (last && now - last < COOLDOWN_MS) {
    return true;
  }
  lastRequest.set(playerUUID, now);
  return false;
}
