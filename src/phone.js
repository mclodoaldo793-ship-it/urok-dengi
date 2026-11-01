/* ================= PHONE: the student's screen ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const fmt = n => (n < 0 ? '−' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const plural = (n, one, few, many) => { n = Math.abs(n) % 100; const d = n % 10; if (n > 10 && n < 20) return many; if (d > 1 && d < 5) return few; if (d === 1) return one; return many; };
const ls = {
  get(k) { try { return localStorage.getItem('dengi-p:' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('dengi-p:' + k, v); } catch (e) {} }
};

let cid = ls.get('cid');
if (!/^p[a-z0-9]{8,24}$/.test(cid || '')) { cid = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); ls.set('cid', cid); }
const readCode = () => (location.hash.slice(1) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
let code = readCode(), S = null, lastTs = 0, nonce = 0, t0 = Date.now(), lastPoll = '';
let votes = {}; try { votes = JSON.parse(ls.get('votes') || '{}') || {}; } catch (e) {}
let viewer = ls.get('viewer') === '1';
let form = null, formKey = '', sentOid = null, dirty = false;
const main = $('#main');
const tS = () => `${LIVE_NS}/${code}/s`, tI = () => `${LIVE_NS}/${code}/i`;

/* ---------- connection ---------- */
const conns = [];
function onMessage(topic, payload) {
  if (topic !== tS()) return;
  if (payload === '') { S = { mode:'gone' }; lastTs = 0; return render(); }
  let m; try { m = JSON.parse(payload); } catch (e) { return; }
  if (!m || m.v !== 1 || typeof m.ts !== 'number' || m.ts < lastTs) return;
  lastTs = m.ts; S = m; render();
}
function send(t, data) {
  const n = Date.now().toString(36) + (++nonce);
  const msg = JSON.stringify({ c: cid, n, t, ...data });
  conns.forEach(c => c.publish(tI(), msg, false));
  return n;
}
function hi() {
  const p = S && S.mode === 'poll' && S.poll;
  send('hi', p && votes[p.id] ? { p: p.id, k: votes[p.id] } : {});
}
function connect() {
  if (conns.length || !code) return;
  LIVE_BROKERS.forEach((url, k) => conns.push(MQ.connect(url, {
    id: cid.slice(0, 14) + k + Math.random().toString(36).slice(2, 6), subs: [tS()], onMessage,
    onState: ok => { net(); if (ok) hi(); }
  })));
  setInterval(hi, 15000);
  setInterval(() => { if (!S) render(); net(); }, 3000);
}
function net() {
  const up = conns.some(c => c.ok);
  const el = $('#net');
  el.textContent = !code ? '' : up ? '● на связи' : '○ подключаемся…';
  el.className = 'ph-net ' + (up ? 'ok' : '');
}
window.addEventListener('hashchange', () => {
  const c = readCode(); if (!c || c === code) return;
  conns.forEach(k => k.unsubscribe(tS()));
  code = c; S = null; lastTs = 0;
  conns.length ? conns.forEach(k => k.subscribe(tS())) : connect();
  render();
});

