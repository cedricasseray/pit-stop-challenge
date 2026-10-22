import crypto from 'node:crypto';
import { QUESTIONS, CATEGORIES } from '../lib/questions.mjs';
import { sign, json, shuffle, publicQuestion, notify, SID_RE, TOTAL } from '../lib/lib.mjs';

// POST /api/start  { sid, attempt }  ->  { token, step, total, question }
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  const sid = SID_RE.test(body?.sid) ? body.sid : crypto.randomUUID();
  const attempt = Number.isInteger(body?.attempt) ? Math.min(Math.max(body.attempt, 1), 99) : 1;

  // 1 question par catégorie, dans un ordre aléatoire
  const ids = shuffle(
    CATEGORIES.map((cat) => {
      const pool = QUESTIONS.map((q, i) => ({ q, i })).filter((x) => x.q.c === cat);
      return pool[crypto.randomInt(pool.length)].i;
    })
  ).slice(0, TOTAL);

  const now = Date.now();
  const token = sign({ sid, att: attempt, qs: ids, i: 0, ts: now });
  await notify({ type: 'start', sid, attempt });

  return json({ sid, token, step: 1, total: TOTAL, question: publicQuestion(QUESTIONS[ids[0]], sid, ids[0]) });
};

export const config = {
  path: '/api/start',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
