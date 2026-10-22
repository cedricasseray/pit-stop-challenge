(() => {
  const $ = (id) => document.getElementById(id);
  const screens = ['home', 'quiz', 'fail', 'win', 'error'];
  const show = (name) => screens.forEach((s) => $('screen-' + s).classList.toggle('active', s === name));
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // Identifiant anonyme (aucune donnée personnelle) + compteur de tentatives sur cet appareil
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  let sid = store.get('pitstop_sid');
  if (!sid) {
    sid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    store.set('pitstop_sid', sid);
  }
  let attempt = parseInt(store.get('pitstop_attempt') || '0', 10) || 0;

  let token = null;
  let lastAction = null;
  let busy = false;

  async function api(path, body) {
    const r = await fetch('/api/' + path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.status === 429) throw new Error('Doucement, pilote ! Attendez quelques secondes puis réessayez.');
    if (!r.ok) throw new Error('Petit souci technique. Réessayez dans un instant.');
    return r.json();
  }

  function fail(msg, retry) {
    $('err-text').textContent = msg || 'Petit souci de connexion. Vérifiez votre réseau et réessayez.';
    lastAction = retry;
    show('error');
  }

  function renderQuestion(data) {
    token = data.token || token;
    $('q-label').textContent = `Question ${data.step}/${data.total}`;
    $('q-bar').style.width = `${((data.step - 1) / data.total) * 100}%`;
    $('q-text').textContent = data.question.text;
    $('q-feedback').hidden = true;
    const box = $('q-choices');
    box.innerHTML = '';
    data.question.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.dataset.id = c.id;
      const l = document.createElement('span'); l.className = 'letter'; l.textContent = 'ABCD'[i];
      const t = document.createElement('span'); t.textContent = c.label;
      b.append(l, t);
      b.addEventListener('click', () => choose(b));
      box.appendChild(b);
    });
    show('quiz');
    window.scrollTo({ top: 0 });
  }

  async function startRun() {
    if (busy) return; busy = true;
    attempt += 1; store.set('pitstop_attempt', String(attempt));
    try {
      const data = await api('start', { sid, attempt });
      renderQuestion(data);
    } catch (e) { attempt -= 1; fail(e.message, startRun); }
    busy = false;
  }

  let pendingNext = null;

  async function choose(btn) {
    if (busy) return; busy = true;
    const buttons = [...document.querySelectorAll('.choice')];
    buttons.forEach((b) => (b.disabled = true));
    try {
      const res = await api('answer', { token, choice: btn.dataset.id });
      if (!res.correct) {
        btn.classList.add('ko'); vibrate([120, 60, 120]);
        setTimeout(() => show('fail'), 900);
      } else {
        btn.classList.add('ok'); vibrate(60);
        $('q-bar').style.width = `${(res.done ? 5 : res.step - 1) / 5 * 100}%`;
        if (res.done) {
          setTimeout(() => win(res.code), 1100);
        } else {
          $('fb-title').textContent = 'Bonne réponse ! 🏁';
          $('fb-why').textContent = res.why;
          pendingNext = res;
          $('q-feedback').hidden = false;
          $('q-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } catch (e) {
      buttons.forEach((b) => (b.disabled = false));
      const old = $('q-msg'); if (old) old.remove();
      const msg = Object.assign(document.createElement('p'), { textContent: e.message, className: 'warn', id: 'q-msg' });
      $('q-text').after(msg);
      setTimeout(() => msg.remove(), 4000);
    }
    busy = false;
  }

  function win(code) {
    const box = $('code');
    box.innerHTML = '';
    String(code).split('').forEach((d) => { const s = document.createElement('span'); s.textContent = d; box.appendChild(s); });
    const conf = $('confetti'); conf.innerHTML = '';
    const colors = ['#e10600', '#1f4fd8', '#ffffff', '#c9d2e6', '#5b86ff'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
      p.style.animationDelay = Math.random() * 1.2 + 's';
      conf.appendChild(p);
    }
    show('win'); vibrate([100, 50, 100, 50, 300]);
    window.scrollTo({ top: 0 });
  }

  $('btn-start').addEventListener('click', startRun);
  $('btn-retry').addEventListener('click', startRun);
  $('btn-next').addEventListener('click', () => { if (pendingNext) renderQuestion(pendingNext); pendingNext = null; });
  $('btn-error').addEventListener('click', () => { if (lastAction) lastAction(); else show('home'); });
})();
