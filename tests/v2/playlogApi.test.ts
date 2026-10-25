// The Vercel playtest-log endpoint (api/playlog.ts), with Vercel Blob replaced
// by an in-memory store: what it accepts, what it refuses, and who may read.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { text: string; uploadedAt: Date }>();
let storeDown = false;

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pathname: string, body: string) => {
    if (storeDown) throw new Error('No token found');
    store.set(pathname, { text: body, uploadedAt: new Date(Date.now() + store.size) });
    return { pathname };
  }),
  get: vi.fn(async (pathname: string) => {
    const b = store.get(pathname);
    return b ? { stream: new Response(b.text).body } : null;
  }),
  list: vi.fn(async () => ({
    blobs: [...store].map(([pathname, b]) => ({ pathname, size: b.text.length, uploadedAt: b.uploadedAt })),
    hasMore: false,
  })),
}));

const { GET, POST } = await import('../../api/playlog');

const PUBLIC = 'https://td-cargo-ship.vercel.app/api/playlog';
const PROTECTED = 'https://td-cargo-ship-lu37ljl3y-50cals-projects.vercel.app/api/playlog';
const log = (id: string) => ({ v: 2, id, map: 'strait', seed: 7, firstWave: 1, commands: [[0, 'f', 2]] });
const post = (body: unknown) => POST(new Request(PUBLIC, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const read = (url: string) => GET(new Request(url));

beforeEach(() => {
  store.clear();
  storeDown = false;
});

describe('POST /api/playlog', () => {
  it('stores a log under its id', async () => {
    const res = await post(log('20261025-7'));
    expect(res.status).toBe(200);
    expect(JSON.parse(store.get('playlogs/20261025-7.json')!.text)).toEqual(log('20261025-7'));
  });

  it('refuses junk, bad ids and oversized bodies', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post({ hello: 1 })).status).toBe(400);
    expect((await post(log('../escape'))).status).toBe(400);
    expect((await post({ ...log('big'), pad: 'x'.repeat(1024 * 1024) })).status).toBe(413);
    expect(store.size).toBe(0);
  });

  it('answers 503 when no Blob store is connected, so the game keeps the log', async () => {
    storeDown = true;
    expect((await post(log('a'))).status).toBe(503);
  });
});

describe('GET /api/playlog', () => {
  it('is refused on the public site', async () => {
    await post(log('a'));
    expect((await read(PUBLIC)).status).toBe(403);
    expect((await read('https://td-cargo-ship-50cals-projects.vercel.app/api/playlog')).status).toBe(403);
  });

  it('lists, fetches one, and fetches all on a protected deployment URL', async () => {
    await post(log('first'));
    await post(log('second'));
    const index = await (await read(PROTECTED)).json();
    expect(index.count).toBe(2);
    expect(index.logs.map((l: { id: string }) => l.id)).toEqual(['second', 'first']);
    expect(await (await read(`${PROTECTED}?id=first`)).json()).toEqual(log('first'));
    expect((await read(`${PROTECTED}?id=missing`)).status).toBe(404);
    const all = await (await read(`${PROTECTED}?all=1&limit=1`)).json();
    expect(all).toEqual([log('second')]);
  });
});
