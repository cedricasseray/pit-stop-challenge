import crypto from 'node:crypto';

const secret = () => {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error('TOKEN_SECRET manquant ou trop court');
  return s;
};

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest();
  let given;
  try { given = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Identifiant opaque d'une réponse : on ne peut pas deviner laquelle est la bonne.
export const choiceId = (sid, qid, idx) =>
  crypto.createHmac('sha256', secret()).update(`${sid}:${qid}:${idx}`).digest('base64url').slice(0, 10);

// Question envoyée au navigateur : jamais de bonne réponse, réponses mélangées.
export function publicQuestion(q, sid, qid) {
  return {
    text: q.q,
    choices: shuffle(q.a.map((label, idx) => ({ id: choiceId(sid, qid, idx), label }))),
  };
}

// Envoi à Make (email + Google Sheet). Silencieux en cas d'échec : ne bloque jamais le joueur.
export async function notify(event) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;
  const now = new Date();
  const body = {
    ...event,
    at: now.toISOString(),
    atParis: now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* ignoré */ }
}

export const SID_RE = /^[a-zA-Z0-9-]{8,48}$/;
export const TOTAL = 5;
