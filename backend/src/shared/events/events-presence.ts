/** Who is in which build and on which screen of it (056). Lives on each socket's data. */
export interface Presence {
  buildId: string;
  testRunId: string | null;
  at: number;
}

export interface Viewer {
  userId: string;
  // first name and the initial of the last one: enough to know who, nothing more (REQ-056-05)
  name: string;
  testRunId: string | null;
}

interface SocketPresence {
  userId?: string;
  name?: string;
  presence?: Presence | null;
}

// ids are uuids; anything longer is not one of ours
const MAX_ID = 64;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID && /^[\w-]+$/.test(value);

/** What a client says it opened, or null when it says nothing usable. */
export function readPresence(body: unknown, now: number): Presence | null {
  if (!body || typeof body !== 'object') return null;
  const { buildId, testRunId } = body as { buildId?: unknown; testRunId?: unknown };
  if (!isId(buildId)) return null;
  return { buildId, testRunId: isId(testRunId) ? testRunId : null, at: now };
}

/** "Olena K.": the name a colleague sees on a tile (REQ-056-05). */
export function shortName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  if (first) return last ? `${first} ${last[0]}.` : first;
  return (user.email ?? '').split('@')[0] || '?';
}

/**
 * The people in a build, one each: with several tabs, the screen of the latest (REQ-056-07).
 */
export function viewersOf(sockets: SocketPresence[], buildId: string): Viewer[] {
  const latest = new Map<string, { viewer: Viewer; at: number }>();
  for (const socket of sockets) {
    const presence = socket.presence;
    if (!socket.userId || !presence || presence.buildId !== buildId) continue;
    const seen = latest.get(socket.userId);
    if (seen && seen.at >= presence.at) continue;
    latest.set(socket.userId, {
      at: presence.at,
      viewer: { userId: socket.userId, name: socket.name ?? '?', testRunId: presence.testRunId },
    });
  }
  return [...latest.values()].map((entry) => entry.viewer).sort((a, b) => a.name.localeCompare(b.name));
}
