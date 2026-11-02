/* ================= LESSON WIDGETS ================= */

/* ---------- Task 1: barter quest ---------- */
(() => {
  const ACC = { goat:'козу', bread:'хлеб', cheese:'сыр', fish:'рыбу', shoes:'кроссовки', eggs:'яйца', hammer:'молоток' };
  const grid = $('#barterTraders');
  let S, timer = 0;

  const clock = () => {
    if (!S.t0) return '0:00';
    const s = Math.floor(((S.tEnd || Date.now()) - S.t0) / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  function stats() { $('#bTrades').textContent = S.trades; $('#bFails').textContent = S.fails; $('#bTime').textContent = clock(); }
  function renderYou(anim) {
    const it = BARTER_ITEMS[S.item];
    $('#barterItem').textContent = it.e;
    $('#barterItemName').textContent = it.n;
    if (anim) { const el = $('#barterItem'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  function card(tr) {
    const done = S.done[tr.id];
    const has = BARTER_ITEMS[done ? S.gave[tr.id] : tr.has].e;
    const wants = done ? '✓' : (S.known[tr.id] ? BARTER_ITEMS[tr.wants].e : '❓');
    const say = S.msg[tr.id] || 'Нажмите, чтобы предложить обмен';
    return `<button class="trader ${done ? 'is-done' : ''}" data-id="${tr.id}">
      <span class="trader-top"><span class="trader-ava">${tr.e}</span><span><span class="trader-name" style="display:block">${tr.name}</span><span class="trader-role">${tr.role}</span></span></span>
      <span class="trader-rows"><span class="trader-row">Есть<span class="big">${has}</span></span><span class="trader-row">Хочет<span class="big">${wants}</span></span></span>
      <span class="trader-say">${esc(say)}</span>
    </button>`;
  }
  function render() { grid.innerHTML = BARTER_TRADERS.map(card).join(''); }
  function reset() {
    S = { item:'goat', trades:0, fails:0, t0:0, tEnd:0, known:{}, done:{}, msg:{}, gave:{}, won:false };
    clearInterval(timer); timer = 0;
    $('#barterWin').hidden = true;
    render(); renderYou(); stats();
  }
  function win() {
    S.won = true; S.tEnd = Date.now(); clearInterval(timer); stats();
    $('#barterWinStats').innerHTML =
      `<span class="chip">🔁 ${S.trades} ${plural(S.trades, 'обмен', 'обмена', 'обменов')}</span>` +
      `<span class="chip">🙅 ${S.fails} ${plural(S.fails, 'отказ', 'отказа', 'отказов')}</span>` +
      `<span class="chip">⏱ ${clock()}</span>`;
    setTimeout(() => { $('#barterWin').hidden = false; SFX.right(); Confetti.burst({ n:120 }); }, 500);
  }
  grid.addEventListener('click', e => {
    const b = e.target.closest('.trader');
    if (!b || S.won) return;
    const tr = BARTER_TRADERS.find(t => t.id === b.dataset.id);
    if (S.done[tr.id]) return;
    if (!S.t0) { S.t0 = Date.now(); timer = setInterval(stats, 500); }
    S.known[tr.id] = true;
    if (S.item === tr.wants) {
      S.gave[tr.id] = S.item; S.item = tr.has; S.done[tr.id] = true; S.trades++;
      S.msg[tr.id] = `По рукам! 🤝 Беру ${ACC[S.gave[tr.id]]}, держи ${ACC[tr.has]}.`;
      SFX.trade(); renderYou(true); render(); stats();
      if (S.item === 'shoes') win();
    } else {
      S.fails++;
      S.msg[tr.id] = tr.no.replace('{N}', BARTER_ITEMS[S.item].n);
      SFX.no(); render(); stats();
      grid.querySelector(`[data-id="${tr.id}"]`).classList.add('is-no');
    }
  });
  $('#barterReset').addEventListener('click', () => { reset(); SFX.click(); });
  reset();
})();

/* ---------- timeline: one riddle per era ---------- */
(() => {
  const track = $('#tlTrack'), hook = $('#tlHook');
  track.insertAdjacentHTML('beforeend', TIMELINE.map((t, i) =>
    `<button class="tl-node" data-i="${i}"><span class="tl-dot">${t.e}</span><span class="tl-name">${t.name}</span><span class="tl-era">${t.era}</span></button>`).join(''));
  track.addEventListener('click', e => { const n = e.target.closest('.tl-node'); if (n) { Deck.setStep(+n.dataset.i); SFX.tick(); } });
  const picked = {};
  let last = -1;
  function renderHook(i) {
    const h = TIMELINE[i].hook, done = i in picked;
    hook.innerHTML = `<div class="tl-tag">${h.tag}</div>
      <div class="poll" data-poll="tl-${i}" data-q="${esc(h.q)}" data-answer="${h.a}">
        <p class="poll-q">${h.q}</p>
        <div class="poll-opts col">${h.opts.map((t, k) => `<button class="poll-opt popt" data-k="${'abc'[k]}"><i class="pbar"></i><span class="pl">${t}</span><em class="pn"></em></button>`).join('')}</div>
        <div class="pmeta"></div>
      </div>
      <p class="tl-ans" ${done ? '' : 'hidden'}>${h.ans}</p>
      <button class="btn btn-ghost btn-sm tl-show" ${done ? 'hidden' : ''}>Показать ответ</button>`;
    const poll = $('.poll', hook);
    if (done) Polls.reveal(poll, picked[i]);
    poll.addEventListener('poll-reveal', e => { picked[i] = e.detail.pick; $('.tl-ans', hook).hidden = false; $('.tl-show', hook).hidden = true; });
    $('.tl-show', hook).addEventListener('click', () => { Polls.reveal(poll); SFX.right(); });
  }
  function show(i) {
    $$('.tl-node', track).forEach((n, k) => { n.classList.toggle('on', k === i); n.classList.toggle('past', k < i); });
    $('#tlFill').style.width = (i / (TIMELINE.length - 1) * 84) + '%';
    if (i === last) return;
    const t = TIMELINE[i];
    $('#tlArt').textContent = t.e;
    $('#tlEra').textContent = t.era;
    $('#tlTitle').textContent = t.name;
    $('#tlText').textContent = t.text;
    renderHook(i);
    const a = $('#tlArt'); a.classList.remove('swap'); void a.offsetWidth; a.classList.add('swap'); last = i;
  }
  Deck.hooks.history = { step: show };
})();

/* ---------- find the fake banknote ---------- */
(() => {
  const box = $('#fakeNotes'), bottom = $('#fakeBottom');
  const rosette = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  drawRosette(rosette, [
    { R:120, r:43, d:76, c:'var(--fn-ink)', w:.6, o:.5 },
    { R:96,  r:35, d:58, c:'var(--fn-ink)', w:.6, o:.75 },
    { R:72,  r:25, d:44, c:'var(--fn-ink)', w:.5, o:.45 }
  ]);
  const ros = rosette.innerHTML;
  const micro = 'БАНК ЗНАНИЙ · '.repeat(14);
  let fake, guessed, found;

  function note(side) {
    const f = side === fake;
    return `<div class="fnote-wrap">
      <div class="fnote-label">Купюра ${side === 'a' ? 'А' : 'Б'}</div>
      <div class="fnote" data-side="${side}" role="img" aria-label="Купюра ${side === 'a' ? 'А' : 'Б'}">
        <div class="fn-frame"></div>
        <div class="fn-micro ${f ? 'blur' : ''}" data-d="micro">${micro}</div>
        <div class="fn-rosette"><svg viewBox="-130 -130 260 260" aria-hidden="true">${ros}</svg><b>5000</b></div>
        <div class="fn-issuer" data-d="spell">Билет Банка ${f ? 'Знаней' : 'Знаний'}</div>
        <div class="fn-title">пять тысяч</div>
        <div class="fn-serial" data-d="serial">АБ 1769535</div>
        <div class="fn-serial s2" data-d="serial">АБ ${f ? '1769536' : '1769535'}</div>
        <span class="fn-corner" data-d="corner">${f ? '500' : '5000'}</span>
        <span class="fn-corner bl">5000</span>
        <div class="fn-thread ${f ? 'none' : ''}" data-d="thread"></div>
        <div class="fn-water" data-d="water">${f ? '' : '<span>₽</span>'}</div>
        <div class="fn-stamp" hidden></div>
      </div>
    </div>`;
  }
  function renderBottom() {
    $('#fakeBox').classList.toggle('hunt', guessed);
    if (!guessed) {
      bottom.innerHTML = `<div class="poll fake-poll" data-poll="fake-which" data-q="Какая купюра фальшивая?" data-answer="${fake}">
        <p class="poll-q">🕵️ Какая купюра фальшивая? Кликните ответ большинства.</p>
        <div class="poll-opts"><button class="poll-opt popt" data-k="a" data-t="Купюра А"><i class="pbar"></i><span class="pl">Купюра А</span><em class="pn"></em></button><button class="poll-opt popt" data-k="b" data-t="Купюра Б"><i class="pbar"></i><span class="pl">Купюра Б</span><em class="pn"></em></button></div>
        <div class="pmeta"></div>
      </div>`;
      $('.poll', bottom).addEventListener('poll-reveal', e => onGuess(e.detail.pick));
      return;
    }
    const n = found.length;
    bottom.innerHTML = `<div class="fdiff-head">
        <b class="fcount">Найдено: ${n} из ${FAKE_DIFFS.length}</b>
        <span class="hint">${n < FAKE_DIFFS.length ? 'Кликайте по подозрительным местам на любой купюре' : 'Все отличия найдены. Вы готовы к работе в банке!'}</span>
        <span class="fdiff-btns"><button class="btn btn-ghost btn-sm" id="fakeAll" ${n === FAKE_DIFFS.length ? 'disabled' : ''}>Показать все</button><button class="btn btn-ghost btn-sm" id="fakeAgain">↺ Заново</button></span>
      </div>
      <div class="fdiffs">${found.map((id, k) => { const d = FAKE_DIFFS.find(x => x.id === id); return `<div class="fdiff"><i>${k + 1}</i><div><b>${d.t}</b><span>${d.x}</span></div></div>`; }).join('')}${
        Array.from({ length: FAKE_DIFFS.length - n }, (_, k) => `<div class="fdiff empty"><i>${n + k + 1}</i><div><b>?</b></div></div>`).join('')}</div>`;
  }
  function stamp(side, real) {
    const s = $(`.fnote[data-side="${side}"] .fn-stamp`, box);
    s.className = 'fn-stamp ' + (real ? 'real' : 'bad'); s.textContent = real ? 'настоящая ✓' : 'фальшивка ✕'; s.hidden = false;
  }
  function onGuess(pick) {
    guessed = true;
    stamp(fake, false); stamp(fake === 'a' ? 'b' : 'a', true);
    if (pick) (pick === fake ? SFX.right : SFX.wrong)();
    $('#fakeLead').textContent = pick && pick !== fake ? 'Не угадали! Давайте разберёмся, по каким признакам её можно было узнать.' : (pick ? 'Верно! А теперь докажите: найдите 6 отличий фальшивки от настоящей.' : 'Найдите 6 отличий фальшивки от настоящей.');
    renderBottom();
  }
  function mark(id) {
    if (found.includes(id)) return;
    found.push(id);
    $$(`[data-d="${id}"]`, box).forEach(el => { el.classList.add('found'); el.dataset.n = found.length; });
    renderBottom();
    if (found.length === FAKE_DIFFS.length) { SFX.fanfare(); Confetti.burst({ n:140 }); } else SFX.coin();
  }
  function miss(note, e) {
    const r = note.getBoundingClientRect(), x = document.createElement('span');
    x.className = 'fn-miss'; x.textContent = '✕';
    x.style.left = (e.clientX - r.left) + 'px'; x.style.top = (e.clientY - r.top) + 'px';
    note.appendChild(x); setTimeout(() => x.remove(), 700); SFX.no();
  }
  function reset() {
    fake = Math.random() < .5 ? 'a' : 'b'; guessed = false; found = [];
    box.innerHTML = note('a') + note('b');
    $('#fakeLead').textContent = 'Сначала угадайте, какая. Потом найдите на ней 6 отличий от настоящей.';
    renderBottom();
  }
  box.addEventListener('click', e => {
    const n = e.target.closest('.fnote'); if (!n) return;
    if (!guessed) { const p = $('.poll', bottom); if (p) { Polls.reveal(p, n.dataset.side); } return; }
    const d = e.target.closest('[data-d]');
    d ? mark(d.dataset.d) : miss(n, e);
  });
  bottom.addEventListener('click', e => {
    if (e.target.closest('#fakeAgain')) { reset(); SFX.click(); }
    if (e.target.closest('#fakeAll')) { FAKE_DIFFS.forEach(d => mark(d.id)); }
  });
  reset();
})();

/* ---------- Task 2: museum of failed money, every exhibit lacked one property ---------- */
(() => {
  const box = $('#museum'), keys = Object.keys(PROPS), N = EXHIBITS.length;
  let open = -1, seen = {}, round = 1;   // seen: exhibit index -> the class's pick
  const done = i => i in seen;
  const count = () => Object.keys(seen).length;
  const lacked = x => 'Не хватило ' + PROPS[x.a].t.replace(/ость$/, 'ости');
  const nextOpen = () => { for (let k = 1; k <= N; k++) { const i = (open + k) % N; if (!done(i)) return i; } return -1; };

  function board() {
    const all = count() === N;
    box.innerHTML = `<div class="mx-board">${EXHIBITS.map((x, i) => `
        <button class="mx ${done(i) ? 'done' : ''}" data-i="${i}">
          <span class="mx-no">№${i + 1}</span>
          <span class="mx-e">${x.e}</span>
          <span class="mx-plq"><small>${x.at}</small><b>${x.t}</b>${done(i) ? `<em>${lacked(x)}</em>` : ''}</span>
        </button>`).join('')}</div>
      <div class="mx-foot">${all
        ? '<p class="mx-sum">💵 А у купюры в вашем кошельке есть все шесть свойств. Поэтому она и работает как деньги.</p>'
        : `<span class="hint">Изучено ${count()} из ${N}. Нажмите на любой экспонат.</span>`}${count() ? '<button class="btn btn-ghost btn-sm" id="mxReset">↺ Заново</button>' : ''}</div>`;
  }

  function detail() {
    const x = EXHIBITS[open], rev = done(open), pick = seen[open], p = PROPS[x.a];
    box.innerHTML = `<div class="mx-open">
      <div class="mx-case">
        <span class="mx-no">№${open + 1}</span>
        <span class="mx-e">${x.e}</span>
        ${x.big ? `<span class="mx-big">${x.big}</span>` : ''}
        ${rev ? `<p class="mx-label">${pick ? `<span class="${pick === x.a ? 'ok' : 'bad'}">${pick === x.a ? 'Верно!' : 'Мимо.'}</span> ` : ''}<b>${lacked(x)}</b>, то есть «${p.n.toLowerCase()}». ${x.after}</p>` : ''}
      </div>
      <div class="mx-info">
        <span class="mx-at">${x.at}</span>
        <h3 class="mx-t">${x.t}</h3>
        <p class="mx-x">${x.x}</p>
        <div class="poll mx-poll ${rev ? 'revealed' : ''}" data-self data-poll="museum-${round}-${open}" data-q="${esc(x.t)}: какого свойства не хватило?" data-sub="Экспонат ${open + 1} из ${N}" data-answer="${x.a}">
          <p class="poll-q">Какого свойства не хватило этим деньгам?</p>
          <div class="poll-opts">${keys.map(k => `<button class="popt poll-opt ${rev ? (k === x.a ? 'right' : k === pick ? 'wrong' : 'dim') : ''}" data-k="${k}" data-t="${PROPS[k].n}" ${rev ? 'disabled' : ''}><i class="pbar"></i><span class="pl">${PROPS[k].n}</span><em class="pn"></em></button>`).join('')}</div>
          <div class="pmeta"></div>
        </div>
      </div>
      <div class="mx-nav"><button class="btn btn-ghost" id="mxBack">← Все экспонаты</button>${rev
        ? `<button class="btn btn-primary" id="mxNext">${nextOpen() >= 0 ? 'Следующий экспонат →' : 'К итогу →'}</button>` : ''}</div>
    </div>`;
  }

  function show(i) { open = i; i < 0 ? board() : detail(); }
  function reveal(k) {
    const x = EXHIBITS[open];
    Polls.reveal($('.mx-poll', box), k);
    seen[open] = k;
    detail();
    (k === x.a ? SFX.right : SFX.wrong)();
    if (count() === N) setTimeout(() => { SFX.fanfare(); Confetti.burst({ n:120 }); }, 500);
  }

  box.addEventListener('click', e => {
    const m = e.target.closest('.mx');
    if (m) { show(+m.dataset.i); SFX.click(); return; }
    const o = e.target.closest('.poll-opt');
    if (o && !o.disabled && open >= 0 && !done(open)) return reveal(o.dataset.k);
    if (e.target.closest('#mxBack')) { show(-1); SFX.click(); }
    if (e.target.closest('#mxNext')) { show(nextOpen()); SFX.click(); }
    if (e.target.closest('#mxReset')) { seen = {}; round++; show(-1); SFX.click(); }
  });
  Deck.hooks.props = {
    key(e) {
      if (open < 0) return false;
      if (e.code === 'Escape') { show(-1); return true; }
      if ((e.code === 'Enter' || e.code === 'Space') && e.target.closest && e.target.closest('button')) return false;
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') && done(open)) { show(nextOpen()); return true; }
      return false;
    },
    leave() { if (open >= 0) show(-1); }
  };
  board();
})();

/* ---------- measure of value: barter ratios ---------- */
(() => {
  const NS = [3, 10, 100, 1000, 10000, 100000];
  const r = $('#ratioRange');
  let sb = 4950, sm = 100, raf = 0;
  function animate(tb, tm) {
    cancelAnimationFrame(raf);
    const b0 = sb, m0 = sm, t0 = performance.now();
    const f = t => {
      const k = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - k, 3);
      sb = b0 + (tb - b0) * e; sm = m0 + (tm - m0) * e;
      $('#ratioBarter').textContent = fmt(sb); $('#ratioMoney').textContent = fmt(sm);
      if (k < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
  }
  function update() {
    const n = NS[+r.value];
    $('#ratioN').textContent = fmt(n) + ' ' + plural(n, 'товар', 'товара', 'товаров');
    animate(n * (n - 1) / 2, n);
  }
  r.addEventListener('input', update);
  update();
})();

/* ---------- store of value: inflation calculator ---------- */
(() => {
  const sum = $('#inSum'), yrs = $('#inYears'), rate = $('#inRate');
  function upd() {
    const S = +sum.value, Y = +yrs.value, R = +rate.value / 100;
    const real = S / Math.pow(1 + R, Y), k = real / S;
    const years = Y + ' ' + plural(Y, 'год', 'года', 'лет');
    $('#inSumV').textContent = fmt(S) + ' ₽';
    $('#inYearsV').textContent = years;
    $('#inYearsT').textContent = years;
    $('#inRateV').textContent = rate.value + '%';
    $('#inReal').textContent = fmt(real) + ' ₽';
    $('#inLoss').textContent = `деньги «похудели» на ${Math.round((1 - k) * 100)}%`;
    const note = $('#inNote');
    note.textContent = fmt(S);
    note.style.transform = `scale(${Math.max(.22, Math.sqrt(k)).toFixed(3)})`;
    note.style.filter = `saturate(${k.toFixed(2)})`;
  }
  [sum, yrs, rate].forEach(i => i.addEventListener('input', upd));
  upd();
})();

/* ---------- Task 3: one day in the life of a 1 000 ₽ note ---------- */
(() => {
  const box = $('#quizBox'), keys = Object.keys(FUNCS), N = ROUTE.length;
  let i = 0, res = [], picked = null, round = 1;
  box.innerHTML = `<div class="route">${ROUTE.map(s => `<div class="rt"><span class="rt-dot">${s.e}<i class="rt-f"></i></span><span class="rt-at">${s.at}</span><span class="rt-fn"></span></div>`).join('')}<span class="rt-note">1 000 ₽</span></div><div class="rq" id="rq"></div>`;
  const stops = $$('.rt', box), note = $('.rt-note', box), main = $('#rq');

  /* the route stays in place, so the note can slide from stop to stop */
  function route() {
    const end = i >= N;
    stops.forEach((el, k) => {
      const f = k < res.length ? FUNCS[ROUTE[k].a] : null;
      el.className = 'rt' + (f ? ' done' : k === i ? ' cur' : '');
      el.style.setProperty('--c', f ? f.color : '');
      $('.rt-f', el).textContent = f ? f.icon : '';
      $('.rt-fn', el).textContent = end && f ? f.name : '';
    });
    note.style.left = ((Math.min(i, N - 1) + .5) / N * 100) + '%';
  }
  function render() {
    route();
    if (i >= N) return summary();
    const s = ROUTE[i], f = FUNCS[s.a];
    const expl = picked ? `<b>${picked === s.a ? 'Верно!' : 'Мимо.'}</b> Это ${f.icon} ${f.name.toLowerCase()}. ${s.x}` : '';
    main.innerHTML = `
      <div class="qcard card">
        <span class="rq-n">Остановка ${i + 1} из ${N} · ${s.at}</span>
        <div class="qe">${s.e}</div>
        <p class="qt">${s.t}</p>
        <div class="qexpl ${picked && picked !== s.a ? 'bad' : ''}" ${picked ? '' : 'hidden'}>${expl}</div>
      </div>
      <div class="qside">
        <div class="qopts poll ${picked ? 'revealed' : ''}" data-self data-poll="route-${round}-${i}" data-q="${esc(s.t)}" data-sub="Какую суперсилу показала тысяча?" data-answer="${s.a}">${keys.map(k => {
          const o = FUNCS[k];
          let cls = '';
          if (picked) { if (k === s.a) cls = 'right'; else if (k === picked) cls = 'wrong'; }
          return `<button class="qopt poll-opt ${cls}" style="--c:${o.color}" data-k="${k}" data-t="${o.icon} ${o.name} — ${o.hint}" ${picked ? 'disabled' : ''}><span class="e">${o.icon}</span><span class="qo"><b>${o.name}</b><small>${o.hint}</small></span><em class="pn"></em><span class="k">${o.key}</span></button>`;
        }).join('')}<div class="pmeta"></div></div>
        <div class="qscore"><span class="chip">Угадали: ${res.filter(Boolean).length} из ${res.length}</span>${picked
          ? `<button class="btn btn-primary" id="qNext">${i < N - 1 ? 'Дальше по маршруту →' : 'Итог →'}</button>`
          : '<span class="hint">Кликните ответ класса или нажмите 1–5</span>'}</div>
      </div>`;
  }
  function summary() {
    const s = res.filter(Boolean).length;
    const msg = s === N ? 'Ни одной ошибки!' : s >= 4 ? 'Отлично, суперсилы освоены.' : 'Платёж и обращение легко спутать. В игре будет шанс разобраться.';
    main.innerHTML = `<div class="qcard card rq-sum">
      <div class="qe">${s >= 4 ? '🏆' : '📚'}</div>
      <p class="qt">За один день тысяча показала все пять суперсил</p>
      <p class="lead">Класс угадал ${s} из ${N}. ${msg}</p>
      <div class="cta-row" style="justify-content:center"><button class="btn btn-ghost" id="qAgain">↺ Пройти ещё раз</button><button class="btn btn-gold" data-action="next">К игре →</button></div></div>`;
    if (s >= 4) { Confetti.burst(); SFX.fanfare(); }
  }
  function pick(k) { const ok = k === ROUTE[i].a; picked = k; res.push(ok); ok ? SFX.right() : SFX.wrong(); render(); }
  function advance() { i++; picked = null; render(); SFX.click(); }
  main.addEventListener('click', e => {
    const o = e.target.closest('.qopt');
    if (o && !picked) return pick(o.dataset.k);
    if (e.target.closest('#qNext')) advance();
    if (e.target.closest('#qAgain')) { i = 0; res = []; picked = null; round++; render(); }
  });
  Deck.hooks.quiz = {
    key(e) {
      if (i >= N) return false;
      const m = /^Digit([1-5])$/.exec(e.code) || /^Numpad([1-5])$/.exec(e.code);
      if (m && !picked) { pick(keys[+m[1] - 1]); return true; }
      if ((e.code === 'Enter' || e.code === 'Space') && e.target.closest && e.target.closest('button')) return false;
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') && picked) { advance(); return true; }
      return false;
    }
  };
  render();
})();

/* ---------- homework: the last slide; Homework.pub() is what the phones show ---------- */
const Homework = (() => {
  const H = HOMEWORK, F = FUNCS;
  const fn = id => `${F[id].icon} ${F[id].name}`;
  $('#hwBox').innerHTML = `
    <div class="card hw-card must">
      <span class="hw-tag">Обязательно для всех</span>
      <div class="hw-h"><span class="e">${H.must.e}</span><h3>${H.must.t}</h3></div>
      <p class="txt">${H.must.x}</p>
      <div class="hw-tabw"><table class="hw-tab">
        <thead><tr><th>Что</th><th>Сколько</th><th>Когда</th><th>Функция денег</th></tr></thead>
        <tbody>${H.must.ex.map(([w, s, d, f]) => `<tr><td>${w}</td><td>${s}</td><td>${d}</td><td style="--c:${F[f].color}"><b>${fn(f)}</b></td></tr>`).join('')}
          <tr class="more"><td colspan="4">…и ещё три своих</td></tr></tbody>
      </table></div>
      <div class="chips hw-funcs">${Object.values(F).map(f => `<span class="chip" style="--c:${f.color}">${f.icon} ${f.name}</span>`).join('')}</div>
    </div>
    <div class="card hw-card extra">
      <span class="hw-tag">По желанию</span>
      <div class="hw-h"><span class="e">${H.extra.e}</span><h3>${H.extra.t}</h3></div>
      <p class="txt">${H.extra.x}</p>
      <p class="hw-tip">💡 ${H.extra.tip}</p>
    </div>`;
  return {
    pub: () => ({ must: { ...H.must, ex: H.must.ex.map(([w, s, d, f]) => [w, s, d, fn(f)]) }, extra: H.extra, funcs: Object.keys(F).map(fn) })
  };
})();
