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

/* ---------- Task 2: properties of money ---------- */
(() => {
  const cands = $('#cands'), table = $('#ptable'), pollBox = $('#propPoll');
  let cur = 'potato', timers = [];
  const score = c => c.v.reduce((s, [v]) => s + v / 2, 0);
  cands.innerHTML = CANDS.map(c => `<button class="cand" data-id="${c.id}"><span class="cand-e">${c.e}</span><span class="cand-n">${c.n}</span></button>`).join('');
  function render() {
    const c = CANDS.find(x => x.id === cur);
    $$('.cand', cands).forEach(b => b.classList.toggle('on', b.dataset.id === cur));
    const q = c.id === 'shells' ? 'Годятся ли ракушки каури в деньги?' : `Годится ли ${c.n.toLowerCase()} в деньги?`;
    pollBox.innerHTML = `<div class="poll prop-poll" data-poll="props-${c.id}" data-q="${q}" data-answer="${score(c) >= 5 ? 'y' : 'n'}">
      <p class="poll-q">${c.e} ${q}</p>
      <div class="poll-opts"><button class="poll-opt popt" data-k="y" data-t="👍 Да"><i class="pbar"></i><span class="pl">👍 Да</span><em class="pn"></em></button><button class="poll-opt popt" data-k="n" data-t="👎 Нет"><i class="pbar"></i><span class="pl">👎 Нет</span><em class="pn"></em></button></div>
      <div class="pmeta"></div>
    </div>`;
    const poll = $('.poll', pollBox);
    poll.addEventListener('poll-reveal', check);
    table.innerHTML = `<div class="ptable-head"><h3>${c.e} ${c.n}: годится в деньги?</h3><button class="btn btn-primary btn-sm" id="pCheck">Проверим!</button></div>` +
      PROPS.map((p, i) => `<div class="prow" data-i="${i}"><span class="mark">?</span><div><div class="prow-name">${p.n} <span class="term">${p.t}</span></div><div class="prow-c">${p.d}</div></div></div>`).join('') +
      `<div class="verdict" id="pVerdict" hidden></div>`;
    $('#pCheck').addEventListener('click', () => Polls.reveal(poll));
  }
  function check() {
    timers.forEach(clearTimeout); timers = [];
    const c = CANDS.find(x => x.id === cur), s = score(c);
    $('#pCheck').disabled = true;
    c.v.forEach(([v, txt], i) => {
      timers.push(setTimeout(() => {
        const row = table.querySelector(`.prow[data-i="${i}"]`);
        row.classList.add(v === 2 ? 'yes' : v === 1 ? 'mid' : 'no');
        row.querySelector('.mark').textContent = v === 2 ? '✓' : v === 1 ? '~' : '✕';
        row.querySelector('.prow-c').textContent = txt;
        SFX.beep(!v);
      }, 250 + i * 380));
    });
    timers.push(setTimeout(() => {
      const el = $('#pVerdict'); el.hidden = false;
      el.innerHTML = `<b>${String(s).replace('.', ',')} из 6.</b> ${c.verdict}`;
      s >= 5 ? SFX.right() : SFX.wrong();
    }, 250 + 6 * 380 + 200));
  }
  cands.addEventListener('click', e => {
    const b = e.target.closest('.cand'); if (!b) return;
    cur = b.dataset.id; timers.forEach(clearTimeout); render(); SFX.click();
  });
  render();
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

/* ---------- Task 3: guess the function ---------- */
(() => {
  const box = $('#quizBox'), keys = Object.keys(FUNCS);
  let i = 0, res = [], picked = null, round = 1;
  function render() {
    if (i >= QUIZ.length) return summary();
    const q = QUIZ[i];
    const expl = picked ? (picked === q.a ? '<b>Верно!</b> ' : `<b>Мимо.</b> Правильно: ${FUNCS[q.a].name}. `) + q.x : '';
    box.innerHTML = `
      <div class="qcard card">
        <div class="qprog">${QUIZ.map((_, k) => `<i class="${k < res.length ? (res[k] ? 'ok' : 'bad') : (k === i ? 'cur' : '')}"></i>`).join('')}</div>
        <div class="qe">${q.e}</div>
        <p class="qt">${q.t}</p>
        <div class="qexpl ${picked && picked !== q.a ? 'bad' : ''}" ${picked ? '' : 'hidden'}>${expl}</div>
      </div>
      <div class="qside">
        <div class="qopts poll ${picked ? 'revealed' : ''}" data-self data-poll="quiz-${round}-${i}" data-q="${esc(q.t)}" data-sub="Какая это суперсила денег?" data-answer="${q.a}">${keys.map(k => {
          const f = FUNCS[k];
          let cls = '';
          if (picked) { if (k === q.a) cls = 'right'; else if (k === picked) cls = 'wrong'; }
          return `<button class="qopt poll-opt ${cls}" style="--c:${f.color}" data-k="${k}" data-t="${f.icon} ${f.name}" ${picked ? 'disabled' : ''}><span class="e">${f.icon}</span>${f.name}<em class="pn"></em><span class="k">${f.key}</span></button>`;
        }).join('')}<div class="pmeta"></div></div>
        <div class="qscore"><span class="chip">Счёт группы: ${res.filter(Boolean).length} из ${res.length}</span>${picked
          ? `<button class="btn btn-primary" id="qNext">${i < QUIZ.length - 1 ? 'Следующая ситуация →' : 'Итог задания →'}</button>`
          : `<span class="hint">Ситуация ${i + 1} из ${QUIZ.length} · клавиши 1–5</span>`}</div>
      </div>`;
  }
  function summary() {
    const s = res.filter(Boolean).length;
    const msg = s >= 11 ? 'Блестяще! Группа — финансовые гении.' : s >= 8 ? 'Отлично! Суперсилы денег освоены.' : s >= 5 ? 'Неплохо. Платёж и обращение легко спутать — в игре будет шанс разобраться.' : 'Есть куда расти. В игре будет шанс отыграться!';
    box.innerHTML = `<div class="qcard card" style="grid-column:1/-1;align-items:center;text-align:center">
      <div class="qe">${s >= 8 ? '🏆' : '📚'}</div><p class="qt">${s} из ${QUIZ.length}</p><p class="lead">${msg}</p>
      <div class="cta-row" style="justify-content:center"><button class="btn btn-ghost" id="qAgain">↺ Пройти ещё раз</button><button class="btn btn-gold" data-action="next">К игре →</button></div></div>`;
    if (s >= 8) { Confetti.burst(); SFX.fanfare(); }
  }
  function pick(k) { const ok = k === QUIZ[i].a; picked = k; res.push(ok); ok ? SFX.right() : SFX.wrong(); render(); }
  function advance() { i++; picked = null; render(); SFX.click(); }
  box.addEventListener('click', e => {
    const o = e.target.closest('.qopt');
    if (o && !picked) return pick(o.dataset.k);
    if (e.target.closest('#qNext')) advance();
    if (e.target.closest('#qAgain')) { i = 0; res = []; picked = null; round++; render(); }
  });
  Deck.hooks.quiz = {
    key(e) {
      if (i >= QUIZ.length) return false;
      const m = /^Digit([1-5])$/.exec(e.code) || /^Numpad([1-5])$/.exec(e.code);
      if (m && !picked) { pick(keys[+m[1] - 1]); return true; }
      if ((e.code === 'Enter' || e.code === 'Space') && e.target.closest && e.target.closest('button')) return false;
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') && picked) { advance(); return true; }
      return false;
    }
  };
  render();
})();
