import { QUESTIONS } from '../lib/questions.mjs';
import { sign, verify, choiceId, json, publicQuestion, notify, TOTAL } from '../lib/lib.mjs';

const MIN_MS_PER_ANSWER = 700; // anti-script : impossible de répondre plus vite

// POST /api/answer  { token, choice }
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  const st = verify(body?.token);
  if (!st || !Array.isArray(st.qs) || st.i < 0 || st.i >= TOTAL) return json({ error: 'invalid_token' }, 400);
  if (typeof body.choice !== 'string') return json({ error: 'bad_request' }, 400);

  const now = Date.now();
  if (now - st.ts < MIN_MS_PER_ANSWER) return json({ error: 'too_fast' }, 429);

  const q = QUESTIONS[st.qs[st.i]];
  if (!q) return json({ error: 'invalid_token' }, 400);

  // La bonne réponse est à la position q.r de la banque ; son identifiant est recalculé ici.
  if (body.choice !== choiceId(st.sid, st.qs[st.i], q.r)) {
    await notify({ type: 'fail', sid: st.sid, attempt: st.att, step: st.i + 1 });
    return json({ correct: false });
  }

  const next = st.i + 1;
  if (next < TOTAL) {
    const token = sign({ ...st, i: next, ts: now });
    return json({
      correct: true,
      why: q.why,
      token,
      step: next + 1,
      total: TOTAL,
      question: publicQuestion(QUESTIONS[st.qs[next]], st.sid, st.qs[next]),
    });
  }

  // Tour parfait : le code n'existe que dans la variable d'environnement PADDOCK_CODE.
  const code = process.env.PADDOCK_CODE;
  if (!code) return json({ error: 'server_config' }, 500);
  await notify({ type: 'win', sid: st.sid, attempt: st.att });
  return json({ correct: true, why: q.why, done: true, code });
};

export const config = {
  path: '/api/answer',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
