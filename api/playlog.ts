// Vercel Function: playtest logs from the Vercel build, kept in a private
// Vercel Blob store so Claude can read them without copy-paste.
//   POST /api/playlog          the game sends one finished log (public)
//   GET  /api/playlog          index of stored logs, newest first
//   GET  /api/playlog?id=…     one log
//   GET  /api/playlog?all=1    the newest logs in full (limit=N, max 50)
//   GET  /api/playlog?all=1&played=hand
//                              the same, only runs played by hand: no Test Lab
//                              Watch run the bot played (all or part, V3 log
//                              v65 `control`), dev watch run or bot run
// Reads only answer on per-deployment URLs (td-cargo-ship-<hash>-…vercel.app),
// which Vercel Authentication protects, so the public site can write but not
// read. Needs a Blob store connected to the project (BLOB_READ_WRITE_TOKEN);
// until then POST answers 503 and the game keeps the log to resend later.

import { get, list, put } from '@vercel/blob';

const PREFIX = 'playlogs/';
const MAX_BYTES = 1024 * 1024;
const ID_RE = /^[0-9A-Za-z-]{1,64}$/;
const READ_HOST_RE = /^(td-cargo-ship-[a-z0-9]{9}-50cals-projects\.vercel\.app|localhost(:\d+)?)$/;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });

/** Writes may come from the game served at another address (playlogStore's
 *  REMOTE_LOG_URL); reads stay on the protected deployment URLs only. */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

/** Just enough shape to keep junk out; the game's PlayLog is the real schema. */
function validLog(x: unknown): x is { id: string; map: string; seed: number; commands: unknown[] } {
  const l = x as Record<string, unknown> | null;
  return (
    !!l &&
    typeof l.id === 'string' &&
    ID_RE.test(l.id) &&
    typeof l.v === 'number' &&
    typeof l.map === 'string' &&
    typeof l.seed === 'number' &&
    Array.isArray(l.commands)
  );
}

export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413, CORS);
  let log: unknown;
  try {
    log = JSON.parse(text);
  } catch {
    return json({ error: 'not json' }, 400, CORS);
  }
  if (!validLog(log)) return json({ error: 'not a playtest log' }, 400, CORS);
  try {
    await put(`${PREFIX}${log.id}.json`, text, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    // Most often: no Blob store connected yet. The client keeps the log.
    console.error('playlog store failed:', e instanceof Error ? e.message : e);
    return json({ error: 'storage unavailable' }, 503, CORS);
  }
  return json({ ok: true, id: log.id }, 200, CORS);
}

/** How a log's run was played (V3 log v65; any older or V2 log is read the
 *  same way): 'sim' or 'mixed' when a bot played any of it. Kept in step
 *  with src/v3/sim/playlog.ts `playKind`, without the game's code. */
function playedBy(x: unknown): 'full playtest' | 'sim' | 'mixed' {
  const l = (x ?? {}) as { control?: { label?: string }; dev?: { watch?: boolean }; device?: { ua?: string }; commands?: unknown[] };
  if (l.control?.label === 'sim' || l.control?.label === 'mixed' || l.control?.label === 'full playtest') return l.control.label;
  if (l.control || l.dev?.watch || l.device?.ua === 'mimic') {
    const takes = (l.commands ?? []).some((c) => Array.isArray(c) && c[1] === 'c' && c[2] === 'you');
    return takes ? 'mixed' : 'sim';
  }
  const bot = (l.commands ?? []).some((c) => Array.isArray(c) && c[1] === 'c' && c[2] === 'bot');
  return bot ? 'mixed' : 'full playtest';
}

async function readLog(pathname: string): Promise<unknown> {
  const r = await get(pathname, { access: 'private', useCache: false });
  return r ? JSON.parse(await new Response(r.stream).text()) : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (!READ_HOST_RE.test(host)) return json({ error: 'read from a protected deployment URL' }, 403);
  try {
    const id = url.searchParams.get('id');
    if (id !== null) {
      if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400);
      const log = await readLog(`${PREFIX}${id}.json`);
      return log ? json(log) : json({ error: 'not found' }, 404);
    }
    const blobs = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
    if (url.searchParams.get('all')) {
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
      // played=hand: the tools that read how the player plays (the bot
      // fit) leave out what a bot played.
      if (url.searchParams.get('played') === 'hand') {
        const out: unknown[] = [];
        for (let i = 0; i < blobs.length && out.length < limit; i += limit) {
          const page = await Promise.all(blobs.slice(i, i + limit).map((b) => readLog(b.pathname)));
          out.push(...page.filter((l) => l && playedBy(l) === 'full playtest'));
        }
        return json(out.slice(0, limit));
      }
      return json(await Promise.all(blobs.slice(0, limit).map((b) => readLog(b.pathname))));
    }
    return json({
      count: blobs.length,
      logs: blobs.map((b) => ({ id: b.pathname.slice(PREFIX.length, -'.json'.length), size: b.size, uploadedAt: b.uploadedAt })),
    });
  } catch (e) {
    return json({ error: 'storage unavailable', detail: e instanceof Error ? e.message : String(e) }, 503);
  }
}