/* ---------- screens ---------- */
function join() {
  main.innerHTML = `<div class="card center">
    <div class="big-e">🔑</div>
    <h1>Введите код урока</h1>
    <p class="muted">Код написан на экране под QR-кодом.</p>
    <form id="joinF" class="join"><input id="joinIn" maxlength="5" autocomplete="off" autocapitalize="characters" placeholder="ABCDE" aria-label="Код урока"><button class="btn">Войти</button></form>
  </div>`;
  $('#joinF').addEventListener('submit', e => { e.preventDefault(); const v = $('#joinIn').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length === 5) location.hash = v; });
}
function waiting() {
  const slow = Date.now() - t0 > 9000;
  main.innerHTML = `<div class="card center"><div class="spin"></div>
    <h1>${slow ? 'Ищем урок…' : 'Подключаемся…'}</h1>
    <p class="muted">${slow ? 'Проверьте интернет. Если ведущий ещё не открыл урок, страница подключится сама, как только он начнёт.' : 'Секунду.'}</p>
    <p class="muted small">Код урока: <b>${esc(code)}</b></p></div>`;
}
function idle(gone) {
  main.innerHTML = gone
    ? `<div class="card center"><div class="big-e">🔄</div><h1>Ведущий сменил код</h1><p class="muted">Отсканируйте новый QR-код с экрана.</p></div>`
    : `<div class="card center"><div class="big-e eyes">👀</div><h1>Смотрите на экран</h1><p class="muted">Когда ведущий откроет вопрос, голосование появится здесь само. Страницу можно не закрывать.</p></div>`;
}
function poll(p) {
  if (p.id !== lastPoll) { lastPoll = p.id; try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} }
  const mine = votes[p.id], total = p.tally ? Object.values(p.tally).reduce((a, b) => a + b, 0) : 0;
  const right = p.opts.find(o => o.k === p.answer);
  let st = mine ? '✓ Голос принят. Можно передумать, пока не открыли ответ.' : 'Выберите вариант 👇';
  if (p.rev && p.answer) st = mine === p.answer ? '🎉 Вы угадали!' : mine ? `Мимо! Правильный ответ: ${esc(right ? right.t : '')}` : `Правильный ответ: ${esc(right ? right.t : '')}`;
  main.innerHTML = `<div class="pp ${p.rev ? 'rev' : ''}">
    <p class="pp-sub">${esc(p.sub || 'Голосование')}</p>
    <h1 class="pp-q">${esc(p.q)}</h1>
    <div class="pp-opts">${p.opts.map(o => {
      let cls = mine === o.k ? 'on' : '';
      if (p.rev && p.answer) cls += o.k === p.answer ? ' right' : mine === o.k ? ' wrong' : ' dim';
      const pct = total ? Math.round((p.tally[o.k] || 0) / total * 100) : 0;
      return `<button class="pp-o ${cls}" data-k="${esc(o.k)}" ${p.rev ? 'disabled' : ''}>${p.rev && total ? `<i style="width:${pct}%"></i>` : ''}<span>${esc(o.t)}</span>${p.rev && total ? `<b>${pct}%</b>` : ''}</button>`;
    }).join('')}</div>
    <p class="pp-st ${p.rev && p.answer ? (mine === p.answer ? 'good' : 'bad') : ''}">${st}</p>
    ${p.n ? `<p class="muted small center">Уже проголосовали: ${p.n}</p>` : ''}
  </div>`;
}
main.addEventListener('click', e => {
  const o = e.target.closest('.pp-o'); if (!o || o.disabled || !S || !S.poll) return;
  const id = S.poll.id, k = o.dataset.k;
  votes[id] = k; ls.set('votes', JSON.stringify(votes));
  send('vote', { p: id, k });
  setTimeout(() => { if (votes[id] === k) send('vote', { p: id, k }); }, 1500);
  poll(S.poll);
});

