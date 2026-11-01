/* ================= GAME: Битва кофеен ================= */
const Game = (() => {
  const C = COFFEE, KEY = 'coffee-v1', CARD_IDS = Object.keys(C.CARDS);
  const root = $('#gameRoot'), scr = $('#gScreen'), modal = $('#gModal');
  let G = null, isOpen = false, form = null, formTeam = -1;

  /* ---------- state ---------- */
  function fresh(prev) {
    return {
      phase:'lobby', round:0, rounds: prev?.rounds || 6, evs:[], res:null,
      teams:[0, 1].map(i => ({
        name: prev?.teams[i].name || ['Кофейня А', 'Кофейня Б'][i],
        emoji: prev?.teams[i].emoji || ['☕', '🧋'][i],
        cap: prev?.teams[i].cap || null,
        money: C.START, cards: Object.fromEntries(CARD_IDS.map(k => [k, true])),
        loan:false, dep:false, order:null, peek:null, hist:[]
      }))
    };
  }
  const save = () => store.setJSON(KEY, G);
  function load() {
    const s = store.getJSON(KEY);
    G = s && s.teams && s.teams.length === 2 && s.phase ? s : fresh();
    if (G.phase === 'reveal' && !G.res) G.phase = 'orders';
  }
  const ev = () => C.EVENTS[G.evs[G.round - 1]] || C.EVENTS.normal;
  const W = (e, p) => (e.w || C.W)[p];
  const name = i => `«${G.teams[i].name}»`;
  const finalMoney = i => { const t = G.teams[i]; return t.money - (t.loan ? C.LOAN.back : 0) + (t.dep ? C.DEPOSIT.back : 0); };
  const winner = () => { const a = finalMoney(0), b = finalMoney(1); return a === b ? -1 : a > b ? 0 : 1; };
  function plan(n) {
    const pool = shuffle(Object.keys(C.EVENTS).filter(k => k !== 'normal')).slice(0, n - 1);
    if (!pool.includes('beans')) pool[1 + Math.floor(Math.random() * (pool.length - 1))] = 'beans';
    return ['normal', ...pool];
  }

  /* ---------- rules engine ---------- */
  function clean(t, o) {
    const e = ev();
    const r = {
      price: C.PRICES.includes(+o.price) ? +o.price : 60,
      card: typeof o.card === 'string' && o.card !== 'insider' && C.CARDS[o.card] && t.cards[o.card] && t.peek == null ? o.card : null,
      loan: !!o.loan && !t.loan, dep: !!o.dep && !t.dep
    };
    if (t.money + (r.loan ? C.LOAN.now : 0) - (r.dep ? C.DEPOSIT.now : 0) < 0) r.dep = false;
    const budget = t.money + (r.loan ? C.LOAN.now : 0) - (r.dep ? C.DEPOSIT.now : 0);
    r.cups = clamp(Math.round((+o.cups || 0) / C.STEP) * C.STEP, 0, C.MAX_CUPS);
    r.cups = Math.min(r.cups, Math.floor(budget / e.cost / C.STEP) * C.STEP);
    return r;
  }
  function settle() {
    const e = ev(), T = G.teams, o = T.map(t => t.order);
    const card = T.map((t, i) => o[i].card || (t.peek != null ? 'insider' : null));
    const harm = [0, 1].map(i => { const c = card[1 - i]; return c && !C.CARDS[c].good ? c : null; });  // aimed at team i
    const blocked = harm.map((h, i) => !!h && card[i] === 'shield');
    const hit = harm.map((h, i) => blocked[i] ? null : h);
    const cups = [0, 1].map(i => hit[i] === 'power' ? Math.min(o[i].cups, C.POWER_CAP) : o[i].cups);
    const p = o.map(x => x.price), w = p.map(x => W(e, x));
    let share = p[0] < p[1] ? .7 : p[0] > p[1] ? .3 : .5;
    if (card[0] === 'ad') share += .15;
    if (card[1] === 'ad') share -= .15;
    if (hit[1] === 'rumor') share += .2;
    if (hit[0] === 'rumor') share -= .2;
    share = clamp(share, .1, .9);
    const N = e.n, inter = [Math.round(N * share)]; inter[1] = N - inter[0];
    const will = [0, 1].map(i => Math.round(inter[i] * w[i]));
    const sold0 = [0, 1].map(i => Math.min(cups[i], will[i]));
    const left = [0, 1].map(i => will[i] - sold0[i]);
    const moved = [0, 1].map(i => Math.min(cups[1 - i] - sold0[1 - i], Math.round(left[i] * Math.min(1, w[1 - i] / w[i]))));
    const sold = [sold0[0] + moved[1], sold0[1] + moved[0]];
    const teams = [0, 1].map(i => {
      const revenue = sold[i] * p[i], cost = cups[i] * e.cost, tax = hit[i] === 'tax' ? Math.round(revenue * C.TAX) : 0;
      const bank = (o[i].loan ? C.LOAN.now : 0) - (o[i].dep ? C.DEPOSIT.now : 0);
      return {
        price: p[i], ordered: o[i].cups, cups: cups[i], sold: sold[i], poured: cups[i] - sold[i],
        revenue, cost, tax, profit: revenue - cost - tax, bank, before: T[i].money, after: T[i].money + bank + revenue - cost - tax,
        card: card[i], hit: hit[i], blocked: blocked[i], blockedCard: blocked[i] ? harm[i] : null,
        loan: o[i].loan, dep: o[i].dep, short: left[i] - moved[i], lost: moved[i], w: w[i], interested: inter[i]
      };
    });
    return { round: G.round, ev: G.evs[G.round - 1], N, walked: N - sold[0] - sold[1], teams };
  }
  function explain(r) {
    const e = C.EVENTS[r.ev], [a, b] = r.teams, out = [];
    if (a.price === b.price) out.push(`Цены одинаковые (${a.price} ₽), поэтому покупатели разделились поровну.`);
    else { const c = a.price < b.price ? 0 : 1; out.push(`${name(c)} продаёт дешевле (${r.teams[c].price} ₽ против ${r.teams[1 - c].price} ₽), поэтому к ней пошло больше людей.`); }
    r.teams.forEach((x, i) => {
      if (x.card === 'ad') out.push(`📣 Реклама привела в ${name(i)} больше покупателей.`);
      if (x.blocked) out.push(`🛡️ Охрана ${name(i)} отбила пакость «${C.CARDS[x.blockedCard].n}».`);
      if (x.hit === 'rumor') out.push(`🪳 Слух про таракана отпугнул часть покупателей ${name(i)}.`);
      if (x.hit === 'power') out.push(`🔌 У ${name(i)} отключили свет: успели сварить только ${x.cups} чашек из ${x.ordered}.`);
      if (x.hit === 'tax') out.push(`🧾 Налоговая забрала у ${name(i)} ${fmt(x.tax)} ₽ — 30% выручки. Налог — это средство платежа.`);
      if (x.poured > 0) out.push(`🗑️ ${name(i)} вылила ${x.poured} ${plural(x.poured, 'чашку', 'чашки', 'чашек')} — ${fmt(x.poured * e.cost)} ₽ ушли в раковину.`);
      if (x.lost > 0) out.push(`🏃 В ${name(i)} кончился кофе: ${x.lost} ${plural(x.lost, 'человек', 'человека', 'человек')} купили его у соперника.`);
      if (x.short > 0) out.push(`😤 В ${name(i)} кончился кофе: ${x.short} ${plural(x.short, 'человек', 'человека', 'человек')} ушли ни с чем.`);
      if (x.loan) out.push(`💳 ${name(i)} взяла кредит: +600 ₽ сейчас, но в конце вернёт 800 ₽.`);
      if (x.dep) out.push(`🏦 ${name(i)} открыла вклад: деньги полежат и в конце вернутся с процентами.`);
    });
    const hi = r.teams.map(x => x.price).filter(pp => pp >= 80);
    if (hi.length) { const pp = Math.max(...hi); out.push(`Дорогой кофе берут не все: при цене ${pp} ₽ покупают только ${Math.round(W(e, pp) * 10)} из 10 желающих.`); }
    if (r.ev === 'beans') out.push('🌍 Зёрна покупают за границей за доллары — это мировые деньги.');
    return out.slice(0, 6);
  }

  /* ---------- flow ---------- */
  function start() {
    G.evs = plan(G.rounds); G.round = 1; G.phase = 'orders'; G.res = null;
    G.teams.forEach(t => { t.order = null; t.peek = null; });
    save(); render(); SFX.fanfare();
  }
  function reveal() {
    if (G.phase !== 'orders' || !G.teams.every(t => t.order)) return;
    const r = settle();
    r.teams.forEach((x, i) => {
      const t = G.teams[i];
      t.money = x.after;
      if (x.card && x.card !== 'insider') t.cards[x.card] = false;
      if (x.loan) t.loan = true;
      if (x.dep) t.dep = true;
      t.hist.push({ round: r.round, profit: x.profit, sold: x.sold, poured: x.poured, price: x.price });
    });
    G.res = r; G.phase = 'reveal';
    save(); render(true);
  }
  function next() {
    if (G.phase !== 'reveal') return;
    if (G.round >= G.rounds) { G.phase = 'over'; save(); render(); return; }
    G.round++; G.phase = 'orders'; G.res = null;
    G.teams.forEach(t => { t.order = null; t.peek = null; });
    save(); render(); SFX.news();
  }
  function setOrder(i, o, oid) {
    const t = G.teams[i];
    if (G.phase !== 'orders') return false;
    t.order = { ...clean(t, o), oid: oid || null };
    save(); return true;
  }
  function peek(i) {
    const t = G.teams[i];
    if (G.phase !== 'orders' || !t.cards.insider || t.peek != null || (t.order && t.order.card)) return false;
    t.cards.insider = false; t.peek = ev().n;
    save(); return true;
  }

  /* ---------- phones ---------- */
  const team = m => (m.team === 0 || m.team === 1) ? m.team : -1;
  const rerender = () => { if (!isOpen) return; G.phase === 'lobby' ? updateCaps() : render(); };
  Live.on('cap', m => {
    const i = team(m); if (i < 0) return;
    const t = G.teams[i];
    if (t.cap && t.cap !== m.c && Live.alive(t.cap)) return;
    G.teams.forEach(x => { if (x.cap === m.c) x.cap = null; });
    t.cap = m.c; save(); SFX.coin(); rerender(); Live.refresh();
  });
  Live.on('uncap', m => { G.teams.forEach(x => { if (x.cap === m.c) x.cap = null; }); save(); rerender(); Live.refresh(); });
  Live.on('order', m => {
    const i = team(m); if (i < 0 || G.teams[i].cap !== m.c) return;
    if (setOrder(i, m, String(m.n).slice(0, 24))) { SFX.coin(); rerender(); Live.refresh(); }
  });
  Live.on('peek', m => {
    const i = team(m); if (i < 0 || G.teams[i].cap !== m.c) return;
    if (peek(i)) { rerender(); Live.refresh(); }
  });
  function pub() {
    if (!G) return null;
    const e = (G.phase === 'orders' || G.phase === 'reveal') ? ev() : null;
    return {
      phase: G.phase, round: G.round, rounds: G.rounds,
      ev: e && { e: e.e, t: e.t, x: e.x, lvl: e.lvl, cost: e.cost, w: e.w || C.W },
      teams: G.teams.map((t, i) => {
        const x = G.phase === 'reveal' && G.res ? G.res.teams[i] : null;
        return {
          name: t.name, emoji: t.emoji, money: t.money, cards: t.cards, loan: t.loan, dep: t.dep,
          cap: t.cap, ready: !!t.order, oid: t.order ? t.order.oid : null, peek: t.peek,
          res: x && { price: x.price, cups: x.cups, sold: x.sold, poured: x.poured, revenue: x.revenue, cost: x.cost, tax: x.tax, bank: x.bank, profit: x.profit, after: x.after, hit: x.hit },
          final: G.phase === 'over' ? finalMoney(i) : null
        };
      }),
      winner: G.phase === 'over' ? winner() : null
    };
  }

  /* ---------- rendering ---------- */
  const capState = i => {
    const c = G.teams[i].cap;
    return c ? (Live.alive(c) ? '📱 Капитан на связи' : '📱 Капитан отключился') : '📱 Капитана пока нет';
  };
  function updateCaps() {
    $$('[data-capst]', scr).forEach(el => { const c = G.teams[+el.dataset.capst].cap; el.textContent = capState(+el.dataset.capst); el.classList.toggle('ok', !!c && Live.alive(c)); });
    $$('[data-capreset]', scr).forEach(b => { b.hidden = !G.teams[+b.dataset.capreset].cap; });
    const q = $('#gJoinQr');
    if (q && Live.enabled && q.dataset.code !== Live.code) { q.innerHTML = Live.qr(Live.phoneUrl()); q.dataset.code = Live.code; $('#gJoinCode').textContent = 'код ' + Live.code; }
  }
  function meta() {
    $('#gMeta').textContent = G.phase === 'lobby' ? 'Подготовка' : G.phase === 'over' ? 'Игра окончена' : `Раунд ${G.round} из ${G.rounds}`;
  }
  function cardsRow(t) {
    return `<div class="tp-cards">${CARD_IDS.map(id => { const c = C.CARDS[id]; return `<span class="tp-card ${c.good ? 'good' : 'evil'} ${t.cards[id] ? '' : 'used'}" title="${c.n}: ${c.d}">${c.e}</span>`; }).join('')}</div>`;
  }
  function bankRow(t) {
    return `<div class="tp-bank"><span class="${t.loan ? 'on' : ''}">💳 ${t.loan ? 'кредит: вернуть 800 ₽' : 'кредит не брали'}</span><span class="${t.dep ? 'on' : ''}">🏦 ${t.dep ? 'вклад: получить 650 ₽' : 'вклада нет'}</span></div>`;
  }

  function lobby() {
    const T = G.teams;
    const tcard = i => `<div class="lcard t${i}">
        <div class="lcard-top"><span class="lcard-e">${T[i].emoji}</span><input class="lname" data-name="${i}" maxlength="22" value="${esc(T[i].name)}" aria-label="Название команды"></div>
        <div class="lemoji">${C.EMOJI.map(e => `<button class="${e === T[i].emoji ? 'on' : ''}" data-emoji="${i}" data-e="${e}" aria-label="Значок ${e}">${e}</button>`).join('')}</div>
        <div class="lcap live-only"><span class="cap-st" data-capst="${i}"></span><button class="g-btn ghost sm" data-capreset="${i}">сбросить</button></div>
      </div>`;
    scr.innerHTML = `<div class="lobby">
      <div class="lobby-h">
        <h1>☕ Битва кофеен</h1>
        <p>Две кофейни у колледжа. Новость дня подсказывает, сколько будет покупателей. Капитаны тайно выбирают цену чашки и сколько кофе сварить. В конце побеждает тот, у кого больше денег.</p>
      </div>
      <div class="lobby-grid">
        ${tcard(0)}
        <div class="ljoin live-only"><div class="ljoin-qr" id="gJoinQr"></div><b>Капитаны, сканируйте</b><span>и нажмите «Я капитан»</span><span class="mono" id="gJoinCode"></span></div>
        ${tcard(1)}
      </div>
      <div class="lobby-foot">
        <div class="seg"><span>Раундов:</span>${[5, 6, 7].map(n => `<button class="${G.rounds === n ? 'on' : ''}" data-rounds="${n}">${n}</button>`).join('')}</div>
        <button class="g-btn gold big" id="gStart">Открыть кофейни →</button>
      </div>
      <p class="g-hint">${Live.enabled ? 'Нет телефонов? Решения можно ввести прямо на экране кнопкой «✍️ Ввести решение».' : 'Капитаны вводят решения прямо на экране кнопкой «✍️ Ввести решение». Соперники в это время отворачиваются.'}</p>
    </div>`;
    updateCaps();
  }

  let newsKey = '';
  function newsCard(e) {
    const k = G.round + '/' + G.evs.join(), still = k === newsKey; newsKey = k;  // animate once per round, not on every re-render
    return `<div class="news ${still ? 'still' : ''}">
      <div class="news-top"><span>📰 Новости колледжа</span><span>Раунд ${G.round} из ${G.rounds}</span></div>
      <div class="news-body"><div class="news-e">${e.e}</div><div><h2>${e.t}</h2><p>${e.x}</p></div></div>
      <div class="news-facts"><span>👥 Покупателей: <b>${e.lvl}</b></span><span>☕ Чашка обходится в <b>${e.cost} ₽</b></span></div>
    </div>`;
  }
  function orders() {
    const e = ev(), both = G.teams.every(t => t.order);
    const panel = i => {
      const t = G.teams[i];
      return `<aside class="tpanel t${i}">
        <div class="tp-head"><span class="tp-e">${t.emoji}</span><b>${esc(t.name)}</b></div>
        <div class="tp-money"><small>в кассе</small>${fmt(t.money)} ₽</div>
        <div class="tp-status ${t.order ? 'ok' : ''}">${t.order ? '✅ Решение принято' : '⏳ Команда думает…'}</div>
        ${cardsRow(t)}${bankRow(t)}
        <div class="tp-foot"><span class="cap-st live-only" data-capst="${i}"></span><button class="g-btn ghost sm" data-manual="${i}">✍️ Ввести решение</button></div>
      </aside>`;
    };
    scr.innerHTML = `<div class="board3">
      ${panel(0)}
      <section class="center">
        ${newsCard(e)}
        <div class="tips">
          <div class="tip"><span>🏷️</span><b>Кто дешевле — к тому идут</b><small>Разные цены: 7 из 10 покупателей идут в более дешёвую кофейню. Цены равны — поровну.</small></div>
          <div class="tip"><span>💸</span><b>Дорого — не все купят</b><small>При ${C.PRICES.map(pp => `${pp} ₽`).join(' / ')} кофе берут ${C.PRICES.map(pp => Math.round(W(e, pp) * 10)).join(' / ')} из 10 желающих.</small></div>
          <div class="tip"><span>🗑️</span><b>Лишнее — в раковину</b><small>Непроданный кофе выливают. Не хватило кофе — покупатели уходят к соперникам.</small></div>
        </div>
        <div class="center-act">
          <button class="g-btn gold big" id="gReveal" ${both ? '' : 'disabled'}>🔓 Вскрыть решения</button>
          <p class="g-hint">${both ? 'Обе команды готовы! Вскрываем?' : Live.enabled ? 'Команды совещаются шёпотом, капитаны вводят решение на телефоне.' : 'Команды совещаются шёпотом, потом капитан вводит решение кнопкой «✍️ Ввести решение».'}</p>
        </div>
      </section>
      ${panel(1)}
    </div>`;
    updateCaps();
  }

  const STAMP = { rumor:'🪳 Таракан?!', tax:'🧾 Проверка', power:'🔌 Без света' };
  function revealView(anim) {
    const r = G.res, e = C.EVENTS[r.ev], [a, b] = r.teams;
    const dots = (n, cls) => Array.from({ length: n }, (_, k) => `<i class="${cls}" style="--d:${k * 22}ms"></i>`).join('');
    const panel = i => {
      const t = G.teams[i], x = r.teams[i], c = x.card && C.CARDS[x.card];
      const row = (l, v, cls = '') => `<div class="rr ${cls}"><span>${l}</span><b>${v}</b></div>`;
      return `<aside class="tpanel t${i} res">
        <div class="tp-head"><span class="tp-e">${t.emoji}</span><b>${esc(t.name)}</b></div>
        <div class="choice"><div><small>цена</small><b>${x.price} ₽</b></div><div><small>сварили</small><b>${x.cups}</b></div></div>
        <div class="rcard ${c ? (c.good ? 'good' : 'evil') : 'none'}">${c ? `${c.e} ${c.n}` : 'без карты'}</div>
        ${x.hit ? `<div class="rstamp evil">${STAMP[x.hit]}</div>` : x.blocked ? '<div class="rstamp good">🛡️ Защищено</div>' : ''}
        <div class="rres">
          ${row(`Продали ${x.sold} × ${x.price} ₽`, '+' + fmt(x.revenue) + ' ₽', 'plus')}
          ${row(`Сварили ${x.cups} × ${e.cost} ₽`, '−' + fmt(x.cost) + ' ₽', 'minus')}
          ${x.poured ? row('🗑️ Вылили', `${x.poured} ${plural(x.poured, 'чашку', 'чашки', 'чашек')}`, 'minus') : ''}
          ${x.tax ? row('🧾 Налоговая', '−' + fmt(x.tax) + ' ₽', 'minus') : ''}
          ${row('Прибыль за раунд', (x.profit >= 0 ? '+' : '−') + fmt(Math.abs(x.profit)) + ' ₽', 'total ' + (x.profit >= 0 ? 'plus' : 'minus'))}
          ${x.bank ? row(x.bank > 0 ? '💳 Взяли кредит' : '🏦 Отнесли на вклад', (x.bank > 0 ? '+' : '−') + fmt(Math.abs(x.bank)) + ' ₽', x.bank > 0 ? 'plus' : 'minus') : ''}
        </div>
        <div class="tp-money"><small>в кассе</small><span><span data-count="${x.before}" data-to="${x.after}">${fmt(anim ? x.before : x.after)}</span> ₽</span></div>
      </aside>`;
    };
    const last = G.round >= G.rounds;
    scr.innerHTML = `<div class="board3 ${anim ? 'anim' : ''}">
      ${panel(0)}
      <section class="center">
        <div class="rev-head"><span>${e.e} ${e.t}</span><b>Кофе захотели ${r.N} ${plural(r.N, 'человек', 'человека', 'человек')}</b></div>
        <div class="crowd">
          <div class="bin t0"><div class="bin-h">${G.teams[0].emoji} купили</div><div class="dots">${dots(a.sold, 'a')}</div><b>${a.sold}</b></div>
          <div class="bin x"><div class="bin-h">🚶 не купили</div><div class="dots">${dots(r.walked, 'x')}</div><b>${r.walked}</b></div>
          <div class="bin t1"><div class="bin-h">${G.teams[1].emoji} купили</div><div class="dots">${dots(b.sold, 'b')}</div><b>${b.sold}</b></div>
        </div>
        <ul class="expl">${explain(r).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <div class="center-act"><button class="g-btn gold big" id="gNext">${last ? '🏁 Итоги игры' : 'Следующий раунд →'}</button></div>
      </section>
      ${panel(1)}
    </div>`;
    if (anim) {
      const tAfter = Math.min(2600, Math.max(a.sold, b.sold, r.walked) * 22 + 500);
      setTimeout(() => { if (G.phase === 'reveal') { SFX.cash(); countUp(); } }, tAfter);
      if (r.teams.some(x => x.hit)) setTimeout(SFX.evil, 600);
      else if (r.teams.some(x => x.blocked)) setTimeout(SFX.shield, 600);
    }
  }
  function countUp() {
    $$('[data-count]', scr).forEach(el => {
      const from = +el.dataset.count, to = +el.dataset.to, t0 = performance.now();
      const f = t => { const k = Math.min(1, (t - t0) / 900); el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
  }

  function over() {
    const wi = winner(), T = G.teams;
    const best = T.map(t => t.hist.reduce((m, h) => h.profit > m.profit ? h : m, { profit: -Infinity, round: 0 }));
    const sum = (t, k) => t.hist.reduce((s, h) => s + h[k], 0);
    const card = i => {
      const t = T[i];
      return `<div class="ocard t${i} ${wi === i ? 'win' : ''}">
        <div class="tp-head"><span class="tp-e">${t.emoji}</span><b>${esc(t.name)}</b>${wi === i ? '<span class="crown">🏆</span>' : ''}</div>
        <div class="rres">
          <div class="rr"><span>В кассе после ${G.rounds} раундов</span><b>${fmt(t.money)} ₽</b></div>
          ${t.loan ? `<div class="rr minus"><span>💳 Вернули кредит</span><b>−${fmt(C.LOAN.back)} ₽</b></div>` : ''}
          ${t.dep ? `<div class="rr plus"><span>🏦 Забрали вклад</span><b>+${fmt(C.DEPOSIT.back)} ₽</b></div>` : ''}
          <div class="rr total"><span>Итого</span><b>${fmt(finalMoney(i))} ₽</b></div>
        </div>
        <div class="ostats"><span>☕ продали <b>${sum(t, 'sold')}</b></span><span>🗑️ вылили <b>${sum(t, 'poured')}</b></span><span>⭐ лучший раунд <b>${best[i].round ? (best[i].profit >= 0 ? '+' : '−') + fmt(Math.abs(best[i].profit)) + ' ₽' : '—'}</b></span></div>
      </div>`;
    };
    const FN = [
      ['📏', 'Мера стоимости', 'вы назначали цену чашки и сравнивали её с ценой соперника'],
      ['🔄', 'Средство обращения', 'покупатель отдавал деньги и сразу получал кофе'],
      ['🧾', 'Средство платежа', 'налоговая и возврат кредита: деньги отдают, а товар не получают'],
      ['🐷', 'Средство накопления', 'вклад: отложили деньги сейчас, получили больше потом'],
      ['🌍', 'Мировые деньги', 'зёрна из Бразилии покупают за доллары']
    ];
    scr.innerHTML = `<div class="over">
      <div class="over-h"><div class="trophy">${wi < 0 ? '🤝' : '🏆'}</div><h1>${wi < 0 ? 'Ничья! Обе кофейни заработали поровну' : `Победила ${esc(name(wi))}!`}</h1></div>
      <div class="over-teams">${card(0)}${card(1)}</div>
      <div class="reflect"><h3>Где в игре прятались функции денег</h3><div class="rf-grid">${FN.map(([e, n, d]) => `<div class="rf"><span>${e}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div></div>
      <div class="cta-row mid"><button class="g-btn big" id="gAgain">↺ Сыграть ещё раз</button><button class="g-btn gold big" id="gToFinal">К итогам урока →</button></div>
    </div>`;
  }

  let lastPhase = null;
  function render(anim) {
    if (!isOpen) return;
    meta();
    if (G.phase === 'lobby') lobby();
    else if (G.phase === 'orders') orders();
    else if (G.phase === 'reveal') revealView(anim);
    else { over(); if (lastPhase !== 'over') { Confetti.burst({ n:220 }); SFX.fanfare(); } }
    lastPhase = G.phase;
    if (!modal.hidden && formTeam >= 0) refreshForm();
    Live.refresh();
  }

  /* ---------- modals ---------- */
  function showModal(html) { modal.innerHTML = `<div class="g-card">${html}</div>`; modal.hidden = false; }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; form = null; formTeam = -1; }
  function manual(i) {
    const t = G.teams[i];
    showModal(`<h3>✍️ Решение команды ${esc(name(i))}</h3>
      <p class="g-hint">Соперники, отвернитесь от экрана 🙈</p>
      <div id="gForm"></div>
      <div class="cta-row end"><button class="g-btn" data-close>Отмена</button><button class="g-btn gold" id="gSave">Сохранить решение</button></div>`);
    formTeam = i;
    form = coffeeForm($('#gForm'), t, ev(), t.order, {
      peek() { if (peek(i)) { refreshForm(); render(); SFX.coin(); } }
    });
  }
  function refreshForm() { if (form && formTeam >= 0) form.update(G.teams[formTeam], ev()); }
  function rules() {
    const cards = CARD_IDS.map(id => { const c = C.CARDS[id]; return `<li class="${c.good ? 'good' : 'evil'}"><b>${c.e} ${c.n}</b> — ${c.d}</li>`; }).join('');
    showModal(`<h3>❔ Правила «Битвы кофеен»</h3>
      <ol class="rules-list">
        <li>У каждой кофейни на старте ${fmt(C.START)} ₽. Раундов — ${G.rounds}.</li>
        <li>Каждый раунд выходит новость. Она подсказывает, сколько человек захотят кофе и сколько стоит сварить одну чашку.</li>
        <li>Капитан тайно выбирает <b>цену чашки</b> (40, 60, 80 или 100 ₽) и <b>сколько чашек сварить</b>. Варить можно только на те деньги, что есть в кассе.</li>
        <li>Покупатели идут туда, где дешевле: 7 из 10 — в более дешёвую кофейню. Цены равные — делятся поровну.</li>
        <li>Чем дороже кофе, тем меньше людей готовы его купить: при 100 ₽ берут только 6 из 10 желающих.</li>
        <li>Кофе кончился — покупатели идут к соперникам. Остался лишний — его выливают.</li>
        <li>За раунд можно сыграть одну карту. Каждая карта — один раз за игру.</li>
      </ol>
      <ul class="cards-list">${cards}</ul>
      <p class="g-hint">💳 Кредит: +600 ₽ сейчас, вернуть 800 ₽ в конце. 🏦 Вклад: отдать 500 ₽ сейчас, получить 650 ₽ в конце.</p>
      <div class="cta-row end"><button class="g-btn gold" data-close>Понятно</button></div>`);
  }
  function confirmNew() {
    showModal(`<h3>Начать новую игру?</h3><p>Деньги и карты обнулятся. Названия команд и капитаны останутся.</p>
      <div class="cta-row end"><button class="g-btn" data-close>Отмена</button><button class="g-btn gold" id="gNewYes">Начать заново</button></div>`);
  }

  /* ---------- events ---------- */
  scr.addEventListener('input', e => {
    const n = e.target.closest('[data-name]'); if (!n) return;
    const i = +n.dataset.name;
    G.teams[i].name = n.value.trim().slice(0, 22) || ['Кофейня А', 'Кофейня Б'][i];
    save(); Live.refresh();
  });
  scr.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.emoji) { G.teams[+b.dataset.emoji].emoji = b.dataset.e; save(); lobby(); Live.refresh(); SFX.click(); }
    else if (b.dataset.rounds) { G.rounds = +b.dataset.rounds; save(); lobby(); SFX.click(); }
    else if (b.dataset.capreset) { G.teams[+b.dataset.capreset].cap = null; save(); updateCaps(); Live.refresh(); }
    else if (b.dataset.manual) manual(+b.dataset.manual);
    else if (b.id === 'gStart') start();
    else if (b.id === 'gReveal') reveal();
    else if (b.id === 'gNext') next();
    else if (b.id === 'gAgain') { G = fresh(G); save(); render(); }
    else if (b.id === 'gToFinal') { close(); Deck.goTo('final'); }
  });
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-close]')) return closeModal();
    if (e.target.closest('#gSave') && form) { if (setOrder(formTeam, form.value)) SFX.coin(); closeModal(); render(); }
    if (e.target.closest('#gNewYes')) { G = fresh(G); save(); closeModal(); render(); }
  });
  $('#gBack').addEventListener('click', () => close());
  $('#gSound').addEventListener('click', () => UI.toggleSound());
  $('#gRules').addEventListener('click', rules);
  $('#gNew').addEventListener('click', confirmNew);
  $('#gLive').addEventListener('click', () => Live.open());

  function open() {
    isOpen = true; root.hidden = false; document.body.classList.add('game-open');
    $('#gSound').textContent = SFX.on ? '🔊' : '🔇';
    lastPhase = G.phase;
    render(); SFX.whoosh();
  }
  function close() {
    isOpen = false; root.hidden = true; closeModal(); document.body.classList.remove('game-open');
    Live.refresh();
  }
  load();
  return {
    open, close, pub,
    isOpen: () => isOpen,
    key(e) { if (e.code === 'Escape') { modal.hidden ? close() : closeModal(); e.preventDefault(); } },
    liveChanged() { if (isOpen && G && (G.phase === 'lobby' || G.phase === 'orders')) updateCaps(); }
  };
})();
