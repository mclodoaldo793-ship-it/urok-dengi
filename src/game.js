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
        order:null, hist:[]
      }))
    };
  }
  const save = () => store.setJSON(KEY, G);
  function load() {
    const s = store.getJSON(KEY);
    G = s && s.teams && s.teams.length === 2 && s.phase ? s : fresh();
    if (G.res && G.res.teams[0].unit === undefined) G = fresh(G);  // a game saved under the old cups-and-chances rules
    if (G.phase === 'reveal' && !G.res) G.phase = 'orders';
    G.teams.forEach(t => CARD_IDS.forEach(k => { if (!(k in t.cards)) t.cards[k] = true; }));  // games saved before a card was added
  }
  const ev = () => C.EVENTS[G.evs[G.round - 1]] || C.EVENTS.normal;
  const name = i => `«${G.teams[i].name}»`;
  const winner = () => { const [a, b] = G.teams.map(t => t.money); return a === b ? -1 : a > b ? 0 : 1; };
  function plan(n) {
    const pool = shuffle(Object.keys(C.EVENTS).filter(k => k !== 'normal')).slice(0, n - 1);
    if (!pool.includes('beans')) pool[1 + Math.floor(Math.random() * (pool.length - 1))] = 'beans';
    return ['normal', ...pool];
  }

  /* ---------- rules engine ---------- */
  function clean(t, o) {
    const price = +o.price;
    return {
      price: C.PRICES.includes(price) ? price : 60,
      card: typeof o.card === 'string' && C.CARDS[o.card] && t.cards[o.card] ? o.card : null
    };
  }
  function settle() {
    const e = ev(), T = G.teams, o = T.map(t => t.order), card = o.map(x => x.card);
    const harm = [0, 1].map(i => { const c = card[1 - i]; return c && !C.CARDS[c].good ? c : null; });  // aimed at team i
    const blocked = harm.map((h, i) => !!h && card[i] === 'shield');
    const hit = harm.map((h, i) => blocked[i] ? null : h);
    const p = o.map(x => x.price);
    /* above the day's ceiling nobody buys; otherwise the cheaper shop gets 2 of every 3 people, then the cards move people around */
    const ok = p.map(x => x <= e.max);
    const sold = [0, 1].map(i => !ok[i] ? 0 : (ok[1 - i] ? coffeeSplit(e.n, p[i], p[1 - i]) : e.n) + (card[i] === 'ad' ? C.AD : 0));
    const move = (i, m) => { sold[i] -= m; if (ok[1 - i]) sold[1 - i] += m; };  // people who leave a shop only buy if the rival's price is fine
    [0, 1].forEach(i => { if (hit[i] === 'rumor') move(i, Math.min(C.RUMOR, sold[i])); });
    const cut = [0, 1].map(i => hit[i] === 'power' ? Math.max(0, sold[i] - C.POWER_CAP) : 0);
    [0, 1].forEach(i => move(i, cut[i]));
    const teams = [0, 1].map(i => {
      const unit = e.cost - (card[i] === 'discount' ? C.DISCOUNT : 0);
      const revenue = sold[i] * p[i], cost = sold[i] * unit, tax = hit[i] === 'tax' ? Math.round(revenue * C.TAX) : 0;
      return {
        price: p[i], sold: sold[i], unit, revenue, cost, tax, profit: revenue - cost - tax, before: T[i].money, after: T[i].money + revenue - cost - tax,
        card: card[i], hit: hit[i], blocked: blocked[i], blockedCard: blocked[i] ? harm[i] : null, cut: cut[i], over: !ok[i]
      };
    });
    return { round: G.round, ev: G.evs[G.round - 1], N: sold[0] + sold[1], teams };
  }
  /* ---------- flow ---------- */
  function start() {
    G.evs = plan(G.rounds); G.round = 1; G.phase = 'orders'; G.res = null;
    G.teams.forEach(t => { t.order = null; });
    save(); render(); SFX.fanfare();
  }
  function reveal() {
    if (G.phase !== 'orders' || !G.teams.every(t => t.order)) return;
    const r = settle();
    r.teams.forEach((x, i) => {
      const t = G.teams[i];
      t.money = x.after;
      if (x.card) t.cards[x.card] = false;
      t.hist.push({ round: r.round, profit: x.profit, sold: x.sold, price: x.price });
    });
    r.show = reduced ? 0 : SHOW.vs + (scenes(r).length - 1) * SHOW.card;   // phones wait this long before showing the result
    G.res = r; G.phase = 'reveal';
    save(); render(true);
  }

  /* ---------- the show: both prices face off, then every card played, one scene after another ---------- */
  const SHOW = { vs: 1800, card: 2100, drum: 1900 };
  let show = null;
  function scenes(r) {
    const X = r.teams, out = [{ k: 'vs' }];
    X.forEach((x, i) => { if (x.card === 'ad' || x.card === 'discount') out.push({ k: x.card, i }); });
    X.forEach((x, i) => { const h = X[1 - i].card; if (h && !C.CARDS[h].good) out.push(x.blocked ? { k: 'block', i, h } : { k: h, i }); });
    X.forEach((x, i) => { if (x.card === 'shield' && !x.blocked) out.push({ k: 'shield', i }); });
    return out;
  }
  const SOUND = {
    vs: () => SFX.vs(), drum: () => SFX.drum(1.6),
    ad: () => setTimeout(SFX.horn, 150), discount: () => SFX.truck(),
    rumor: () => { SFX.roach(); setTimeout(SFX.roach, 750); },
    tax: () => { setTimeout(SFX.stamp, 300); setTimeout(SFX.evil, 650); },
    power: () => setTimeout(SFX.zap, 200),
    block: () => { SFX.whoosh(); setTimeout(SFX.shield, 600); },
    shield: () => SFX.shield()
  };
  function sceneHtml(s, r, k, total) {
    const T = G.teams, X = r ? r.teams : [], nm = i => esc(name(i)), i = s.i;
    const rep = (n, f) => Array.from({ length: n }, (_, j) => f(j)).join('');
    const rnd = (a, b) => (a + Math.random() * (b - a)).toFixed(1);
    const ppl = n => `${n} ${plural(n, 'покупателя', 'покупателей', 'покупателей')}`;
    const cap = (cls, t, d) => `<div class="fx-cap ${cls}"><b>${t}</b><span>${d}</span></div>`;
    const side = (j, inner) => `<div class="fx-side s${j} t${j}">${inner}</div>`;
    const ring = j => `<i class="fx-ring" style="--d:${j * .35}s"></i>`;
    const walk = n => n > 0 ? `<div class="fx-walk w${i}">${rep(Math.min(n, 6), () => '<i>🚶</i>')}</div>` : '';
    const top = s.k === 'vs' ? 'Вскрываем решения!' : s.k === 'drum' ? '' : `Карта ${k} из ${total}`;
    let html = '';
    if (s.k === 'vs') html = `<div class="fx-vs">${[0, 1].map(j => `<div class="fx-team t${j}"><span>${T[j].emoji}</span><b>${esc(T[j].name)}</b><em>${X[j].price}&nbsp;₽</em></div>`).join('<div class="fx-x">VS</div>')}</div>`;
    else if (s.k === 'drum') html = '<div class="fx-drum"><div class="fx-big">🥁</div></div>' + cap('', 'Считаем деньги в кассах…', 'И побеждает…');
    else if (s.k === 'ad') html = side(i, rep(3, ring) + '<div class="fx-big fx-shout">📣</div>' + rep(C.AD, j => {
        const a = j / C.AD * 6.283, R = 140 + (j % 2) * 50;
        return `<i class="fx-p" style="--x0:${(Math.cos(a) * 55).toFixed(1)}vw;--y0:${(Math.sin(a) * 55).toFixed(1)}vh;--x1:${(Math.cos(a) * R).toFixed(0)}px;--y1:${(Math.sin(a) * R * .75).toFixed(0)}px;--d:${(.35 + j * .07).toFixed(2)}s">🧍</i>`;
      })) + cap('good', '📣 Реклама', `${nm(i)} — ещё ${ppl(C.AD)} пришли по рекламе`);
    else if (s.k === 'discount') html = `<span class="fx-truck go${i}">🚚</span>` + side(i, `<div class="fx-tag">−${C.DISCOUNT}&nbsp;₽</div>`)
      + cap('good', '🚚 Скидка на зёрна', `${nm(i)} — чашка обходится на ${C.DISCOUNT} ₽ дешевле`);
    else if (s.k === 'rumor') html = side(i, rep(14, () => `<i class="fx-roach" style="--y:${rnd(6, 88)}%;--t:${rnd(.7, 1.3)}s;--d:${rnd(0, 1)}s;--r:${rnd(70, 110)}deg">🪳</i>`)) + walk(C.RUMOR)
      + cap('evil', '🪳 Слух про таракана', `Слух от ${nm(1 - i)}: ${nm(i)} теряет ${ppl(C.RUMOR)}`);
    else if (s.k === 'tax') html = side(i, '<div class="fx-stamp">НАЛОГОВАЯ<br>ПРОВЕРКА</div>' + rep(9, j => `<i class="fx-money" style="--x:${rnd(-22, 22)}vw;--r:${rnd(-120, 120)}deg;--d:${(.55 + j * .09).toFixed(2)}s">💸</i>`))
      + cap('evil', '🧾 Налоговая проверка', `${nm(i)} отдаёт 30% выручки`);
    else if (s.k === 'power') html = side(i, '<div class="fx-big fx-bulb">💡</div><i class="fx-bolt">⚡</i>') + walk(X[i].cut)
      + cap('evil', '🔌 Отключили свет', `${nm(i)} продаст не больше ${C.POWER_CAP} чашек`);
    else if (s.k === 'block') html = `<span class="fx-missile m${i}">${C.CARDS[s.h].e}</span>` + side(i, '<i class="fx-ring flash"></i><div class="fx-big fx-guard">🛡️</div>')
      + cap('good', '🛡️ Охрана сработала!', `${nm(i)} отбивает «${C.CARDS[s.h].n}»`);
    else if (s.k === 'shield') html = side(i, rep(2, ring) + '<div class="fx-big fx-guard">🛡️</div>')
      + cap('good', '🛡️ Охрана', `${nm(i)} под охраной, но пакостей не было`);
    return `<div class="fx-scene fx-${s.k}">${top ? `<div class="fx-count">${top}</div>` : ''}${html}</div>`;
  }
  /* plays scenes over the game screen; a click skips to the end */
  function runShow(list, r, done) {
    stopShow();
    const fx = document.createElement('div');
    fx.className = 'fx';
    fx.innerHTML = '<div class="fx-stage"></div><button class="fx-skip" type="button">Пропустить →</button>';
    root.appendChild(fx);
    const stage = fx.firstChild, timers = [], total = list.length - 1;
    let t = 0;
    list.forEach((s, k) => {
      timers.push(setTimeout(() => { stage.innerHTML = sceneHtml(s, r, k, total); SOUND[s.k]?.(); }, t));
      t += SHOW[s.k] || SHOW.card;
    });
    const end = () => {
      if (show !== cur) return;
      stopShow(); done();
    };
    const cur = { fx, timers, end };
    timers.push(setTimeout(end, t));
    fx.addEventListener('click', end);
    show = cur;
  }
  function stopShow() {
    if (!show) return;
    const { fx, timers } = show; show = null;
    timers.forEach(clearTimeout);
    fx.classList.add('out'); setTimeout(() => fx.remove(), 350);
  }
  function finale() {
    const wi = winner(), team = j => cssVar(j ? '--team-b' : '--team-a'), gold = cssVar('--g-gold') || '#F2C14E';
    const colors = wi < 0 ? [team(0), team(1), gold] : [team(wi), gold, '#FFFFFF'];
    const party = () => { if (G.phase !== 'over') return; Confetti.burst({ n:220 }); Confetti.fireworks(colors); SFX.fanfare(); };
    reduced ? party() : runShow([{ k: 'drum' }], null, party);
  }
  function next() {
    if (G.phase !== 'reveal') return;
    if (G.round >= G.rounds) { G.phase = 'over'; save(); render(); return; }
    G.round++; G.phase = 'orders'; G.res = null;
    G.teams.forEach(t => { t.order = null; });
    save(); render(); SFX.news();
  }
  function setOrder(i, o, oid) {
    const t = G.teams[i];
    if (G.phase !== 'orders') return false;
    t.order = { ...clean(t, o), oid: oid || null };
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
  function pub() {
    if (!G) return null;
    const e = (G.phase === 'orders' || G.phase === 'reveal') ? ev() : null;
    return {
      phase: G.phase, round: G.round, rounds: G.rounds, show: G.phase === 'reveal' && G.res ? G.res.show || 0 : 0,
      ev: e && { e: e.e, t: e.t, x: e.x, cost: e.cost },
      teams: G.teams.map((t, i) => {
        const x = G.phase === 'reveal' && G.res ? G.res.teams[i] : null;
        return {
          name: t.name, emoji: t.emoji, money: t.money, cards: t.cards,
          cap: t.cap, ready: !!t.order, oid: t.order ? t.order.oid : null,
          res: x && { price: x.price, sold: x.sold, unit: x.unit, revenue: x.revenue, cost: x.cost, tax: x.tax, profit: x.profit, after: x.after, hit: x.hit, over: x.over },
          final: G.phase === 'over' ? t.money : null
        };
      }),
      winner: G.phase === 'over' ? winner() : null
    };
  }

  /* ---------- rendering ---------- */
  const capState = i => {
    const c = G.teams[i].cap;
    return c ? (Live.alive(c) ? 'Телефон на связи' : 'Телефон отключился') : 'Телефон не подключён';
  };
  function updateCaps() {
    $$('[data-capst]', scr).forEach(el => { const c = G.teams[+el.dataset.capst].cap; el.textContent = capState(+el.dataset.capst); el.classList.toggle('ok', !!c && Live.alive(c)); });
    $$('[data-capreset]', scr).forEach(b => { b.hidden = !G.teams[+b.dataset.capreset].cap; });
    const q = $('#gJoinQr');
    if (q && Live.enabled && q.dataset.code !== Live.code) { q.innerHTML = Live.qr(Live.phoneUrl()); q.dataset.code = Live.code; $('#gJoinCode').textContent = 'код ' + Live.code; }
  }
  function meta(anim) {
    root.dataset.phase = G.phase;
    const m = $('#gMeta');
    if (G.phase === 'lobby') { m.innerHTML = '<span class="sb-r">Подготовка</span>'; return; }
    const T = G.teams, done = G.phase === 'over';
    const cash = T.map(t => t.money);
    const lead = cash[0] === cash[1] ? -1 : cash[0] > cash[1] ? 0 : 1;
    const num = i => { const from = anim && G.res ? G.res.teams[i].before : cash[i]; return `<b><span data-count="${from}" data-to="${cash[i]}">${fmt(from)}</span>&nbsp;₽</b>`; };
    m.innerHTML = `<span class="sb t0 ${lead === 0 ? 'lead' : ''}" title="Деньги в кассе"><i>${T[0].emoji}</i><span class="sb-n">${esc(T[0].name)}</span>${num(0)}</span>
      <span class="sb-r">${done ? 'итог' : `раунд ${G.round} из ${G.rounds}`}</span>
      <span class="sb t1 ${lead === 1 ? 'lead' : ''}" title="Деньги в кассе">${num(1)}<span class="sb-n">${esc(T[1].name)}</span><i>${T[1].emoji}</i></span>`;
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
        <p>Две кофейни у колледжа. Новость дня намекает, сколько придёт покупателей и сколько они готовы платить. Команды тайно выбирают цену чашки. В конце побеждает тот, у кого больше денег.</p>
      </div>
      <div class="lobby-grid">
        ${tcard(0)}
        <div class="ljoin live-only"><div class="ljoin-qr" id="gJoinQr"></div><b>Каждая команда сканирует</b><span>одним телефоном</span><span class="mono" id="gJoinCode"></span></div>
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
      <div class="news-top"><span>Новости колледжа</span><span>Раунд ${G.round} из ${G.rounds}</span></div>
      <div class="news-body"><div class="news-e">${e.e}</div><div><h2>${e.t}</h2><p>${e.x}</p></div></div>
      <div class="news-facts"><span>Чашка обходится в <b>${e.cost} ₽</b></span><span>Сколько придёт людей и сколько они готовы платить — догадайтесь по новости</span></div>
    </div>`;
  }
  function orders() {
    const e = ev(), both = G.teams.every(t => t.order);
    const st = i => {
      const t = G.teams[i], ok = !!t.order;
      return `<div class="ost t${i} ${ok ? 'ok' : ''}">
        <span class="ost-e">${t.emoji}</span>
        <div class="ost-t"><b>${esc(t.name)}</b><span>${ok ? 'Решение принято' : 'Думают…'}</span></div>
        <span class="ost-mark">${ok ? '✓' : ''}</span>
        <div class="ost-foot"><span class="cap-st live-only" data-capst="${i}"></span><button class="lnk" data-manual="${i}">${ok ? 'изменить на экране' : 'ввести на экране'}</button></div>
      </div>`;
    };
    const todo = ['Читаем новость', 'Команда выбирает цену чашки и, если хочет, карту',
      Live.enabled ? 'Команда тайно отправляет решение с телефона' : 'Команда тайно вводит решение на экране'];
    scr.innerHTML = `<div class="stage">
      ${newsCard(e)}
      <div class="g-todo">${todo.map((s, k) => `<div><i>${k + 1}</i><span>${s}</span></div>`).join('')}</div>
      <div class="rule-line"><span>Кто дешевле, к тому идут 2 из 3 покупателей</span><span>Цены равные — поровну</span><span>С чашки остаётся цена минус стоимость кофе</span></div>
      <div class="ost-row">${st(0)}${st(1)}</div>
      <div class="center-act">
        <button class="g-btn gold big" id="gReveal" ${both ? '' : 'disabled'}>Вскрыть решения</button>
        <p class="g-hint">${both ? 'Обе команды готовы!' : 'Когда обе команды будут готовы, ведущий вскрывает решения.'}</p>
      </div>
    </div>`;
    updateCaps();
  }

  /* what happened to one team this round: at most two short lines, the most important first */
  function notes(r, i) {
    const x = r.teams[i], out = [];
    const ppl = n => `${n} ${plural(n, 'покупатель', 'покупателя', 'покупателей')}`;
    if (x.over) out.push(['bad', `😬 Слишком дорого: сегодня дороже ${C.EVENTS[r.ev].max} ₽ никто не покупал`]);
    if (x.hit === 'power') out.push(['bad', `🔌 Соперник отключил свет: ${ppl(x.cut)} ушли к нему`]);
    if (x.hit === 'rumor') out.push(['bad', `🪳 Слух про таракана: ${ppl(C.RUMOR)} ушли к соперникам`]);
    if (x.hit === 'tax') out.push(['bad', '🧾 Налоговая забрала 30% выручки']);
    if (x.blocked) out.push(['good', `🛡️ Охрана отбила пакость «${C.CARDS[x.blockedCard].n}»`]);
    if (x.card === 'ad') out.push(['good', `📣 Реклама привела ещё ${ppl(C.AD)}`]);
    if (x.card === 'discount') out.push(['good', `🚚 Скидка на зёрна: чашка обошлась в ${x.unit} ₽`]);
    return out.slice(0, 2);
  }
  function why(r) {
    const [a, b] = r.teams, out = [], max = C.EVENTS[r.ev].max;
    if (a.over || b.over) {
      if (a.over && b.over) out.push(`Сегодня дороже ${max} ₽ никто не покупал, а обе кофейни поставили цену выше. Никто не купил кофе.`);
      else { const c = a.over ? 0 : 1; out.push(`Сегодня дороже ${max} ₽ никто не покупал. У ${name(c)} цена ${r.teams[c].price} ₽, поэтому все покупатели ушли к ${name(1 - c)}.`); }
    } else if (a.price === b.price) out.push(`Цены одинаковые (${a.price} ₽), поэтому покупатели разделились поровну.`);
    else { const c = a.price < b.price ? 0 : 1; out.push(`${name(c)} продаёт дешевле: ${r.teams[c].price} ₽ против ${r.teams[1 - c].price} ₽, поэтому к ней пошли 2 из 3 покупателей.`); }
    if (r.ev === 'beans') out.push('Зёрна покупают за границей за доллары. Это мировые деньги.');
    else if (!a.over && !b.over && a.price - a.unit !== b.price - b.unit && a.price >= a.unit && b.price >= b.unit) out.push(`Зато с каждой чашки у ${name(0)} осталось ${a.price - a.unit} ₽, а у ${name(1)} — ${b.price - b.unit} ₽.`);
    r.teams.forEach((x, i) => { if (x.price < x.unit) out.push(`${name(i)} продавала дешевле, чем обходится кофе, и теряла ${x.unit - x.price} ₽ на каждой чашке.`); });
    return out;
  }
  const signed = n => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + ' ₽';
  function revealView(anim) {
    const r = G.res, e = C.EVENTS[r.ev], T = G.teams, X = r.teams;
    const P = X.map(x => x.profit), win = P[0] === P[1] ? -1 : P[0] > P[1] ? 0 : 1;
    const head = win < 0 ? 'Обе кофейни заработали поровну'
      : P[win] < 0 ? `<span class="t${win}">${esc(name(win))}</span> потеряла меньше`
      : `Больше заработала <span class="t${win}">${esc(name(win))}</span>`;
    const card = i => {
      const t = T[i], x = X[i];
      return `<div class="res t${i} ${win === i && !anim ? 'win' : ''}" data-res="${i}">
        <div class="res-h"><span class="res-e">${t.emoji}</span><b>${esc(t.name)}</b><span class="res-tag">выиграли раунд</span></div>
        <div class="res-p ${x.profit >= 0 ? 'up' : 'down'}" data-count="0" data-to="${x.profit}" data-signed>${signed(anim ? 0 : x.profit)}</div>
        <div class="res-f">${x.sold} ${plural(x.sold, 'чашка', 'чашки', 'чашек')} × ${x.price - x.unit} ₽ с чашки${x.tax ? ` − ${fmt(x.tax)} ₽ налог` : ''}</div>
        <div class="res-s">Цена ${x.price} ₽, кофе обошёлся в ${x.unit} ₽</div>
        ${notes(r, i).map(([c, s]) => `<div class="res-n ${c}">${s}</div>`).join('')}
      </div>`;
    };
    const seg = (n, cls, label) => n > 0 ? `<div class="cb-s ${cls}" style="flex:${n} 1 0"><b>${n}</b><span>${label}</span></div>` : '';
    const last = G.round >= G.rounds;
    scr.innerHTML = `<div class="rv">
      <div class="rv-top">
        <div class="rv-meta">Раунд ${r.round} · ${e.e} ${e.t}</div>
        <h2 class="rv-h">${head}</h2>
      </div>
      <div class="res-row">${card(0)}${card(1)}</div>
      <div class="cb-wrap">
        <div class="cb-h">${r.N ? `Кофе купили ${r.N} ${plural(r.N, 'человек', 'человека', 'человек')}. Вот куда они пошли:` : 'Сегодня кофе не купил никто: обе цены оказались слишком высокими.'}</div>
        <div class="cb">${seg(X[0].sold, 't0', esc(T[0].name))}${seg(X[1].sold, 't1', esc(T[1].name))}</div>
      </div>
      <div class="rv-why">${why(r).map(s => `<p>${esc(s)}</p>`).join('')}</div>
      <div class="center-act"><button class="g-btn gold big" id="gNext">${last ? 'Итоги игры →' : 'Следующий раунд →'}</button></div>
    </div>`;
    if (anim) runShow(reduced ? [] : scenes(r), r, () => {
      if (G.phase !== 'reveal') return;
      $('.rv', scr)?.classList.add('anim');
      setTimeout(() => { if (G.phase === 'reveal') { SFX.cash(); countUp(); } }, 700);
      setTimeout(() => {
        const c = win >= 0 && $(`[data-res="${win}"]`, scr); if (!c || G.phase !== 'reveal') return;
        c.classList.add('win');
        const b = c.getBoundingClientRect();
        Confetti.burst({ x: b.left + b.width / 2, y: b.top + b.height * .35, n: 90, spread: .75 }); SFX.coin();
      }, 1700);
    });
  }
  function countUp() {
    $$('[data-count]', root).forEach(el => {
      const from = +el.dataset.count, to = +el.dataset.to, sg = el.hasAttribute('data-signed'), t0 = performance.now();
      if (from === to) return;
      const f = t => {
        const k = Math.min(1, (t - t0) / 900), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        el.textContent = sg ? signed(v) : fmt(v);
        if (k < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
  }

  function over() {
    const wi = winner(), T = G.teams;
    const card = i => {
      const t = T[i];
      return `<div class="res t${i} ${wi === i ? 'win' : ''}">
        <div class="res-h"><span class="res-e">${t.emoji}</span><b>${esc(t.name)}</b><span class="res-tag">победители</span></div>
        <div class="res-p">${fmt(t.money)} ₽</div>
        <div class="res-s">Столько в кассе после ${G.rounds} раундов</div>
      </div>`;
    };
    const FN = [
      ['📏', 'Мера стоимости', 'вы назначали цену чашки и сравнивали её с ценой соперника'],
      ['🔄', 'Средство обращения', 'покупатель отдавал деньги и сразу получал кофе'],
      ['🧾', 'Средство платежа', 'налоговая проверка: деньги отдают, а товар взамен не получают'],
      ['🐷', 'Средство накопления', 'выручка копилась в кассе от раунда к раунду'],
      ['🌍', 'Мировые деньги', 'зёрна из Бразилии покупают за доллары']
    ];
    scr.innerHTML = `<div class="over">
      <div class="over-h"><div class="trophy">${wi < 0 ? '🤝' : '🏆'}</div><h1>${wi < 0 ? 'Ничья! Денег у кофеен поровну' : `Победила <span class="t${wi}">${esc(name(wi))}</span>`}</h1></div>
      <div class="res-row">${card(0)}${card(1)}</div>
      <div class="reflect"><h3>Где в игре были функции денег</h3><div class="rf-grid">${FN.map(([e, n, d]) => `<div class="rf"><b>${e} ${n}</b><small>${d}</small></div>`).join('')}</div></div>
      <div class="cta-row mid"><button class="g-btn big" id="gAgain">↺ Сыграть ещё раз</button><button class="g-btn gold big" id="gToFinal">К итогам урока →</button></div>
    </div>`;
  }

  let lastPhase = null;
  function render(anim) {
    if (!isOpen) return;
    if (show && !anim && G.phase === 'reveal') { Live.refresh(); return; }   // don't spoil the result under a running show
    meta(anim);
    if (G.phase === 'lobby') lobby();
    else if (G.phase === 'orders') orders();
    else if (G.phase === 'reveal') revealView(anim);
    else { over(); if (lastPhase !== 'over') finale(); }
    lastPhase = G.phase;
    if (!modal.hidden && formTeam >= 0) refreshForm();
    Live.refresh();
  }

  /* ---------- modals ---------- */
  function showModal(html, cls) { modal.innerHTML = `<div class="g-card ${cls || ''}">${html}</div>`; modal.hidden = false; }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; form = null; formTeam = -1; }
  function manual(i) {
    const t = G.teams[i];
    showModal(`<div class="g-card-h"><h3>✍️ Решение команды ${esc(name(i))}</h3><span class="g-hint">🙈 Соперники, отвернитесь от экрана</span></div>
      <div id="gForm"></div>
      <div class="cta-row end"><button class="g-btn" data-close>Отмена</button><button class="g-btn gold" id="gSave">Сохранить решение</button></div>`, 'wide');
    formTeam = i;
    form = coffeeForm($('#gForm'), t, ev(), t.order, {});
  }
  function refreshForm() { if (form && formTeam >= 0) form.update(G.teams[formTeam], ev()); }
  function rules() {
    const cards = CARD_IDS.map(id => { const c = C.CARDS[id]; return `<li class="${c.good ? 'good' : 'evil'}"><b>${c.e} ${c.n}</b> — ${c.d.toLowerCase()}.</li>`; }).join('');
    showModal(`<h3>❔ Правила «Битвы кофеен»</h3>
      <ol class="rules-list">
        <li>У каждой кофейни на старте ${fmt(C.START)} ₽. Раундов — ${G.rounds}.</li>
        <li>Каждый раунд выходит новость: что происходит в колледже и во что обходится чашка. Сколько придёт покупателей и сколько они готовы платить, команды догадываются сами.</li>
        <li>Команда тайно выбирает <b>цену чашки</b>: от 30 до 120 ₽, шаг 10 ₽. Если цена слишком высокая для этого дня, к кофейне никто не придёт.</li>
        <li>Кто дешевле, к тому идут 2 из 3 покупателей. Цены равные — покупатели делятся поровну.</li>
        <li>С каждой чашки кофейня получает цену минус стоимость кофе. Дешёвый кофе привлекает людей, но с чашки остаётся меньше.</li>
        <li>За раунд можно сыграть одну карту. Каждая карта — один раз за игру.</li>
      </ol>
      <ul class="cards-list">${cards}</ul>
      <div class="cta-row end"><button class="g-btn gold" data-close>Понятно</button></div>`);
  }
  function confirmNew() {
    showModal(`<h3>Начать новую игру?</h3><p>Деньги и карты обнулятся. Названия команд и телефоны останутся.</p>
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
    isOpen = false; root.hidden = true; closeModal(); stopShow(); document.body.classList.remove('game-open');
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
