import { parseEvent, type EventRow } from './parse';

type Env = {
  ALLOWED_ORIGIN: string;
  DB: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };
  RATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
};

const MAX_BODY_CHARS = 2000;

const INSERT = `INSERT INTO events (event, puzzle, result, score, misses, top_speed, seconds_per_piece, islands, streak)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const respond = (status: number) => new Response(null, { status });

function readBody(text: string): EventRow | null {
  if (text.length > MAX_BODY_CHARS) return null;
  try {
    return parseEvent(JSON.parse(text));
  } catch {
    return null;
  }
}

// The game posts with sendBeacon as plain text: no preflight, and it never reads the response.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return respond(405);
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return respond(403);
    // The address is only a short-lived counter key here. It is never stored.
    const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.RATE_LIMIT && !(await env.RATE_LIMIT.limit({ key })).success) return respond(429);

    const row = readBody(await request.text());
    if (!row) return respond(400);
    await env.DB.prepare(INSERT)
      .bind(row.event, row.puzzle, row.result, row.score, row.misses, row.top_speed, row.seconds_per_piece, row.islands, row.streak)
      .run();
    return respond(204);
  },
};