/* ---------- coffee battle ---------- */
function game(g) {
  const me = g.teams.findIndex(t => t.cap === cid);
  if (me < 0) { form = null; formKey = ''; return viewer ? watch(g) : claim(g); }
  const t = g.teams[me];
  const head = `<div class="pg-team t${me}"><span>${t.emoji}</span><div><small>Вы капитан</small><b>${esc(t.name)}</b></div><b class="pg-money">${fmt(t.money)} ₽</b></div>`;
  if (g.phase === 'orders') {
    const key = `${g.round}:${me}`;
    if (formKey !== key) {
      formKey = key; sentOid = null; dirty = false;
      main.innerHTML = `<div class="pg">
        <div id="pgHead"></div>
        <div class="pg-news"><span class="pg-ne">${g.ev.e}</span><div><small>Раунд ${g.round} из ${g.rounds}</small><b>${esc(g.ev.t)}</b><p>${esc(g.ev.x)}</p><p class="pg-facts">👥 Кофе захотят <b>${g.ev.n} человек</b> · ☕ чашка обходится в <b>${g.ev.cost} ₽</b> · ${g.ev.max < 100 ? `дороже <b>${g.ev.max} ₽</b> не купят` : `купят даже за <b>${g.ev.max} ₽</b>`}</p></div></div>
        <div id="pform"></div>
        <div class="pg-send"><button class="btn big" id="pSend">Отправить решение</button><p id="pSt" class="muted center"></p></div>
      </div>`;
      form = coffeeForm($('#pform'), t, g.ev, null, {
        change() { dirty = true; status(g.teams[me]); }
      });
      $('#pSend').addEventListener('click', () => {
        const v = form.value; sentOid = send('order', { team: me, ...v }); dirty = false; status(S.game.teams[me]);
        setTimeout(() => { if (sentOid && S.game.teams[me].oid !== sentOid) sentOid = send('order', { team: me, ...form.value }); }, 2500);
      });
    } else form.update(t, g.ev);
    $('#pgHead').innerHTML = head;
    return status(t);
  }
  form = null; formKey = '';
  if (g.phase === 'lobby') {
    main.innerHTML = `<div class="pg">${head}<div class="card center"><div class="big-e">☕</div><h1>Вы капитан!</h1><p class="muted">Ждём начала игры. Решать будете вы, но советуйтесь с командой: в каждом раунде нужно выбрать цену чашки.</p><button class="btn ghost" id="pUncap">Я не капитан</button></div></div>`;
    $('#pUncap').addEventListener('click', () => send('uncap', {}));
  } else if (g.phase === 'reveal' && t.res) {
    const r = t.res, o = g.teams[1 - me].res;
    const v = !o || r.profit === o.profit ? 0 : r.profit > o.profit ? 1 : -1;
    const sg = n => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + '&nbsp;₽';
    main.innerHTML = `<div class="pg">${head}<div class="card center pres ${v > 0 ? 'win' : ''}">
      <p class="pres-v">${v > 0 ? '🎉 Вы заработали больше соперника' : v < 0 ? 'Соперник заработал больше' : 'В этом раунде ничья'}</p>
      <div class="pres-p ${r.profit >= 0 ? 'up' : 'down'}">${sg(r.profit)}</div>
      <p>${r.sold} ${plural(r.sold, 'чашка', 'чашки', 'чашек')} × ${r.price - r.unit} ₽ с чашки${r.tax ? ` − ${fmt(r.tax)} ₽ налог` : ''}</p>
      <p class="muted">Цена ${r.price} ₽, кофе обошёлся в ${r.unit} ₽</p>
      ${o ? `<p class="pres-o">У соперника: <b>${sg(o.profit)}</b></p>` : ''}
    </div></div>`;
  } else if (g.phase === 'over') {
    const win = g.winner === me, draw = g.winner === -1;
    main.innerHTML = `<div class="pg">${head}<div class="card center"><div class="big-e">${draw ? '🤝' : win ? '🏆' : '🥈'}</div>
      <h1>${draw ? 'Ничья!' : win ? 'Ваша кофейня победила!' : 'Второе место'}</h1>
      <p class="muted">В кассе в конце игры: <b>${fmt(t.final)}&nbsp;₽</b></p></div></div>`;
  } else watch(g);
}
function status(t) {
  const el = $('#pSt'); if (!el) return;
  if (sentOid && t.oid === sentOid && !dirty) el.innerHTML = '<b class="good">✅ Решение принято.</b> Можно поменять и отправить снова, пока ведущий не вскрыл решения.';
  else if (sentOid && dirty) el.textContent = 'Есть изменения — нажмите «Отправить решение» ещё раз.';
  else if (sentOid) el.textContent = 'Отправляем…';
  else el.textContent = t.ready ? 'Решение уже отправлено с другого устройства или ведущим.' : 'Соперники не видят ваше решение.';
}
function claim(g) {
  main.innerHTML = `<div class="card center"><div class="big-e">☕</div><h1>Битва кофеен</h1>
    <p class="muted">Капитан вводит решения за команду. Остальные советуют — и смотрят на экран.</p>
    <div class="claim">${g.teams.map((t, i) => `<button class="btn big t${i}" data-claim="${i}" ${t.cap ? 'disabled' : ''}>${t.emoji} Я капитан «${esc(t.name)}»${t.cap ? '<small>капитан уже есть</small>' : ''}</button>`).join('')}</div>
    <button class="btn ghost" id="pWatch">Я просто болею 👀</button></div>`;
}
function watch(g) {
  main.innerHTML = `<div class="card center"><div class="big-e eyes">👀</div><h1>Смотрите на экран</h1>
    ${g.ev && g.phase !== 'over' ? `<p class="muted">Раунд ${g.round}: ${g.ev.e} ${esc(g.ev.t)}</p>` : ''}
    <div class="score">${g.teams.map((t, i) => `<div class="t${i}"><span>${t.emoji} ${esc(t.name)}</span><b>${fmt(g.phase === 'over' ? t.final : t.money)} ₽</b></div>`).join('')}</div>
    <p class="muted small">Подсказывайте своему капитану!</p>
    <button class="btn ghost" id="pBeCap">Я капитан</button></div>`;
}
main.addEventListener('click', e => {
  const c = e.target.closest('[data-claim]');
  if (c && !c.disabled) { viewer = false; ls.set('viewer', '0'); send('cap', { team: +c.dataset.claim }); c.textContent = 'Подключаем…'; setTimeout(render, 4000); }
  if (e.target.closest('#pWatch')) { viewer = true; ls.set('viewer', '1'); render(); }
  if (e.target.closest('#pBeCap')) { viewer = false; ls.set('viewer', '0'); render(); }
});

function render() {
  net();
  if (!code) return join();
  connect();
  if (!S) return waiting();
  if (S.mode === 'gone') return idle(true);
  if (S.mode !== 'game') { form = null; formKey = ''; }
  if (S.mode === 'poll' && S.poll) return poll(S.poll);
  if (S.mode === 'game' && S.game) return game(S.game);
  idle();
}

/* keep the screen awake during the lesson, where the browser allows it */
document.addEventListener('click', () => { try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {} }, { once: true });
render();
