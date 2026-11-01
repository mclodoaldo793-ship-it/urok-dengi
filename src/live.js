/* ================= LIVE: students vote from their phones ================= */
/* The presenter publishes the current screen state (retained) to <room>/s; phones send votes and game orders to <room>/i. */
const PHONE_BASE = 'https://mclodoaldo793-ship-it.github.io/urok-dengi/p.html';

const Live = (() => {
  const on = !window.NO_LIVE && 'WebSocket' in window && 'TextEncoder' in window;
  const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 5 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
  let code = store.get('room');
  if (!/^[A-Z0-9]{5}$/.test(code || '')) { code = newCode(); store.set('room', code); }
  const conns = [], seen = new Map(), dedupe = new Set(), dq = [], handlers = {};
  const id = 'dh' + Math.random().toString(36).slice(2, 12);
  let last = '', timer = 0;
  const tS = () => `${LIVE_NS}/${code}/s`, tI = () => `${LIVE_NS}/${code}/i`;

  function phoneUrl() {
    const base = /\.github\.io$/.test(location.hostname) ? new URL('p.html', location.href).href.split('#')[0] : PHONE_BASE;
    return base + '#' + code;
  }
  function count() { const now = Date.now(); let n = 0; seen.forEach(t => { if (now - t < 45000) n++; }); return n; }

  function compose() {
    if (typeof Game !== 'undefined' && Game.isOpen()) return { mode:'game', game: Game.pub() };
    const el = Polls.current(), p = el ? Polls.pub(el) : Polls.held();
    return p ? { mode:'poll', poll: p } : { mode:'idle' };
  }
  function send() { const msg = JSON.stringify({ v:1, ts: Date.now(), ...JSON.parse(last || '{}') }); conns.forEach(c => c.publish(tS(), msg, true)); }
  function refresh(force) {
    if (!on) return;
    const s = JSON.stringify(compose());
    if (!force && s === last) return;
    last = s; clearTimeout(timer); timer = setTimeout(send, 120);
  }

  function onMsg(topic, payload) {
    if (topic !== tI()) return;
    let m; try { m = JSON.parse(payload); } catch (e) { return; }
    if (!m || typeof m !== 'object' || typeof m.c !== 'string' || m.c.length > 40 || typeof m.t !== 'string') return;
    const key = m.c + ':' + m.n;
    if (dedupe.has(key)) return;
    dedupe.add(key); dq.push(key); if (dq.length > 800) dedupe.delete(dq.shift());
    const fresh = !seen.has(m.c);
    seen.set(m.c, Date.now());
    if (fresh) ui();
    if ((m.t === 'vote' || m.t === 'hi') && typeof m.p === 'string' && typeof m.k === 'string') Polls.vote(m.c, m.p, m.k);
    try { handlers[m.t]?.(m); } catch (e) { console.error(e); }
  }

  function qr(url) {
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  function ui() {
    if (!on) return;
    const n = count(), up = conns.filter(c => c.ok).length;
    $('#liveCount').textContent = n;
    $('#btnLive').classList.toggle('off', !up);
    $('#liveStat').textContent = (up ? `Связь есть (${up} из ${conns.length} серверов)` : 'Нет связи с сервером. Проверьте интернет — подключимся сами.') + ` · Телефонов: ${n}`;
    document.body.classList.toggle('live-on', n > 0);
    Game?.liveChanged?.();
  }
  function renderCode() {
    const url = phoneUrl(), svg = qr(url);
    $('#liveQr').innerHTML = svg; $('#joinQr').innerHTML = svg;
    $('#liveUrl').textContent = url.replace(/^https?:\/\//, '');
    $('#liveCode').textContent = code; $('#joinCode').textContent = 'код ' + code;
    Game?.liveChanged?.();
  }
  function setCode(c) {
    conns.forEach(k => { k.publish(tS(), '', true); k.unsubscribe(tI()); });   // clear the old room
    code = c; store.set('room', code);
    conns.forEach(k => k.subscribe(tI()));
    seen.clear(); renderCode(); ui(); refresh(true);
  }
  const ov = () => $('#liveOv');
  function open() { if (!on) return; ov().hidden = false; ui(); }
  function close() { ov().hidden = true; }

  function init() {
    if (!on) { document.body.classList.add('no-live'); return; }
    renderCode();
    LIVE_BROKERS.forEach(url => conns.push(MQ.connect(url, {
      id: id + conns.length, subs: [tI()], onMessage: onMsg,
      onState: ok => { ui(); if (ok && last) send(); }
    })));
    $('#btnLive').addEventListener('click', open);
    $('#joinCard').addEventListener('click', open);
    $('#liveClose').addEventListener('click', close);
    $('#liveNew').addEventListener('click', () => { setCode(newCode()); SFX.click(); });
    ov().addEventListener('click', e => { if (e.target === ov()) close(); });
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, select'))) return;
      if (!ov().hidden && (e.code === 'Escape' || e.code === 'KeyQ')) { close(); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (e.code === 'KeyQ') { open(); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    setInterval(ui, 5000);
    setInterval(() => { if (last) send(); }, 60000);   // keep the retained state fresh
    refresh(true);
  }
  return {
    init, refresh, open, phoneUrl, qr,
    on: (t, f) => { handlers[t] = f; },
    alive: c => Date.now() - (seen.get(c) || 0) < 45000,
    get enabled() { return on; },
    get count() { return count(); },
    get code() { return code; }
  };
})();

/* ---------- polls: any .poll[data-poll] in the current slide ---------- */
/* Markup: .poll[data-poll][data-q][data-answer?][data-reveal-step?] > .poll-opt[data-k] (.pl label, .pn count, .pbar bar) + .pmeta */
const Polls = (() => {
  const votes = {};
  let last = null; // revealed poll whose markup the slide replaced: phones keep seeing its result
  const visible = el => !el.closest('[data-show]:not(.shown), [hidden]');
  function current() {
    if (typeof Game !== 'undefined' && Game.isOpen()) return null;
    const s = Deck.el; if (!s) return null;
    return $$('.poll', s).find(visible) || null;
  }
  function tally(id) { const t = {}; Object.values(votes[id] || {}).forEach(k => { t[k] = (t[k] || 0) + 1; }); return t; }
  const set = (el, prop, v) => { if (el && el[prop] !== v) el[prop] = v; };
  function render(el) {
    const id = el.dataset.poll, t = tally(id), total = Object.values(t).reduce((a, b) => a + b, 0);
    const rev = el.classList.contains('revealed'), ans = el.dataset.answer, self = el.hasAttribute('data-self');
    $$('.poll-opt', el).forEach(o => {
      const n = t[o.dataset.k] || 0;
      set(o.querySelector('.pn'), 'textContent', total ? String(n) : '');
      const bar = o.querySelector('.pbar'); if (bar) bar.style.width = total ? (n / total * 100).toFixed(1) + '%' : '0%';
      if (self) return;
      o.classList.toggle('right', rev && !!ans && o.dataset.k === ans);
      o.classList.toggle('wrong', rev && !!ans && o.dataset.k !== ans && o.dataset.k === el.dataset.pick);
      o.classList.toggle('dim', rev && !!ans && o.dataset.k !== ans);
    });
    set(el.querySelector('.pmeta'), 'textContent', total ? `📱 Голосов: ${total}` : (Live.count ? '📱 Ждём голоса с телефонов…' : ''));
  }
  function pub(el) {
    const id = el.dataset.poll, rev = el.classList.contains('revealed'), t = tally(id);
    return {
      id, q: el.dataset.q || '', sub: el.dataset.sub || '',
      opts: $$('.poll-opt', el).map(o => ({ k: o.dataset.k, t: o.dataset.t || (o.querySelector('.pl') || o).textContent.trim() })),
      rev, answer: rev ? (el.dataset.answer || null) : null,
      tally: rev ? t : null, n: Object.values(t).reduce((a, b) => a + b, 0)
    };
  }
  function vote(c, id, k) {
    const el = current();
    if (!el || el.dataset.poll !== id || el.classList.contains('revealed')) return;
    if (!$$('.poll-opt', el).some(o => o.dataset.k === k)) return;
    (votes[id] = votes[id] || {})[c] = k;
    render(el); Live.refresh();
  }
  function reveal(el, pick) {
    if (!el || el.classList.contains('revealed')) return;
    if (pick) el.dataset.pick = pick;
    el.classList.add('revealed'); render(el);
    last = { s: Deck.el, p: pub(el) };
    el.dispatchEvent(new CustomEvent('poll-reveal', { detail: { pick } }));
    Live.refresh();
  }
  function held() {
    if (typeof Game !== 'undefined' && Game.isOpen()) return null;
    return last && last.s === Deck.el ? last.p : null;
  }
  function unreveal(el) { el.classList.remove('revealed'); delete el.dataset.pick; render(el); Live.refresh(); }

  let mo = null, t = 0;
  function sync() {
    const el = current();
    if (el) render(el);
    mo && mo.takeRecords();
    Live.refresh();
  }
  function init() {
    document.addEventListener('click', e => {
      const o = e.target.closest('.poll-opt'); if (!o || o.closest('.game')) return;
      const el = o.closest('.poll');
      if (!el || el.hasAttribute('data-self') || el.classList.contains('revealed')) return;
      if (el.dataset.revealStep) { Deck.setStep(+el.dataset.revealStep); return; }
      if (el.dataset.answer) { reveal(el, o.dataset.k); (o.dataset.k === el.dataset.answer ? SFX.right : SFX.wrong)(); }
    });
    Deck.onChange((id, step) => {
      $$('.poll[data-reveal-step]', Deck.el).forEach(el => {
        const want = step >= +el.dataset.revealStep;
        if (want) reveal(el); else if (el.classList.contains('revealed')) unreveal(el);
      });
      sync();
    });
    mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(sync, 60); });
    mo.observe($('#deck'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  return { init, current, pub, held, vote, reveal, render, sync };
})();
